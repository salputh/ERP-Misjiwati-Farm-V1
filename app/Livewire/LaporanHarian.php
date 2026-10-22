<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Periode;
use App\Support\IsianLaporanHarian;
use App\Support\LembarLaporanHarian;
use App\Support\RingkasanHarian;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
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

    /**
     * @var list<string>
     */
    public array $tanggalTerpilih = [];

    /** Tanggal (Y-m-d) di daftar laporan yang sedang dimintai konfirmasi hapus lewat modal. */
    public ?string $tanggalDihapus = null;

    /**
     * @var list<string>
     */
    #[Locked]
    public array $tanggalHapusTerpilih = [];

    /** Tanggal (Y-m-d) laporan dari daftar yang sedang ditampilkan di modal. */
    public ?string $tanggalDilihat = null;

    /** Kabar hasil simpan atau hapus terakhir. */
    public ?string $pesan = null;

    public function mount(): void
    {
        $this->pesan = session('pesan');
    }

    public function updatedPeriodeId(): void
    {
        $this->tanggalTerpilih = [];
        $this->tanggalDihapus = null;
        $this->tanggalHapusTerpilih = [];
        $this->tanggalDilihat = null;
        $this->resetErrorBag('tanggalTerpilih');
    }

    #[Computed]
    public function tanggalTerakhir(): ?CarbonInterface
    {
        return $this->periodeTermuat() ? RingkasanHarian::tanggalTerakhirDenganPanen($this->periodeTermuat()) : null;
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

        $tanggalMulai = $this->periode->kandangPeriode->isNotEmpty()
            ? $this->periode->kandangPeriode->map(fn ($satu) => $satu->tanggalChickInEfektif())->min()
            : $this->periode->tanggal_chick_in;

        return $pilihan && $pilihan->betweenIncluded($tanggalMulai, $terakhir) ? $pilihan : $terakhir;
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
     * Pilih semua laporan pada periode aktif atau kosongkan pilihan.
     */
    public function pilihSemua(): void
    {
        $tanggalTersedia = collect($this->daftar)
            ->map(fn (array $baris): string => $baris['tanggal']->format('Y-m-d'))
            ->all();

        $this->tanggalTerpilih = count($tanggalTersedia) > 0
            && count($this->tanggalDipilihYangAda) === count($tanggalTersedia)
                ? []
                : $tanggalTersedia;
        $this->resetErrorBag('tanggalTerpilih');
    }

    /**
     * Siapkan konfirmasi penghapusan laporan terpilih dari periode aktif.
     */
    public function mintaHapusTerpilih(): void
    {
        $this->tanggalHapusTerpilih = $this->tanggalDipilihYangAda;
        $this->pesan = null;

        if ($this->tanggalHapusTerpilih === []) {
            $this->addError('tanggalTerpilih', 'Pilih setidaknya satu laporan harian untuk dihapus.');

            return;
        }

        $this->resetErrorBag('tanggalTerpilih');
    }

    /**
     * Hapus seluruh laporan yang sudah dikonfirmasi pada periode aktif.
     */
    public function hapusTerpilih(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode;
        $tanggalUntukDihapus = collect($this->tanggalHapusTerpilih)
            ->filter(fn (string $tanggal): bool => $this->adaDiDaftar($tanggal))
            ->values();

        if (! $periode || $tanggalUntukDihapus->isEmpty()) {
            $this->tanggalHapusTerpilih = [];
            $this->addError('tanggalTerpilih', 'Tidak ada laporan terpilih yang masih tersedia untuk dihapus.');

            return;
        }

        $jumlahTerhapus = DB::transaction(function () use ($periode, $tanggalUntukDihapus): int {
            return $tanggalUntukDihapus->sum(
                fn (string $tanggal): int => IsianLaporanHarian::hapus($periode, Carbon::parse($tanggal)) > 0 ? 1 : 0,
            );
        });

        if ($jumlahTerhapus === 0) {
            $this->tanggalHapusTerpilih = [];
            $this->addError('tanggalTerpilih', 'Laporan yang dipilih sudah tidak tersedia.');

            return;
        }

        $tanggalAktifDihapus = $this->tanggal && $tanggalUntukDihapus->contains($this->tanggal);

        $this->pesan = $jumlahTerhapus.' laporan harian berhasil dihapus.';
        $this->tanggalTerpilih = [];
        $this->tanggalHapusTerpilih = [];
        $this->tanggalDilihat = null;
        if ($tanggalAktifDihapus) {
            $this->tanggal = null;
        }

        unset($this->daftarPeriode, $this->periode, $this->tanggalTerakhir, $this->tanggalLaporan, $this->laporan, $this->daftar, $this->lembar, $this->dilihat, $this->labelTanggalDihapus);
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
        $this->pastikanPeriodeDapatDiubah();
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

    /**
     * @return list<string>
     */
    #[Computed]
    public function tanggalDipilihYangAda(): array
    {
        $tanggalTersedia = collect($this->daftar)
            ->map(fn (array $baris): string => $baris['tanggal']->format('Y-m-d'));

        return collect($this->tanggalTerpilih)
            ->filter(fn (mixed $tanggal): bool => is_string($tanggal))
            ->intersect($tanggalTersedia)
            ->unique()
            ->values()
            ->all();
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
