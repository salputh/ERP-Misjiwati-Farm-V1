<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\KategoriKas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\PeriodeKandang;
use App\Models\TransaksiKas;
use App\Support\BukuKas;
use App\Support\KategoriKasTambahan;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Laporan biaya operasional satu kandang: dana masuk, pengeluaran per kategori, dan buku kas.
 */
class KasOperasional extends Component
{
    use MemilihPeriode;

    #[Locked]
    public Kandang $kandang;

    #[Locked]
    public ?int $transaksiId = null;

    #[Locked]
    public ?int $transaksiHapusId = null;

    public string $tanggal = '';

    public string $kategoriTransaksi = KategoriKas::DanaOperasional->value;

    /** True bila pengguna memilih "Kategori baru" dan mengetik namanya sendiri. */
    public bool $isiKategoriBaru = false;

    public string $namaKategoriBaru = '';

    public string $uraian = '';

    public string $jumlah = '';

    public ?string $pesan = null;

    /** Saringan buku kas: nilai KategoriKas, kosong berarti semua kategori. */
    #[Url(as: 'kategori')]
    public string $kategori = '';

    public function mount(Kandang $kandang): void
    {
        abort_unless($kandang->farm_id === $this->farm?->id, 404);

        $this->kandang = $kandang;
        $this->tanggal = now()->toDateString();
        $this->pilihKategori($this->kategori);
    }

    public function pilihKategori(string $kategori): void
    {
        $this->kategori = $this->kategoriDariNilai($kategori)?->value ?? '';
    }

    /**
     * Pilihan kategori di form transaksi. Null berarti "Kategori baru": isian nama kategori ditampilkan.
     */
    public function pakaiKategori(?string $kategori): void
    {
        $this->resetValidation(['kategoriTransaksi', 'namaKategoriBaru']);
        $this->isiKategoriBaru = $kategori === null;
        $this->kategoriTransaksi = $kategori ?? '';
        $this->namaKategoriBaru = '';
    }

    public function tambah(): void
    {
        $this->pesan = null;
        $this->transaksiHapusId = null;
        $this->bersihkanForm();
    }

