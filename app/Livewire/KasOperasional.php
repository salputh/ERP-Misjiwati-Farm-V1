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
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
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

    public string $uraian = '';

    public string $jumlah = '';

    public ?string $pesan = null;

    /** Saringan buku kas: nilai KategoriKas, kosong berarti semua kategori. */
    #[Url(as: 'kategori')]
    public string $kategori = '';

    public function mount(Kandang $kandang): void
    {
        $this->kandang = $kandang;
        $this->tanggal = now()->toDateString();
        $this->pilihKategori($this->kategori);
    }

    public function pilihKategori(string $kategori): void
    {
        $this->kategori = KategoriKas::tryFrom($kategori)?->value ?? '';
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
    public function saringan(): ?KategoriKas
    {
        return KategoriKas::tryFrom($this->kategori);
    }

    /**
     * Kategori yang punya transaksi di buku kas ini, untuk pilihan saringan.
     *
     * @return list<KategoriKas>
     */
    #[Computed]
    public function pilihanKategori(): array
    {
        $terpakai = collect($this->buku['transaksi'] ?? [])->pluck('kategori');

        return array_values(array_filter(KategoriKas::cases(), fn (KategoriKas $kategori): bool => $terpakai->contains($kategori)));
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
        $data = $this->validate([
            'tanggal' => ['required', 'date'],
            'kategoriTransaksi' => ['required', 'string', 'in:'.implode(',', array_column(KategoriKas::cases(), 'value'))],
            'uraian' => ['required', 'string', 'max:255'],
            'jumlah' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
        ], [
            'tanggal.required' => 'Tanggal transaksi wajib diisi.',
            'tanggal.date' => 'Tanggal transaksi tidak valid.',
            'kategoriTransaksi.required' => 'Kategori transaksi wajib dipilih.',
            'kategoriTransaksi.in' => 'Kategori transaksi tidak valid.',
            'uraian.required' => 'Uraian transaksi wajib diisi.',
            'uraian.max' => 'Uraian transaksi maksimal 255 karakter.',
            'jumlah.required' => 'Jumlah transaksi wajib diisi.',
            'jumlah.integer' => 'Jumlah harus berupa angka bulat dalam rupiah.',
            'jumlah.min' => 'Jumlah transaksi minimal Rp 1.',
            'jumlah.max' => 'Jumlah transaksi terlalu besar.',
        ]);

        $periodeKandang = $this->periodeKandang ?? abort(404);
        $tanggal = Carbon::parse($data['tanggal']);
        $rincian = "{$this->kandang->nama}, {$this->periode->nama}";

        $baru = DB::transaction(function () use ($data, $periodeKandang, $tanggal, $rincian): bool {
            $periodeKandang = PeriodeKandang::query()->lockForUpdate()->findOrFail($periodeKandang->id);
            $transaksi = $this->transaksiId
                ? $periodeKandang->transaksiKas()->whereKey($this->transaksiId)->firstOrFail()
                : null;
            $kategori = KategoriKas::from($data['kategoriTransaksi']);
            $danaTersedia = $periodeKandang->transaksiKas()
                ->where('kategori', KategoriKas::DanaOperasional->value)
                ->when($transaksi, fn ($query) => $query->where('id', '!=', $transaksi->id))
                ->exists();

            if (! $kategori->masuk() && ! $danaTersedia) {
                throw ValidationException::withMessages([
                    'kategoriTransaksi' => 'Masukkan dana operasional terlebih dahulu sebelum mencatat pengeluaran.',
                ]);
            }

            $baru = $transaksi === null;
            $transaksi ??= new TransaksiKas(['periode_kandang_id' => $periodeKandang->id]);
            $transaksi->fill([
                'tanggal' => $data['tanggal'],
                'kategori' => $data['kategoriTransaksi'],
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
        $id = $this->transaksiHapusId ?? abort(404);
        $periodeKandang = $this->periodeKandang ?? abort(404);
        $rincian = "{$this->kandang->nama}, {$this->periode->nama}";

        $tanggal = DB::transaction(function () use ($id, $periodeKandang, $rincian): Carbon {
            $periodeKandang = PeriodeKandang::query()->lockForUpdate()->findOrFail($periodeKandang->id);
            $transaksi = $periodeKandang->transaksiKas()->whereKey($id)->firstOrFail();

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

    private function transaksiUntukPeriode(int $id): TransaksiKas
    {
        return ($this->periodeKandang ?? abort(404))
            ->transaksiKas()
            ->whereKey($id)
            ->firstOrFail();
    }

    private function bersihkanForm(): void
    {
        $this->resetValidation();
        $this->transaksiId = null;
        $this->tanggal = now()->toDateString();
        $this->kategoriTransaksi = KategoriKas::DanaOperasional->value;
        $this->uraian = '';
        $this->jumlah = '';

        unset($this->bolehCatatPengeluaran);
    }

    private function segarkanBuku(): void
    {
        unset($this->periodeKandang, $this->buku, $this->saringan, $this->pilihanKategori, $this->tersaring, $this->bolehCatatPengeluaran);
    }
}
