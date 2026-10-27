<?php

namespace App\Livewire;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\Karyawan;
use App\Models\Kasbon;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\PotonganKasbon;
use App\Models\SlipGaji;
use App\Models\TransaksiKas;
use App\Support\CicilanKasbon;
use App\Support\Format;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Kasbon ABK (misalnya beli HP atau sepeda motor) yang dikembalikan lewat beberapa kali potongan slip gaji periode.
 * Kasbon dicatat di periode terpilih. Potongan tidak dibuat otomatis: setelah ABK setuju, tombol Potong memotong
 * kasbon dari slip gajinya di periode terpilih. Bila uangnya keluar dari kas operasional kandang, transaksi
 * Pinjaman ABK ikut dibuat dan tidak dipotong lagi sebagai pinjaman biasa.
 */
#[Title('Kasbon ABK')]
class KasbonAbk extends Component
{
    use MemilihPeriode;

    public ?string $pesan = null;

    #[Locked]
    public ?int $kasbonId = null;

    public ?int $karyawanId = null;

    public string $tanggal = '';

    public string $keperluan = '';

    /** Rupiah kasbon; kosong saat isiannya dikosongkan. */
    public ?int $jumlah = null;

    public string $jumlahPotongan = '1';

    /** Nominal potongan per slip; kosong berarti kasbon dibagi rata ke jumlah potongannya. */
    public ?int $nilaiPotongan = null;

    /** Uang kasbon keluar dari kas operasional kandang ABK di periode ini. */
    public bool $dariKas = false;

    /** Kasbon yang sedang dipotong lewat modal Potong. */
    #[Locked]
    public ?int $potongKasbonId = null;

    /** Nominal yang disepakati untuk dipotong dari slip periode terpilih. */
    public ?int $nilaiPotong = null;

    public string $judulPotong = '';

    public string $keteranganPotong = '';

    #[Locked]
    public ?int $potonganBatalId = null;

    public string $namaBatal = '';

    #[Locked]
    public ?int $kasbonHapusId = null;

    public string $namaHapus = '';

    public function mount(): void
    {
        $this->tanggal = Carbon::today()->toDateString();
    }

    /**
     * ABK yang dapat mengambil kasbon, urut nama.
     *
     * @return Collection<int, Karyawan>
     */
    #[Computed]
    public function daftarKaryawan(): Collection
    {
        return Karyawan::query()->with('kandang')->where('jabatan', Jabatan::Abk)->orderBy('nama')->get();
    }

    /**
     * Seluruh kasbon farm ini, yang masih berjalan lebih dulu, lalu yang terbaru.
     *
     * @return Collection<int, Kasbon>
     */
    #[Computed]
    public function daftar(): Collection
    {
        if (! $this->farm) {
            return new Collection;
        }

        return Kasbon::query()
            ->with(['karyawan.kandang', 'periode', 'transaksiKas.periodeKandang.kandang', 'potongan.slipGaji.periodeKandang.periode'])
            ->whereHas('periode', fn ($query) => $query->where('farm_id', $this->farm->id))
            ->orderByDesc('tanggal')
            ->orderByDesc('id')
            ->get()
            ->sortBy(fn (Kasbon $kasbon): int => $kasbon->lunas() ? 1 : 0)
            ->values();
    }

