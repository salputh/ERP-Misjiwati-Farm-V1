<?php

namespace App\Livewire;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Enums\PeranBagiHasil;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\Karyawan;
use App\Models\PenerimaBagiHasil;
use App\Models\PeriodeKandang;
use App\Models\PotonganKasbon;
use App\Models\SlipGaji;
use App\Models\TransaksiKas;
use App\Support\Format;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Slip gaji ABK satu periode: rekap per orang dan slip tiap orang, bisa disaring per kandang.
 * Slip dibuat sekaligus untuk ABK di lembar bagi hasil kandangnya; komponen per orang lalu diisi lewat form ubah.
 */
#[Title('Payroll ABK')]
class PayrollAbk extends Component
{
    use MemilihPeriode;

    /** Saringan kandang (id periode_kandang); null berarti semua kandang. */
    #[Url(as: 'kandang')]
    public ?int $periodeKandangId = null;

    public ?string $pesan = null;

    #[Locked]
    public ?int $slipId = null;

    /** Slip ABK yang ikut bagi hasil tidak memakai gaji pokok; joker memakainya. */
    #[Locked]
    public bool $slipIkutBagiHasil = true;

    public string $namaSlip = '';

    /**
     * Isian form ubah slip, kuncinya kolom slip_gajis.
     *
     * @var array<string, string>
     */
    public array $isian = [];

    /**
     * Potongan kasbon di slip yang sedang diubah, kuncinya id potongan_kasbons.
     *
     * @var array<int, string>
     */
    public array $isianKasbon = [];

    /**
     * Keterangan dan batas tiap potongan kasbon di form ubah: batasnya sisa kasbon sebelum slip ini.
     *
     * @var array<int, array{label: string, keterangan: string, maks: int}>
     */
    #[Locked]
    public array $kasbonSlip = [];

    /**
     * Uang makan slip yang sedang diubah, hanya untuk ditampilkan: dari kas operasional, atau angka tersimpan
     * bila belum ada transaksi Pinjaman Makan atas namanya.
     *
     * @var array{jumlah: int, transaksi: int, dari_kas: bool}|array{}
     */
    #[Locked]
    public array $uangMakanSlip = [];

    #[Locked]
    public ?int $slipHapusId = null;

    public string $namaHapus = '';

    /** Kolom rupiah slip yang diisi per orang. Uang makan tidak diketik: diambil dari kas operasional. */
    private const KOLOM_RUPIAH = ['gaji_pokok', 'premi_pemeliharaan', 'premi_panen', 'premi_geomembran', 'penghasilan_kotoran', 'pinjaman', 'potongan_lain'];

    public function pilihKandang(?int $periodeKandangId = null): void
    {
        $this->periodeKandangId = $periodeKandangId;
    }

    /**
     * Kandang periode terpilih yang punya slip gaji, urut nama.
     *
     * @return Collection<int, PeriodeKandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        if (! $this->periode) {
            return new Collection;
        }

        return $this->periode->kandangPeriode()
            ->has('slipGaji')
            ->with(['kandang', 'slipGaji.penerimaBagiHasil', 'slipGaji.potonganKasbon.kasbon.potongan', 'bagiHasil.penerima'])
            ->get()
            ->sortBy('kandang.nama')
            ->values();
    }

    #[Computed]
    public function terpilih(): ?PeriodeKandang
    {
        return $this->daftarKandang->firstWhere('id', $this->periodeKandangId);
    }

    /**
     * Slip gaji kandang terpilih, atau semua kandang bila tidak disaring.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        if ($this->daftarKandang->isEmpty()) {
            return null;
        }

        $rhpp = LembarRhpp::real($this->periode->loadMissing(LembarRhpp::RELASI));

        return LembarPayroll::buat($this->terpilih ? $this->daftarKandang->where('id', $this->terpilih->id) : $this->daftarKandang, $rhpp);
    }

    /**
     * Kandang periode ini yang punya ABK di lembar bagi hasil tetapi belum punya slip gaji.
     *
     * @return list<array{periode_kandang: PeriodeKandang, abk: SupportCollection<int, PenerimaBagiHasil>}>
     */
    #[Computed]
    public function kandangBelumAdaSlip(): array
    {
        if (! $this->periode) {
            return [];
        }

        return $this->periode->kandangPeriode()
            ->with(['kandang', 'slipGaji', 'bagiHasil.penerima'])
            ->get()
            ->sortBy('kandang.nama')
            ->map(fn (PeriodeKandang $satu): array => ['periode_kandang' => $satu, 'abk' => self::abkTanpaSlip($satu)])
            ->filter(fn (array $satu): bool => $satu['abk']->isNotEmpty())
            ->values()
            ->all();
    }