    /**
     * Kandang ini pada periode terpilih; null bila kandang tidak dipakai di periode itu.
     */
    #[Computed]
    public function periodeKandang(): ?PeriodeKandang
    {
        return $this->periode?->kandangPeriode()
            ->where('kandang_id', $this->kandang->id)
            ->with('transaksiKas')
            ->first();
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function buku(): ?array
    {
        return $this->periodeKandang ? BukuKas::buat($this->periodeKandang) : null;
    }

    #[Computed]
    public function saringan(): KategoriKas|KategoriKasTambahan|null
    {
        return $this->kategoriDariNilai($this->kategori);
    }

    /**
     * Kategori tambahan yang sudah pernah dipakai di farm ini, untuk pilihan di form transaksi.
     *
     * @return list<KategoriKasTambahan>
     */
    #[Computed]
    public function kategoriTambahan(): array
    {
        return $this->farm ? KategoriKasTambahan::untukFarm($this->farm) : [];
    }

    #[Computed]
    public function kategoriTerpilih(): KategoriKas|KategoriKasTambahan|null
    {
        return $this->kategoriDariNilai($this->kategoriTransaksi);
    }

    /**
     * Kategori yang punya transaksi di buku kas ini, untuk pilihan saringan: kategori baku dulu, lalu kategori tambahan.
     *
     * @return list<KategoriKas|KategoriKasTambahan>
     */
    #[Computed]
    public function pilihanKategori(): array
    {
        $terpakai = collect($this->buku['transaksi'] ?? [])->pluck('kategori');
        $nilaiTerpakai = $terpakai->pluck('value');

        return [
            ...array_filter(KategoriKas::cases(), fn (KategoriKas $kategori): bool => $nilaiTerpakai->contains($kategori->value)),
            ...$terpakai
                ->whereInstanceOf(KategoriKasTambahan::class)
                ->unique(fn (KategoriKasTambahan $kategori): string => $kategori->value)
                ->sortBy(fn (KategoriKasTambahan $kategori): string => $kategori->value)
                ->values()
                ->all(),
        ];
    }

    /**
     * Buku kas sesuai saringan kategori, per bulan.
     *
     * @return array{bulan: list<array<string, mixed>>, jumlah: int, masuk: int, keluar: int}
     */
    #[Computed]
    public function tersaring(): array
    {
        return BukuKas::saring($this->buku['transaksi'] ?? [], $this->saringan);
    }

    /**
     * Pengeluaran dapat dipilih hanya jika masih ada setoran dana selain transaksi yang sedang diubah.
     */
    #[Computed]
    public function bolehCatatPengeluaran(): bool
    {
        return $this->periodeKandang?->transaksiKas()
            ->where('kategori', KategoriKas::DanaOperasional->value)
            ->when($this->transaksiId, fn ($query) => $query->where('id', '!=', $this->transaksiId))
            ->exists() ?? false;
    }

    public function ubah(int $id): void
    {
        $transaksi = $this->transaksiUntukPeriode($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->transaksiId = $transaksi->id;
        $this->tanggal = $transaksi->tanggal->toDateString();
        $this->kategoriTransaksi = $transaksi->kategori->value;
        $this->isiKategoriBaru = false;
        $this->namaKategoriBaru = '';
        $this->uraian = $transaksi->uraian;
        $this->jumlah = (string) $transaksi->jumlah;

        unset($this->bolehCatatPengeluaran);
    }

    public function batalUbah(): void
    {
        $this->bersihkanForm();
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $this->namaKategoriBaru = KategoriKasTambahan::rapikan($this->namaKategoriBaru);
        $data = $this->validate([
            'tanggal' => ['required', 'date'],
            'kategoriTransaksi' => $this->isiKategoriBaru ? [] : [
                'required',
                'string',
                Rule::in([...array_column(KategoriKas::cases(), 'value'), ...array_column($this->kategoriTambahan, 'value')]),
            ],
            'namaKategoriBaru' => $this->isiKategoriBaru ? ['required', 'string', 'max:50', 'regex:/^[\pL\pN .,&()\/+-]+$/u'] : [],
            'uraian' => ['required', 'string', 'max:255'],
            'jumlah' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
        ], [
            'tanggal.required' => 'Tanggal transaksi wajib diisi.',
            'tanggal.date' => 'Tanggal transaksi tidak valid.',
            'kategoriTransaksi.required' => 'Kategori transaksi wajib dipilih.',
            'kategoriTransaksi.in' => 'Kategori transaksi tidak valid.',
            'namaKategoriBaru.required' => 'Nama kategori baru wajib diisi.',
            'namaKategoriBaru.max' => 'Nama kategori maksimal 50 karakter.',
            'namaKategoriBaru.regex' => 'Nama kategori hanya boleh berisi huruf, angka, spasi, dan tanda . , & ( ) / + -',
            'uraian.required' => 'Uraian transaksi wajib diisi.',
            'uraian.max' => 'Uraian transaksi maksimal 255 karakter.',
            'jumlah.required' => 'Jumlah transaksi wajib diisi.',
            'jumlah.integer' => 'Jumlah harus berupa angka bulat dalam rupiah.',
            'jumlah.min' => 'Jumlah transaksi minimal Rp 1.',
            'jumlah.max' => 'Jumlah transaksi terlalu besar.',
        ]);

        $kategori = $this->isiKategoriBaru
            ? KategoriKasTambahan::dariNama($data['namaKategoriBaru'], $this->kategoriTambahan)
            : $this->kategoriDariNilai($data['kategoriTransaksi']);

        if ($this->isiKategoriBaru && $kategori->masuk()) {
            throw ValidationException::withMessages([
                'namaKategoriBaru' => 'Kategori baru hanya untuk pengeluaran. Pilih Dana Operasional dari daftar untuk mencatat uang masuk.',
            ]);
        }

        $periodeKandang = $this->periodeKandang ?? abort(404);
        $tanggal = Carbon::parse($data['tanggal']);
        $rincian = "{$this->kandang->nama}, {$this->periode->nama}";

        $baru = DB::transaction(function () use ($data, $kategori, $periodeKandang, $tanggal, $rincian): bool {
            $periodeKandang = PeriodeKandang::query()->lockForUpdate()->findOrFail($periodeKandang->id);
            $transaksi = $this->transaksiId
                ? $periodeKandang->transaksiKas()->whereDoesntHave('kasbon')->whereKey($this->transaksiId)->firstOrFail()
                : null;
            $danaTersedia = $periodeKandang->transaksiKas()
                ->where('kategori', KategoriKas::DanaOperasional->value)
                ->when($transaksi, fn ($query) => $query->where('id', '!=', $transaksi->id))
                ->exists();

            if (! $kategori->masuk() && ! $danaTersedia) {
                throw ValidationException::withMessages([
                    $this->isiKategoriBaru ? 'namaKategoriBaru' : 'kategoriTransaksi' => 'Masukkan dana operasional terlebih dahulu sebelum mencatat pengeluaran.',
                ]);
            }

            $baru = $transaksi === null;
            $transaksi ??= new TransaksiKas(['periode_kandang_id' => $periodeKandang->id]);
            $transaksi->fill([
                'tanggal' => $data['tanggal'],
                'kategori' => $kategori,
                'uraian' => $data['uraian'],
                'jumlah' => (int) $data['jumlah'],
            ])->save();

            Aktivitas::catat(
                $baru ? JenisAktivitas::Tambah : JenisAktivitas::Ubah,
                ModulAktivitas::KasOperasional,
                'Transaksi kas '.$tanggal->translatedFormat('j F Y'),
                $rincian,
            );

            return $baru;
        });

        $this->pesan = 'Transaksi kas '.$tanggal->translatedFormat('j F Y').($baru ? ' ditambahkan.' : ' diperbarui.');
        $this->dispatch('tutup-modal-kas');
        $this->bersihkanForm();
        $this->segarkanBuku();
    }

    public function mintaHapus(int $id): void
    {
        $this->transaksiUntukPeriode($id);
        $this->resetErrorBag('transaksi_hapus');
        $this->pesan = null;
        $this->transaksiHapusId = $id;
    }

    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $id = $this->transaksiHapusId ?? abort(404);
        $periodeKandang = $this->periodeKandang ?? abort(404);
        $rincian = "{$this->kandang->nama}, {$this->periode->nama}";

        $tanggal = DB::transaction(function () use ($id, $periodeKandang, $rincian): Carbon {
            $periodeKandang = PeriodeKandang::query()->lockForUpdate()->findOrFail($periodeKandang->id);
            $transaksi = $periodeKandang->transaksiKas()->whereDoesntHave('kasbon')->whereKey($id)->firstOrFail();

            if ($transaksi->kategori->masuk()) {
                $jumlahDanaLain = $periodeKandang->transaksiKas()
                    ->where('kategori', KategoriKas::DanaOperasional->value)
                    ->where('id', '!=', $transaksi->id)
                    ->count();
                $adaPengeluaran = $periodeKandang->transaksiKas()
                    ->where('kategori', '!=', KategoriKas::DanaOperasional->value)
                    ->exists();

                if ($jumlahDanaLain === 0 && $adaPengeluaran) {
                    throw ValidationException::withMessages([
                        'transaksi_hapus' => 'Dana operasional tidak dapat dihapus selama masih ada pengeluaran. Masukkan dana lain atau hapus pengeluaran terlebih dahulu.',
                    ]);
                }
            }

            $tanggal = $transaksi->tanggal;
            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::KasOperasional,
                'Transaksi kas '.$tanggal->translatedFormat('j F Y'),
                $rincian,
            );
            $transaksi->delete();

            return $tanggal;
        });

        $this->transaksiHapusId = null;
        $this->pesan = 'Transaksi kas '.$tanggal->translatedFormat('j F Y').' dihapus.';
        $this->resetErrorBag('transaksi_hapus');
        $this->segarkanBuku();
    }