    /**
     * Baris tabel kasbon: angka cicilan, sisa, riwayat potongan per periode, dan apakah dapat diubah di periode terpilih.
     *
     * @return list<array{id: int, nama: string, kandang: ?string, tanggal: Carbon, keperluan: string, periode: string, jumlah: int, jumlah_potongan: int, nilai_potongan: ?int, kali_dipotong: int, terpotong: int, sisa: int, lunas: bool, dari_kas: ?string, riwayat: list<array{periode: string, jumlah: int}>, bisa_diubah: bool, potong: ?array{status: string, potongan_id: ?int, jumlah: int}}>
     */
    #[Computed]
    public function baris(): array
    {
        $periodeTerbuka = $this->periode && ! $this->periode->tertutup();
        $slipPeriodeIni = $this->slipPeriodeIni;

        return $this->daftar->map(fn (Kasbon $kasbon): array => [
            'id' => $kasbon->id,
            'nama' => $kasbon->karyawan->nama,
            'kandang' => $kasbon->karyawan->kandang?->nama,
            'tanggal' => $kasbon->tanggal,
            'keperluan' => $kasbon->keperluan,
            'periode' => $kasbon->periode->nama,
            'jumlah' => $kasbon->jumlah,
            'jumlah_potongan' => max($kasbon->jumlah_potongan, $kasbon->potongan->where('jumlah', '>', 0)->count()),
            'nilai_potongan' => $kasbon->nilai_potongan,
            'kali_dipotong' => $kasbon->potongan->where('jumlah', '>', 0)->count(),
            'terpotong' => $kasbon->terpotong(),
            'sisa' => $kasbon->sisa(),
            'lunas' => $kasbon->lunas(),
            'dari_kas' => $kasbon->transaksiKas ? 'Kas operasional '.$kasbon->transaksiKas->periodeKandang->kandang->nama : null,
            'riwayat' => $kasbon->potongan
                ->sortBy(fn ($potongan): string => $potongan->slipGaji->periodeKandang->periode->tanggal_chick_in->format('Y-m-d'))
                ->map(fn ($potongan): array => ['periode' => $potongan->slipGaji->periodeKandang->periode->nama, 'jumlah' => $potongan->jumlah])
                ->values()
                ->all(),
            'bisa_diubah' => $periodeTerbuka && $kasbon->periode_id === $this->periode->id,
            'potong' => $this->statusPotong($kasbon, $slipPeriodeIni),
        ])->all();
    }

    /**
     * Slip gaji periode terpilih, kuncinya karyawan_id.
     *
     * @return \Illuminate\Support\Collection<int, SlipGaji>
     */
    #[Computed]
    public function slipPeriodeIni(): \Illuminate\Support\Collection
    {
        if (! $this->periode) {
            return collect();
        }

        return SlipGaji::query()
            ->whereNotNull('karyawan_id')
            ->whereHas('periodeKandang', fn ($query) => $query->where('periode_id', $this->periode->id))
            ->orderBy('id')
            ->get()
            ->unique('karyawan_id')
            ->keyBy('karyawan_id');
    }

    /**
     * @return array{berjalan: int, sisa: int, terpotong_periode_ini: int, jumlah_abk: int}
     */
    #[Computed]
    public function ringkasan(): array
    {
        $berjalan = $this->daftar->reject(fn (Kasbon $kasbon): bool => $kasbon->lunas());

        return [
            'berjalan' => $berjalan->count(),
            'sisa' => (int) $berjalan->sum(fn (Kasbon $kasbon): int => $kasbon->sisa()),
            'terpotong_periode_ini' => (int) $this->daftar->sum(fn (Kasbon $kasbon): int => (int) $kasbon->potongan
                ->filter(fn ($potongan): bool => $potongan->slipGaji->periodeKandang->periode_id === $this->periode?->id)
                ->sum('jumlah')),
            'jumlah_abk' => $berjalan->pluck('karyawan_id')->unique()->count(),
        ];
    }

    /**
     * Rencana potongan dari isian form, satu angka per slip periode, dihitung dengan aturan yang sama dengan slip.
     *
     * @return list<int>
     */
    #[Computed]
    public function rencanaPotongan(): array
    {
        $jumlah = (int) $this->jumlah;
        $kali = (int) $this->jumlahPotongan;
        if ($jumlah <= 0 || $kali < 1 || $kali > Kasbon::MAKS_POTONGAN) {
            return [];
        }

        $kasbon = new Kasbon(['jumlah' => $jumlah, 'jumlah_potongan' => $kali, 'nilai_potongan' => $this->nilaiPotongan ?: null]);
        $kasbon->setRelation('potongan', new Collection);
        $rencana = [];
        while (($potong = $kasbon->saranPotongan()) > 0) {
            $rencana[] = $potong;
            $kasbon->potongan->push(new PotonganKasbon(['jumlah' => $potong]));
        }

        return $rencana;
    }

