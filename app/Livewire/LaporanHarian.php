<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Periode;
use App\Support\IsianLaporanHarian;
use App\Support\LembarLaporanHarian;
use App\Support\RingkasanHarian;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('Laporan harian')]
class LaporanHarian extends Component
{
    use MemilihPeriode;

    /**
     * Tanggal laporan (Y-m-d). Kosong berarti tanggal terakhir yang punya catatan.
     */
    #[Url(as: 'tanggal')]
    public ?string $tanggal = null;

    /** Tanggal (Y-m-d) di daftar laporan yang sedang dimintai konfirmasi hapus lewat modal. */
    public ?string $tanggalDihapus = null;

    /** Tanggal (Y-m-d) laporan dari daftar yang sedang ditampilkan di modal. */
    public ?string $tanggalDilihat = null;

    /** Kabar hasil simpan atau hapus terakhir. */
    public ?string $pesan = null;

    public function mount(): void
    {
        $this->pesan = session('pesan');
    }

    #[Computed]
    public function tanggalTerakhir(): ?CarbonInterface
    {
        return $this->periodeTermuat() ? RingkasanHarian::tanggalTerakhir($this->periodeTermuat()) : null;
    }

    /**
     * Tanggal yang dipakai: pilihan pengguna bila sah dan berada di dalam periode, selain itu tanggal terakhir.
     */
    #[Computed]
    public function tanggalLaporan(): ?CarbonInterface
    {
        $terakhir = $this->tanggalTerakhir;
        if (! $terakhir) {
            return null;
        }

        $pilihan = $this->tanggal && preg_match('/^\d{4}-\d{2}-\d{2}$/', $this->tanggal) ? Carbon::parse($this->tanggal) : null;

        return $pilihan && $pilihan->betweenIncluded($this->periode->tanggal_chick_in, $terakhir) ? $pilihan : $terakhir;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function laporan(): ?array
    {
        return $this->tanggalLaporan ? RingkasanHarian::buat($this->periodeTermuat(), $this->tanggalLaporan) : null;
    }

    /**
     * Tanggal yang sudah punya laporan di periode ini, terbaru dulu.
     *
     * @return list<array<string, mixed>>
     */
    #[Computed]
    public function daftar(): array
    {
        return $this->periodeTermuat() ? IsianLaporanHarian::daftar($this->periodeTermuat()) : [];
    }

    /**
     * Laporan tanggal terpilih sebagai teks siap tampil; bahan tombol simpan dan salin PNG di halaman.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        return $this->laporan ? LembarLaporanHarian::buat($this->periode, $this->laporan) : null;
    }

    /**
     * Laporan yang dibuka dari daftar; isi modal dan bahan PNG-nya.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function dilihat(): ?array
    {
        return $this->tanggalDilihat
            ? LembarLaporanHarian::buat($this->periode, RingkasanHarian::buat($this->periodeTermuat(), Carbon::parse($this->tanggalDilihat)))
            : null;
    }

    /**
     * Tampilkan laporan satu tanggal dari daftar di modal; laporan di halaman tidak berubah.
     */
    public function buka(string $tanggal): void
    {
        $this->tanggalDilihat = $this->adaDiDaftar($tanggal) ? $tanggal : null;
    }

    /**
     * Siapkan modal konfirmasi hapus untuk satu tanggal dari daftar.
     */
    public function mintaHapus(string $tanggal): void
    {
        $this->pesan = null;
        $this->tanggalDihapus = $this->adaDiDaftar($tanggal) ? $tanggal : null;
    }

    /**
     * Tanggal yang dimintai konfirmasi hapus, untuk judul modal: 2 Oktober 2026.
     */
    #[Computed]
    public function labelTanggalDihapus(): ?string
    {
        return $this->tanggalDihapus ? Carbon::parse($this->tanggalDihapus)->translatedFormat('j F Y') : null;
    }

    /**
     * Hapus laporan yang sudah dikonfirmasi lewat mintaHapus().
     */
    public function hapus(): void
    {
        if (! $this->tanggalDihapus || ! $this->periode) {
            return;
        }

        $tanggal = Carbon::parse($this->tanggalDihapus);
        IsianLaporanHarian::hapus($this->periode, $tanggal);

        $this->pesan = 'Laporan harian '.$tanggal->translatedFormat('j F Y').' dihapus.';
        $this->tanggalDihapus = null;
        // Laporan yang sedang ditampilkan mungkin baru saja dihapus; kembali ke tanggal terakhir yang masih ada.
        $this->tanggal = null;
        $this->tanggalDilihat = null;
        unset($this->daftarPeriode, $this->periode, $this->tanggalTerakhir, $this->tanggalLaporan, $this->laporan, $this->daftar, $this->lembar, $this->dilihat, $this->labelTanggalDihapus);
    }

    public function render(): View
    {
        return view('livewire.laporan-harian');
    }

    private function adaDiDaftar(string $tanggal): bool
    {
        return collect($this->daftar)->contains(fn (array $baris): bool => $baris['tanggal']->format('Y-m-d') === $tanggal);
    }

    private function periodeTermuat(): ?Periode
    {
        return $this->periode?->loadMissing([
            'kandangPeriode.kandang',
            'kandangPeriode.recordings',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'penerimaanPakan.jenisPakan',
        ]);
    }
}
