<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\KohePenjualan;
use App\Models\KoheStok;
use App\Support\Format;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Kohe (kotoran hewan): stok karung yang masuk dari kandang dan penjualannya kepada pembeli.
 * Dicatat per farm tanpa batas periode, karena karung bisa terjual setelah periode berganti.
 */
#[Title('Kohe')]
class Kohe extends Component
{
    use MemilihPeriode;

    #[Locked]
    public ?int $stokId = null;

    public string $tanggalStok = '';

    public ?int $kandangStokId = null;

    public ?int $jumlahKarungStok = null;

    public string $keteranganStok = '';

    #[Locked]
    public ?int $penjualanId = null;

    public string $tanggalPenjualan = '';

    public string $namaPembeli = '';

    public ?int $jumlahKarungJual = null;

    public ?int $hargaPerKarung = null;

    /** Data yang akan dihapus: "stok" atau "penjualan". */
    #[Locked]
    public ?string $hapusJenis = null;

    #[Locked]
    public ?int $hapusId = null;

    public string $hapusLabel = '';

    public ?string $pesan = null;

    /**
     * Angka ringkasan: karung masuk, terjual, tersedia, dan nilai penjualan.
     *
     * @return array{masuk: int, terjual: int, tersedia: int, pendapatan: int, pembeli: int}
     */
    #[Computed]
    public function ringkasan(): array
    {
        $masuk = (int) $this->stokQuery()->sum('jumlah_karung');
        $terjual = (int) $this->penjualanQuery()->sum('jumlah_karung');

        return [
            'masuk' => $masuk,
            'terjual' => $terjual,
            'tersedia' => $masuk - $terjual,
            'pendapatan' => (int) $this->penjualanQuery()->sum(DB::raw('jumlah_karung * harga_per_karung')),
            'pembeli' => $this->penjualanQuery()->distinct()->count('nama_pembeli'),
        ];
    }

    /**
     * @return Collection<int, KoheStok>
     */
    #[Computed]
    public function daftarStok(): Collection
    {
        return $this->stokQuery()->with('kandang')->orderByDesc('tanggal')->orderByDesc('id')->get();
    }

    /**
     * @return Collection<int, KohePenjualan>
     */
    #[Computed]
    public function daftarPenjualan(): Collection
    {
        return $this->penjualanQuery()->orderByDesc('tanggal')->orderByDesc('id')->get();
    }

    /**
     * @return Collection<int, Kandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        return $this->farm ? $this->farm->kandangs()->orderBy('nama')->get() : new Collection;
    }

    /**
     * Total penjualan di form: jumlah karung × harga per karung.
     */
    #[Computed]
    public function totalForm(): int
    {
        return ($this->jumlahKarungJual ?? 0) * ($this->hargaPerKarung ?? 0);
    }

    /**
     * Karung yang bisa dijual di form; saat mengubah, karung penjualan itu sendiri ikut dihitung tersedia.
     */
    #[Computed]
    public function tersediaUntukForm(): int
    {
        $lama = $this->penjualanId ? (int) $this->penjualanQuery()->whereKey($this->penjualanId)->value('jumlah_karung') : 0;

        return $this->ringkasan['tersedia'] + $lama;
    }

    public function tambahStok(): void
    {
        $this->resetFormStok();
        $this->pesan = null;
        $this->tanggalStok = today()->toDateString();
    }

    public function ubahStok(int $id): void
    {
        $stok = $this->stokQuery()->findOrFail($id);

        $this->resetFormStok();
        $this->pesan = null;
        $this->stokId = $stok->id;
        $this->tanggalStok = $stok->tanggal->toDateString();
        $this->kandangStokId = $stok->kandang_id;
        $this->jumlahKarungStok = $stok->jumlah_karung;
        $this->keteranganStok = $stok->keterangan ?? '';
    }