    #[Computed]
    public function karyawanTerpilih(): ?Karyawan
    {
        return $this->daftarKaryawan->firstWhere('id', $this->karyawanId);
    }

    /**
     * Kandang ABK terpilih di periode ini, tempat transaksi kas kasbon dicatat.
     */
    #[Computed]
    public function periodeKandangKas(): ?PeriodeKandang
    {
        $kandangId = $this->karyawanTerpilih?->kandang_id;
        if (! $kandangId || ! $this->periode) {
            return null;
        }

        return $this->periode->kandangPeriode()->with('kandang')->where('kandang_id', $kandangId)->first();
    }

    public function tambah(): void
    {
        $this->pesan = null;
        $this->bersihkanForm();
    }

    public function ubah(int $id): void
    {
        $kasbon = $this->kasbonDapatDiubah($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->kasbonId = $kasbon->id;
        $this->karyawanId = $kasbon->karyawan_id;
        $this->tanggal = $kasbon->tanggal->toDateString();
        $this->keperluan = $kasbon->keperluan;
        $this->jumlah = $kasbon->jumlah;
        $this->jumlahPotongan = (string) $kasbon->jumlah_potongan;
        $this->nilaiPotongan = $kasbon->nilai_potongan;
        $this->dariKas = $kasbon->transaksi_kas_id !== null;
        unset($this->karyawanTerpilih, $this->periodeKandangKas);
    }

    public function updatedJumlah(): void
    {
        $this->samakanJumlahPotongan();
    }

    public function updatedNilaiPotongan(): void
    {
        $this->samakanJumlahPotongan();
    }

    public function pilihKaryawan(int $id): void
    {
        $this->karyawanId = $id;
        unset($this->karyawanTerpilih, $this->periodeKandangKas);
    }

    public function batal(): void
    {
        $this->bersihkanForm();
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode ?? abort(404);
        $kasbonLama = $this->kasbonId ? $this->kasbonDapatDiubah($this->kasbonId) : null;
        $this->keperluan = trim($this->keperluan);
        $this->samakanJumlahPotongan();

        $data = $this->validate([
            'karyawanId' => ['required', 'integer', Rule::exists('karyawans', 'id')->where('jabatan', Jabatan::Abk->value)],
            'tanggal' => ['required', 'date'],
            'keperluan' => ['required', 'string', 'max:100'],
            'jumlah' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
            'nilaiPotongan' => ['nullable', 'integer', 'min:1', 'lte:jumlah'],
            'jumlahPotongan' => ['required', 'integer', 'min:1', 'max:'.Kasbon::MAKS_POTONGAN],
        ], [
            'nilaiPotongan.integer' => 'Nilai potongan harus berupa rupiah bulat.',
            'nilaiPotongan.min' => 'Nilai potongan minimal Rp 1, atau kosongkan untuk dibagi rata.',
            'nilaiPotongan.lte' => 'Nilai potongan tidak boleh melebihi jumlah kasbon.',
            'karyawanId.required' => 'Pilih ABK yang mengambil kasbon.',
            'karyawanId.exists' => 'Kasbon hanya untuk karyawan berjabatan ABK.',
            'tanggal.required' => 'Tanggal kasbon wajib diisi.',
            'tanggal.date' => 'Tanggal kasbon tidak valid.',
            'keperluan.required' => 'Keperluan kasbon wajib diisi.',
            'keperluan.max' => 'Keperluan maksimal 100 karakter.',
            'jumlah.required' => 'Jumlah kasbon wajib diisi.',
            'jumlah.integer' => 'Jumlah kasbon harus berupa rupiah bulat.',
            'jumlah.min' => 'Jumlah kasbon minimal Rp 1.',
            'jumlah.max' => 'Jumlah kasbon terlalu besar.',
            'jumlahPotongan.required' => 'Jumlah potongan gaji wajib diisi.',
            'jumlahPotongan.integer' => 'Jumlah potongan gaji harus berupa angka bulat.',
            'jumlahPotongan.min' => 'Kasbon dipotong paling sedikit 1 kali.',
            'jumlahPotongan.max' => $this->nilaiPotongan
                ? 'Dengan potongan Rp '.Format::angka($this->nilaiPotongan).' per slip, kasbon ini butuh '.Format::angka((int) $this->jumlahPotongan).' kali potongan; maksimal '.Kasbon::MAKS_POTONGAN.' kali. Besarkan nilai potongannya.'
                : 'Kasbon dipotong paling banyak '.Kasbon::MAKS_POTONGAN.' kali.',
        ]);

        if ($kasbonLama && (int) $data['jumlah'] < $kasbonLama->terpotong()) {
            throw ValidationException::withMessages([
                'jumlah' => 'Jumlah kasbon tidak boleh lebih kecil dari yang sudah dipotong dari gaji, Rp '.Format::angka($kasbonLama->terpotong()).'.',
            ]);
        }

        $periodeKandangKas = $this->dariKas ? $this->periodeKandangKas : null;
        if ($this->dariKas && ! $periodeKandangKas) {
            throw ValidationException::withMessages([
                'dariKas' => 'ABK ini tidak bertugas di kandang mana pun pada '.$periode->nama.', jadi kasbon tidak dapat dicatat di kas operasional.',
            ]);
        }

        $karyawan = $this->karyawanTerpilih ?? abort(404);
        $baru = $kasbonLama === null;

        $kasbon = DB::transaction(function () use ($data, $periode, $kasbonLama, $periodeKandangKas, $karyawan): Kasbon {
            $kasbon = $kasbonLama ?? new Kasbon(['periode_id' => $periode->id]);
            $kasbon->fill([
                'karyawan_id' => $karyawan->id,
                'tanggal' => $data['tanggal'],
                'keperluan' => $data['keperluan'],
                'jumlah' => (int) $data['jumlah'],
                'jumlah_potongan' => (int) $data['jumlahPotongan'],
                'nilai_potongan' => $data['nilaiPotongan'] ? (int) $data['nilaiPotongan'] : null,
            ]);
            $kasbon->transaksi_kas_id = $this->simpanTransaksiKas($kasbon, $karyawan, $periodeKandangKas)?->id;
            $kasbon->save();

            if ($kasbonLama?->transaksiKas && $kasbon->transaksi_kas_id === null) {
                $kasbonLama->transaksiKas->delete();
            }

            Aktivitas::catat(
                $kasbonLama ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::KasbonAbk,
                'Kasbon '.$karyawan->nama,
                self::rincian($kasbon),
            );

            return $kasbon;
        });

        $this->pesan = 'Kasbon '.$kasbon->keperluan.' '.$karyawan->nama.($baru ? ' dicatat.' : ' diperbarui.').' Belum ada yang dipotong dari gaji; potong lewat tombol Potong setelah disepakati dengan ABK.';
        $this->dispatch('tutup-modal-kasbon');
        $this->bersihkanForm();
        $this->segarkan();
    }

    /**
     * Siapkan modal Potong: nominalnya diisi saran cicilan dan masih dapat diubah sesuai kesepakatan.
     */
    public function mintaPotong(int $id): void
    {
        $this->pastikanPeriodeDapatDiubah();
        [$kasbon, $slip] = $this->kasbonDanSlipUntukPotong($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->potongKasbonId = $kasbon->id;
        $this->nilaiPotong = $kasbon->saranPotongan();
        $this->judulPotong = 'Potong kasbon '.$kasbon->keperluan.' '.$kasbon->karyawan->nama;
        $this->keteranganPotong = 'Dipotong dari slip gaji '.$slip->nama.' '.$slip->periodeKandang->kandang->nama.', '.$this->periode->nama
            .'. Sisa kasbon Rp '.Format::angka($kasbon->sisa()).', sudah dipotong '.Format::angka($kasbon->potongan->where('jumlah', '>', 0)->count())
            .' dari '.Format::angka($kasbon->jumlah_potongan).' kali.';
    }

    public function batalPotong(): void
    {
        $this->resetValidation();
        $this->potongKasbonId = null;
        $this->nilaiPotong = null;
        $this->judulPotong = '';
        $this->keteranganPotong = '';
    }

    public function potong(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        [$kasbon, $slip] = $this->kasbonDanSlipUntukPotong($this->potongKasbonId ?? abort(404));

        $data = $this->validate([
            'nilaiPotong' => ['required', 'integer', 'min:1', 'max:'.$kasbon->sisa()],
        ], [
            'nilaiPotong.required' => 'Nilai potongan wajib diisi.',
            'nilaiPotong.integer' => 'Nilai potongan harus berupa rupiah bulat.',
            'nilaiPotong.min' => 'Nilai potongan minimal Rp 1.',
            'nilaiPotong.max' => 'Nilai potongan tidak boleh melebihi sisa kasbon, Rp '.Format::angka($kasbon->sisa()).'.',
        ]);

        DB::transaction(function () use ($kasbon, $slip, $data): void {
            $kasbon->potongan()->create(['slip_gaji_id' => $slip->id, 'jumlah' => (int) $data['nilaiPotong']]);
            Aktivitas::catat(
                JenisAktivitas::Tambah,
                ModulAktivitas::KasbonAbk,
                'Potongan kasbon '.$kasbon->karyawan->nama,
                $kasbon->keperluan.' Rp '.Format::angka((int) $data['nilaiPotong']).', slip '.$this->periode->nama,
            );
        });

        $this->pesan = 'Kasbon '.$kasbon->keperluan.' '.$kasbon->karyawan->nama.' dipotong Rp '.Format::angka((int) $data['nilaiPotong']).' dari slip gaji '.$this->periode->nama.'.';
        $this->dispatch('tutup-modal-potong-kasbon');
        $this->batalPotong();
        $this->segarkan();
    }

    public function mintaBatalkanPotongan(int $potonganId): void
    {
        $this->resetErrorBag('potongan_batal');
        $this->pesan = null;
        $this->potonganBatalId = null;
        $this->namaBatal = '';
        $potongan = $this->potonganPeriodeIni($potonganId);

        $this->potonganBatalId = $potongan->id;
        $this->namaBatal = 'Potongan kasbon '.$potongan->kasbon->keperluan.' '.$potongan->kasbon->karyawan->nama.' Rp '.Format::angka($potongan->jumlah);
    }

    public function batalkanPotongan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $potongan = $this->potonganPeriodeIni($this->potonganBatalId ?? 0);
        $nama = $this->namaBatal;

        DB::transaction(function () use ($potongan): void {
            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::KasbonAbk,
                'Potongan kasbon '.$potongan->kasbon->karyawan->nama,
                $potongan->kasbon->keperluan.' Rp '.Format::angka($potongan->jumlah).', slip '.$this->periode->nama,
            );
            $potongan->delete();
        });

        $this->potonganBatalId = null;
        $this->namaBatal = '';
        $this->pesan = $nama.' dibatalkan. Slip gajinya tidak lagi memotong kasbon ini.';
        $this->segarkan();
    }