    /**
     * Buat slip untuk setiap ABK bagi hasil kandang ini yang belum punya slip. Pinjaman terisi dari
     * pinjaman karyawan/ABK atas namanya di kas operasional; komponen lain diisi lewat form ubah.
     */
    public function buatSlip(int $periodeKandangId): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $this->pesan = null;

        $periodeKandang = $this->periode?->kandangPeriode()
            ->with(['kandang', 'periode', 'slipGaji', 'bagiHasil.penerima', 'transaksiKas.kasbon'])
            ->findOrFail($periodeKandangId) ?? abort(404);

        $jumlah = DB::transaction(function () use ($periodeKandang): int {
            $abk = self::abkTanpaSlip($periodeKandang);
            $urutan = (int) $periodeKandang->slipGaji->max('urutan');

            foreach ($abk as $penerima) {
                SlipGaji::create([
                    'periode_kandang_id' => $periodeKandang->id,
                    'penerima_bagi_hasil_id' => $penerima->id,
                    'karyawan_id' => self::karyawanUntuk($periodeKandang, $penerima->nama),
                    'nama' => $penerima->nama,
                    'jabatan' => Jabatan::Abk,
                    'hari_kerja' => 0,
                    'pinjaman' => self::pinjamanDariKas($periodeKandang, $penerima->nama),
                    'urutan' => ++$urutan,
                ]);
            }

            if ($abk->isNotEmpty()) {
                Aktivitas::catat(
                    JenisAktivitas::Tambah,
                    ModulAktivitas::PayrollAbk,
                    'Slip gaji '.$periodeKandang->kandang->nama,
                    $abk->count().' ABK, '.$this->periode->nama,
                );
            }

            return $abk->count();
        });