    public function render(): View
    {
        return view('livewire.kas-operasional')->title('Kas operasional '.$this->kandang->nama);
    }

    /**
     * Transaksi kas kandang periode ini yang dapat diubah dari buku kas. Transaksi milik kasbon ABK
     * hanya diubah dari halaman Kasbon ABK supaya jumlahnya tetap sama dengan kasbonnya.
     */
    private function transaksiUntukPeriode(int $id): TransaksiKas
    {
        return ($this->periodeKandang ?? abort(404))
            ->transaksiKas()
            ->whereDoesntHave('kasbon')
            ->whereKey($id)
            ->firstOrFail();
    }

    /**
     * Id transaksi buku kas ini yang dicatat dari halaman Kasbon ABK.
     *
     * @return list<int>
     */
    #[Computed]
    public function transaksiKasbon(): array
    {
        return $this->periodeKandang?->transaksiKas()->has('kasbon')->pluck('id')->all() ?? [];
    }

    /**
     * Kategori baku atau kategori tambahan farm ini untuk sebuah nilai; null bila tidak dikenal.
     */
    private function kategoriDariNilai(string $nilai): KategoriKas|KategoriKasTambahan|null
    {
        return KategoriKas::tryFrom($nilai)
            ?? collect($this->kategoriTambahan)->first(fn (KategoriKasTambahan $kategori): bool => $kategori->value === $nilai);
    }

    private function bersihkanForm(): void
    {
        $this->resetValidation();
        $this->transaksiId = null;
        $this->tanggal = now()->toDateString();
        $this->kategoriTransaksi = KategoriKas::DanaOperasional->value;
        $this->isiKategoriBaru = false;
        $this->namaKategoriBaru = '';
        $this->uraian = '';
        $this->jumlah = '';

        unset($this->bolehCatatPengeluaran);
    }

    private function segarkanBuku(): void
    {
        unset($this->periodeKandang, $this->transaksiKasbon, $this->buku, $this->saringan, $this->kategoriTambahan, $this->kategoriTerpilih, $this->pilihanKategori, $this->tersaring, $this->bolehCatatPengeluaran);
    }
}