    public function mintaHapus(int $id): void
    {
        $kasbon = $this->kasbonDapatDiubah($id);

        $this->resetErrorBag('kasbon_hapus');
        $this->pesan = null;
        $this->kasbonHapusId = $kasbon->id;
        $this->namaHapus = 'Kasbon '.$kasbon->keperluan.' '.$kasbon->karyawan->nama;
    }

    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $kasbon = $this->kasbonDapatDiubah($this->kasbonHapusId ?? abort(404));

        if (! CicilanKasbon::bolehDihapus($kasbon)) {
            throw ValidationException::withMessages([
                'kasbon_hapus' => 'Kasbon ini sudah dipotong di slip periode yang ditutup, jadi tidak dapat dihapus.',
            ]);
        }

        $nama = $this->namaHapus;
        DB::transaction(function () use ($kasbon): void {
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::KasbonAbk, 'Kasbon '.$kasbon->karyawan->nama, self::rincian($kasbon));
            $transaksi = $kasbon->transaksiKas;
            $kasbon->delete();
            $transaksi?->delete();
        });

        $this->kasbonHapusId = null;
        $this->namaHapus = '';
        $this->pesan = $nama.' dihapus. Potongannya di slip gaji periode berjalan ikut dihapus.';
        $this->segarkan();
    }

    public function render(): View
    {
        return view('livewire.kasbon-abk');
    }

    /**
     * Kasbon farm ini yang diambil di periode terpilih dan periodenya belum ditutup.
     */
    private function kasbonDapatDiubah(int $id): Kasbon
    {
        return Kasbon::query()
            ->with(['karyawan', 'periode', 'transaksiKas', 'potongan'])
            ->where('periode_id', $this->periode?->id)
            ->whereHas('periode', fn ($query) => $query->whereNotIn('status', Periode::STATUS_TERTUTUP))
            ->findOrFail($id);
    }

    /**
     * Status tombol Potong untuk satu kasbon di periode terpilih: sudah dipotong di slip ini, dapat dipotong,
     * atau slip gajinya belum dibuat. Null bila kasbon tidak dapat dipotong di periode ini.
     *
     * @param  \Illuminate\Support\Collection<int, SlipGaji>  $slipPeriodeIni
     * @return ?array{status: string, potongan_id: ?int, jumlah: int}
     */
    private function statusPotong(Kasbon $kasbon, \Illuminate\Support\Collection $slipPeriodeIni): ?array
    {
        if (! $this->periode || $this->periode->tertutup()) {
            return null;
        }

        $slip = $slipPeriodeIni->get($kasbon->karyawan_id);
        $potongan = $slip ? $kasbon->potongan->firstWhere('slip_gaji_id', $slip->id) : null;

        return match (true) {
            $potongan !== null => ['status' => 'sudah', 'potongan_id' => $potongan->id, 'jumlah' => $potongan->jumlah],
            ! CicilanKasbon::dapatDipotongDi($kasbon, $this->periode) => null,
            $slip === null => ['status' => 'tanpa_slip', 'potongan_id' => null, 'jumlah' => 0],
            default => ['status' => 'bisa', 'potongan_id' => null, 'jumlah' => $kasbon->saranPotongan()],
        };
    }

    /**
     * Kasbon farm ini yang dapat dipotong di periode terpilih, beserta slip gaji karyawannya di periode itu.
     *
     * @return array{Kasbon, SlipGaji}
     */
    private function kasbonDanSlipUntukPotong(int $id): array
    {
        $kasbon = Kasbon::query()
            ->with(['karyawan', 'periode', 'potongan'])
            ->whereHas('periode', fn ($query) => $query->where('farm_id', $this->farm?->id))
            ->find($id);
        if (! $kasbon) {
            $this->segarkan();

            throw ValidationException::withMessages(['nilaiPotong' => 'Kasbon ini sudah tidak ada, mungkin sudah dihapus. Daftar kasbon sudah dimuat ulang.']);
        }
        $slip = CicilanKasbon::slipDi($kasbon, $this->periode);

        if (! CicilanKasbon::dapatDipotongDi($kasbon, $this->periode)) {
            throw ValidationException::withMessages(['nilaiPotong' => 'Kasbon ini sudah lunas atau diambil setelah '.$this->periode->nama.'.']);
        }
        if (! $slip) {
            throw ValidationException::withMessages(['nilaiPotong' => 'Slip gaji '.$kasbon->karyawan->nama.' di '.$this->periode->nama.' belum dibuat. Buat slipnya dulu di Payroll ABK.']);
        }
        if ($kasbon->potongan->contains('slip_gaji_id', $slip->id)) {
            throw ValidationException::withMessages(['nilaiPotong' => 'Kasbon ini sudah dipotong di slip '.$this->periode->nama.'. Ubah nominalnya di Payroll ABK.']);
        }

        return [$kasbon, $slip];
    }

    /**
     * Potongan kasbon farm ini di slip gaji periode terpilih.
     */
    /**
     * Potongan kasbon farm ini di slip gaji periode terpilih. Bila potongannya sudah tidak ada (halaman dibuka
     * sebelum potongan itu dibatalkan di tempat lain), daftar dimuat ulang dan pesan ditampilkan, bukan halaman 404.
     */
    private function potonganPeriodeIni(int $id): PotonganKasbon
    {
        $potongan = PotonganKasbon::query()
            ->with('kasbon.karyawan')
            ->whereHas('kasbon.periode', fn ($query) => $query->where('farm_id', $this->farm?->id))
            ->whereHas('slipGaji.periodeKandang', fn ($query) => $query->where('periode_id', $this->periode?->id))
            ->find($id);

        if (! $potongan) {
            $this->segarkan();

            throw ValidationException::withMessages([
                'potongan_batal' => 'Potongan ini sudah tidak ada di slip gaji, mungkin sudah dibatalkan sebelumnya. Daftar kasbon sudah dimuat ulang.',
            ]);
        }

        return $potongan;
    }

    /**
     * Buat atau perbarui transaksi Pinjaman ABK di kas operasional untuk kasbon ini; null bila uangnya dari luar kas.
     */
    private function simpanTransaksiKas(Kasbon $kasbon, Karyawan $karyawan, ?PeriodeKandang $periodeKandang): ?TransaksiKas
    {
        if (! $periodeKandang) {
            return null;
        }

        $danaTersedia = $periodeKandang->transaksiKas()->where('kategori', KategoriKas::DanaOperasional->value)->exists();
        if (! $danaTersedia) {
            throw ValidationException::withMessages([
                'dariKas' => 'Kas operasional '.$periodeKandang->kandang->nama.' belum punya dana masuk. Catat dana operasional dulu, atau catat kasbon ini dari luar kas.',
            ]);
        }

        $transaksi = $kasbon->transaksiKas ?? new TransaksiKas;
        $transaksi->fill([
            'periode_kandang_id' => $periodeKandang->id,
            'tanggal' => $kasbon->tanggal,
            'kategori' => KategoriKas::PinjamanAbk,
            'uraian' => 'Kasbon '.$kasbon->keperluan.' '.$karyawan->nama,
            'jumlah' => $kasbon->jumlah,
        ])->save();

        return $transaksi;
    }

    /**
     * Bila nominal per slip diisi, jumlah kali potongan mengikuti nominal itu dan tidak diketik.
     */
    private function samakanJumlahPotongan(): void
    {
        if ($this->nilaiPotongan > 0 && $this->jumlah > 0) {
            $this->jumlahPotongan = (string) Kasbon::kaliUntukNominal($this->jumlah, $this->nilaiPotongan);
        }
    }

    private static function rincian(Kasbon $kasbon): string
    {
        return $kasbon->keperluan.' Rp '.Format::angka($kasbon->jumlah).', '.Format::angka($kasbon->jumlah_potongan).' kali potongan gaji'
            .($kasbon->nilai_potongan ? ' Rp '.Format::angka($kasbon->nilai_potongan).' per slip' : '');
    }

    private function bersihkanForm(): void
    {
        $this->resetValidation();
        $this->kasbonId = null;
        $this->karyawanId = null;
        $this->tanggal = Carbon::today()->toDateString();
        $this->keperluan = '';
        $this->jumlah = null;
        $this->jumlahPotongan = '1';
        $this->nilaiPotongan = null;
        $this->dariKas = false;
        unset($this->karyawanTerpilih, $this->periodeKandangKas);
    }

    private function segarkan(): void
    {
        unset($this->daftar, $this->baris, $this->ringkasan, $this->slipPeriodeIni);
    }
}