        $this->pesan = $jumlah > 0
            ? "Slip gaji {$jumlah} ABK {$periodeKandang->kandang->nama} dibuat. Lengkapi hari kerja dan komponen lain lewat tombol ubah di tiap slip."
            : "Semua ABK {$periodeKandang->kandang->nama} sudah punya slip gaji.";
        $this->periodeKandangId = $periodeKandang->id;
        $this->segarkan();
    }

    public function ubah(int $id): void
    {
        $slip = $this->slipPeriodeIni($id);
        $slip->load('potonganKasbon.kasbon.potongan');

        $this->resetValidation();
        $this->pesan = null;
        $this->slipId = $slip->id;
        $this->slipIkutBagiHasil = $slip->penerima_bagi_hasil_id !== null;
        $this->namaSlip = $slip->nama;
        $this->isian = [
            'hari_kerja' => (string) $slip->hari_kerja,
            ...collect(self::KOLOM_RUPIAH)->mapWithKeys(fn (string $kolom): array => [$kolom => (string) $slip->{$kolom}])->all(),
            'keterangan_potongan_lain' => (string) $slip->keterangan_potongan_lain,
        ];
        $uangMakanKas = LembarPayroll::uangMakanDariKas($slip->periodeKandang)[$slip->id] ?? null;
        $this->uangMakanSlip = $uangMakanKas
            ? [...$uangMakanKas, 'dari_kas' => true]
            : ['jumlah' => (int) $slip->uang_makan, 'transaksi' => 0, 'dari_kas' => false];
        $this->isianKasbon = $slip->potonganKasbon->mapWithKeys(fn (PotonganKasbon $potongan): array => [$potongan->id => (string) $potongan->jumlah])->all();
        $this->kasbonSlip = $slip->potonganKasbon->mapWithKeys(function (PotonganKasbon $potongan): array {
            $kasbon = $potongan->kasbon;
            $sisaSebelum = $kasbon->jumlah - (int) $kasbon->potongan->where('id', '!=', $potongan->id)->sum('jumlah');

            return [$potongan->id => [
                'label' => 'Kasbon '.$kasbon->keperluan.' (Rp)',
                'keterangan' => 'Kasbon Rp '.Format::angka($kasbon->jumlah).', '
                    .($kasbon->nilai_potongan ? 'Rp '.Format::angka($kasbon->nilai_potongan).' per slip' : Format::angka($kasbon->jumlah_potongan).' kali potongan')
                    .'. Sisa sebelum slip ini Rp '.Format::angka($sisaSebelum).'.',
                'maks' => max(0, $sisaSebelum),
            ]];
        })->all();
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->slipId = null;
        $this->namaSlip = '';
        $this->isian = [];
        $this->uangMakanSlip = [];
        $this->isianKasbon = [];
        $this->kasbonSlip = [];
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $slip = $this->slipPeriodeIni($this->slipId ?? abort(404));
        $this->isian['keterangan_potongan_lain'] = trim($this->isian['keterangan_potongan_lain'] ?? '');

        $rupiah = ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX];
        $tervalidasi = $this->validate([
            'isian.hari_kerja' => ['required', 'integer', 'min:0', 'max:366'],
            ...collect(self::KOLOM_RUPIAH)->mapWithKeys(fn (string $kolom): array => ["isian.{$kolom}" => $rupiah])->all(),
            'isian.keterangan_potongan_lain' => ['nullable', 'string', 'max:255'],
            ...collect($this->kasbonSlip)->mapWithKeys(fn (array $kasbon, int $id): array => ["isianKasbon.{$id}" => ['required', 'integer', 'min:0', 'max:'.$kasbon['maks']]])->all(),
        ], [
            'isianKasbon.*.required' => 'Potongan kasbon wajib diisi; isi 0 bila tidak dipotong di slip ini.',
            'isianKasbon.*.integer' => 'Masukkan angka bulat.',
            'isianKasbon.*.min' => 'Nilai tidak boleh negatif.',
            'isianKasbon.*.max' => 'Potongan tidak boleh melebihi sisa kasbon.',
            'isian.*.required' => 'Nilai ini wajib diisi.',
            'isian.*.integer' => 'Masukkan angka bulat.',
            'isian.*.min' => 'Nilai tidak boleh negatif.',
            'isian.*.max' => 'Nilai terlalu besar.',
            'isian.hari_kerja.max' => 'Hari kerja maksimal 366 hari.',
            'isian.keterangan_potongan_lain.max' => 'Keterangan maksimal 255 karakter.',
        ]);
        $data = $tervalidasi['isian'];
        $potonganKasbon = $tervalidasi['isianKasbon'] ?? [];

        DB::transaction(function () use ($slip, $data, $potonganKasbon): void {
            $slip->fill([
                'hari_kerja' => (int) $data['hari_kerja'],
                ...collect(self::KOLOM_RUPIAH)->mapWithKeys(fn (string $kolom): array => [$kolom => (int) $data[$kolom]])->all(),
                'keterangan_potongan_lain' => $data['keterangan_potongan_lain'] ?: null,
            ]);

            $kasbonBerubah = false;
            foreach ($slip->potonganKasbon()->whereKey(array_keys($potonganKasbon))->get() as $potongan) {
                $potongan->jumlah = (int) $potonganKasbon[$potongan->id];
                $kasbonBerubah = $potongan->isDirty() || $kasbonBerubah;
                $potongan->save();
            }

            if (! $slip->isDirty() && ! $kasbonBerubah) {
                return;
            }

            $slip->save();
            Aktivitas::catat(JenisAktivitas::Ubah, ModulAktivitas::PayrollAbk, 'Slip gaji '.$slip->nama, $slip->periodeKandang->kandang->nama.', '.$this->periode->nama);
        });

        $this->pesan = 'Slip gaji '.$slip->nama.' diperbarui.';
        $this->dispatch('tutup-modal-slip');
        $this->batal();
        $this->segarkan();
    }

    public function mintaHapus(int $id): void
    {
        $slip = $this->slipPeriodeIni($id);

        $this->pesan = null;
        $this->slipHapusId = $slip->id;
        $this->namaHapus = $slip->nama;
    }

    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $slip = $this->slipPeriodeIni($this->slipHapusId ?? abort(404));
        $nama = $slip->nama;

        DB::transaction(function () use ($slip): void {
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::PayrollAbk, 'Slip gaji '.$slip->nama, $slip->periodeKandang->kandang->nama.', '.$this->periode->nama);
            $slip->delete();
        });

        $this->slipHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Slip gaji '.$nama.' dihapus.';
        $this->segarkan();
    }

    public function render(): View
    {
        return view('livewire.payroll-abk');
    }

    private function slipPeriodeIni(int $id): SlipGaji
    {
        return SlipGaji::query()
            ->with('periodeKandang.kandang')
            ->whereHas('periodeKandang', fn ($query) => $query->where('periode_id', $this->periode?->id))
            ->findOrFail($id);
    }

    /**
     * ABK di lembar bagi hasil kandang ini yang belum punya slip (dicocokkan dengan penerima atau namanya).
     *
     * @return SupportCollection<int, PenerimaBagiHasil>
     */
    private static function abkTanpaSlip(PeriodeKandang $periodeKandang): SupportCollection
    {
        $abk = $periodeKandang->bagiHasil?->penerimaBerperan(PeranBagiHasil::Abk) ?? collect();
        $penerimaBerslip = $periodeKandang->slipGaji->pluck('penerima_bagi_hasil_id')->filter();
        $namaBerslip = $periodeKandang->slipGaji->pluck('nama')->map(fn (string $nama): string => mb_strtolower($nama));

        return $abk
            ->reject(fn (PenerimaBagiHasil $satu): bool => $penerimaBerslip->contains($satu->id) || $namaBerslip->contains(mb_strtolower($satu->nama)))
            ->values();
    }

    /**
     * Jumlah pinjaman karyawan dan pinjaman ABK di kas operasional kandang ini yang uraiannya memuat nama orang itu.
     * Transaksi milik kasbon tidak dihitung di sini; kasbon dipotong bertahap lewat potongan kasbon.
     */
    private static function pinjamanDariKas(PeriodeKandang $periodeKandang, string $nama): int
    {
        $pola = '/\b'.preg_quote(mb_strtolower($nama), '/').'\b/u';

        return (int) $periodeKandang->transaksiKas
            ->filter(fn (TransaksiKas $satu): bool => in_array($satu->kategori, [KategoriKas::PinjamanKaryawan, KategoriKas::PinjamanAbk], true)
                && $satu->kasbon === null
                && preg_match($pola, mb_strtolower($satu->uraian)) === 1)
            ->sum('jumlah');
    }

    /**
     * Karyawan kandang ini untuk nama di lembar bagi hasil: nama yang sama persis, atau satu-satunya karyawan
     * kandang ini yang namanya mengandung nama itu sebagai kata utuh (mis. "Frengky" untuk "Frengky Marpaung").
     */
    private static function karyawanUntuk(PeriodeKandang $periodeKandang, string $nama): ?int
    {
        $karyawan = Karyawan::query()->where('kandang_id', $periodeKandang->kandang_id)->get(['id', 'nama']);
        $sama = $karyawan->first(fn (Karyawan $satu): bool => mb_strtolower($satu->nama) === mb_strtolower($nama));
        if ($sama) {
            return $sama->id;
        }

        $pola = '/\b'.preg_quote(mb_strtolower($nama), '/').'\b/u';
        $mirip = $karyawan->filter(fn (Karyawan $satu): bool => preg_match($pola, mb_strtolower($satu->nama)) === 1);

        return $mirip->count() === 1 ? $mirip->first()->id : null;
    }

    private function segarkan(): void
    {
        unset($this->daftarKandang, $this->terpilih, $this->lembar, $this->kandangBelumAdaSlip);
    }
}