    public function simpanStok(): void
    {
        $this->keteranganStok = trim($this->keteranganStok);
        $data = $this->validate([
            'tanggalStok' => ['required', 'date'],
            'kandangStokId' => ['nullable', 'integer', Rule::exists('kandangs', 'id')->where('farm_id', $this->farm?->id)],
            'jumlahKarungStok' => ['required', 'integer', 'min:1', 'max:1000000'],
            'keteranganStok' => ['nullable', 'string', 'max:255'],
        ], [
            'tanggalStok.required' => 'Pilih tanggal stok masuk.',
            'kandangStokId.exists' => 'Kandang tidak ditemukan di farm ini.',
            'jumlahKarungStok.required' => 'Isi jumlah karung.',
            'jumlahKarungStok.min' => 'Jumlah karung minimal 1.',
            'jumlahKarungStok.max' => 'Jumlah karung terlalu besar.',
            'keteranganStok.max' => 'Keterangan maksimal 255 karakter.',
        ]);

        $mengubah = $this->stokId !== null;
        $stok = $mengubah ? $this->stokQuery()->findOrFail($this->stokId) : new KoheStok(['farm_id' => $this->farm?->id ?? abort(404)]);

        // Stok tidak boleh turun di bawah karung yang sudah terjual.
        $selisih = $data['jumlahKarungStok'] - ($mengubah ? $stok->jumlah_karung : 0);
        if ($this->ringkasan['tersedia'] + $selisih < 0) {
            throw ValidationException::withMessages([
                'jumlahKarungStok' => 'Stok tidak boleh kurang dari karung yang sudah terjual. Minimal '.Format::angka($stok->jumlah_karung - $this->ringkasan['tersedia']).' karung.',
            ]);
        }

        $stok->fill([
            'tanggal' => $data['tanggalStok'],
            'kandang_id' => $data['kandangStokId'],
            'jumlah_karung' => $data['jumlahKarungStok'],
            'keterangan' => filled($data['keteranganStok']) ? $data['keteranganStok'] : null,
        ]);

        if (! $mengubah || $stok->isDirty()) {
            DB::transaction(function () use ($stok, $mengubah): void {
                $stok->save();
                Aktivitas::catat(
                    $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                    ModulAktivitas::Kohe,
                    'Stok kohe '.$stok->tanggal->translatedFormat('j F Y'),
                    $this->rincianStok($stok),
                );
            });
        }

        $this->pesan = 'Stok kohe '.Format::angka($stok->jumlah_karung).' karung '.($mengubah ? 'diperbarui.' : 'dicatat.');
        $this->dispatch('tutup-modal-kohe-stok');
        $this->resetFormStok();
        $this->segarkan();
    }

    public function tambahPenjualan(): void
    {
        $this->resetFormPenjualan();
        $this->pesan = null;
        $this->tanggalPenjualan = today()->toDateString();
    }

    public function ubahPenjualan(int $id): void
    {
        $penjualan = $this->penjualanQuery()->findOrFail($id);

        $this->resetFormPenjualan();
        $this->pesan = null;
        $this->penjualanId = $penjualan->id;
        $this->tanggalPenjualan = $penjualan->tanggal->toDateString();
        $this->namaPembeli = $penjualan->nama_pembeli;
        $this->jumlahKarungJual = $penjualan->jumlah_karung;
        $this->hargaPerKarung = $penjualan->harga_per_karung;
    }

    public function simpanPenjualan(): void
    {
        $this->namaPembeli = trim($this->namaPembeli);
        $data = $this->validate([
            'tanggalPenjualan' => ['required', 'date'],
            'namaPembeli' => ['required', 'string', 'max:150'],
            'jumlahKarungJual' => ['required', 'integer', 'min:1', 'max:'.$this->tersediaUntukForm],
            'hargaPerKarung' => ['required', 'integer', 'min:1', 'max:100000000'],
        ], [
            'tanggalPenjualan.required' => 'Pilih tanggal penjualan.',
            'namaPembeli.required' => 'Isi nama pembeli.',
            'namaPembeli.max' => 'Nama pembeli maksimal 150 karakter.',
            'jumlahKarungJual.required' => 'Isi jumlah karung yang dijual.',
            'jumlahKarungJual.min' => 'Jumlah karung minimal 1.',
            'jumlahKarungJual.max' => 'Stok tersedia hanya '.Format::angka($this->tersediaUntukForm).' karung.',
            'hargaPerKarung.required' => 'Isi harga jual per karung.',
            'hargaPerKarung.min' => 'Harga jual minimal Rp 1.',
            'hargaPerKarung.max' => 'Harga jual terlalu besar.',
        ]);

        $mengubah = $this->penjualanId !== null;
        $penjualan = $mengubah ? $this->penjualanQuery()->findOrFail($this->penjualanId) : new KohePenjualan(['farm_id' => $this->farm?->id ?? abort(404)]);
        $penjualan->fill([
            'tanggal' => $data['tanggalPenjualan'],
            'nama_pembeli' => $data['namaPembeli'],
            'jumlah_karung' => $data['jumlahKarungJual'],
            'harga_per_karung' => $data['hargaPerKarung'],
        ]);

        if (! $mengubah || $penjualan->isDirty()) {
            DB::transaction(function () use ($penjualan, $mengubah): void {
                $penjualan->save();
                Aktivitas::catat(
                    $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                    ModulAktivitas::Kohe,
                    'Penjualan kohe ke '.$penjualan->nama_pembeli,
                    $this->rincianPenjualan($penjualan),
                );
            });
        }

        $this->pesan = 'Penjualan kohe ke '.$penjualan->nama_pembeli.($mengubah ? ' diperbarui.' : ' dicatat.');
        $this->dispatch('tutup-modal-kohe-penjualan');
        $this->resetFormPenjualan();
        $this->segarkan();
    }

    public function mintaHapusStok(int $id): void
    {
        $stok = $this->stokQuery()->findOrFail($id);

        $this->pesan = null;
        $this->hapusJenis = 'stok';
        $this->hapusId = $stok->id;
        $this->hapusLabel = 'Stok masuk '.$stok->tanggal->translatedFormat('j F Y').' ('.Format::angka($stok->jumlah_karung).' karung)';
    }

    public function mintaHapusPenjualan(int $id): void
    {
        $penjualan = $this->penjualanQuery()->findOrFail($id);

        $this->pesan = null;
        $this->hapusJenis = 'penjualan';
        $this->hapusId = $penjualan->id;
        $this->hapusLabel = 'Penjualan ke '.$penjualan->nama_pembeli.' tanggal '.$penjualan->tanggal->translatedFormat('j F Y');
    }

    public function hapus(): void
    {
        if ($this->hapusJenis === 'stok') {
            $stok = $this->stokQuery()->with('kandang')->findOrFail($this->hapusId);

            if ($this->ringkasan['tersedia'] < $stok->jumlah_karung) {
                $this->batalHapus();
                $this->addError('hapus', 'Stok ini tidak bisa dihapus karena sebagian karungnya sudah terjual. Hapus atau kurangi penjualannya dulu.');

                return;
            }

            DB::transaction(function () use ($stok): void {
                $stok->delete();
                Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Kohe, 'Stok kohe '.$stok->tanggal->translatedFormat('j F Y'), $this->rincianStok($stok));
            });
            $this->pesan = 'Stok kohe '.Format::angka($stok->jumlah_karung).' karung dihapus.';
        } elseif ($this->hapusJenis === 'penjualan') {
            $penjualan = $this->penjualanQuery()->findOrFail($this->hapusId);

            DB::transaction(function () use ($penjualan): void {
                $penjualan->delete();
                Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Kohe, 'Penjualan kohe ke '.$penjualan->nama_pembeli, $this->rincianPenjualan($penjualan));
            });
            $this->pesan = 'Penjualan kohe ke '.$penjualan->nama_pembeli.' dihapus.';
        }

        $this->batalHapus();
        $this->segarkan();
    }

    public function render(): View
    {
        return view('livewire.kohe');
    }

    private function batalHapus(): void
    {
        $this->hapusJenis = null;
        $this->hapusId = null;
        $this->hapusLabel = '';
    }

    /**
     * "120 karung, Kandang 1".
     */
    private function rincianStok(KoheStok $stok): string
    {
        return Format::angka($stok->jumlah_karung).' karung, '.($stok->kandang()->value('nama') ?? 'tanpa kandang asal');
    }

    /**
     * "24 Oktober 2026, 50 karung × Rp 12.000".
     */
    private function rincianPenjualan(KohePenjualan $penjualan): string
    {
        return $penjualan->tanggal->translatedFormat('j F Y').', '.Format::angka($penjualan->jumlah_karung).' karung × Rp '.Format::angka($penjualan->harga_per_karung);
    }

    /**
     * @return Builder<KoheStok>
     */
    private function stokQuery(): Builder
    {
        return KoheStok::query()->where('farm_id', $this->farm?->id);
    }

    /**
     * @return Builder<KohePenjualan>
     */
    private function penjualanQuery(): Builder
    {
        return KohePenjualan::query()->where('farm_id', $this->farm?->id);
    }

    private function segarkan(): void
    {
        unset($this->ringkasan, $this->daftarStok, $this->daftarPenjualan, $this->tersediaUntukForm);
    }

    private function resetFormStok(): void
    {
        $this->resetValidation();
        $this->stokId = null;
        $this->tanggalStok = '';
        $this->kandangStokId = null;
        $this->jumlahKarungStok = null;
        $this->keteranganStok = '';
    }

    private function resetFormPenjualan(): void
    {
        $this->resetValidation();
        $this->penjualanId = null;
        $this->tanggalPenjualan = '';
        $this->namaPembeli = '';
        $this->jumlahKarungJual = null;
        $this->hargaPerKarung = null;
    }
}
