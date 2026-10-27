<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\PembayaranPemanen;
use App\Support\Format;
use App\Support\LembarPayrollPemanen;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Upah pemanen satu periode dari nota panen, dengan status sudah atau belum dibayar per pemanen. Status dibayar
 * menyimpan nominal upah saat itu, sehingga perubahan upah sesudahnya (nota baru atau tarif berubah) terlihat.
 */
#[Title('Payroll pemanen')]
class PayrollPemanen extends Component
{
    use MemilihPeriode;

    public ?string $pesan = null;

    #[Locked]
    public ?int $batalBayarId = null;

    public string $namaBatalBayar = '';

    /**
     * @return array{
     *     jumlah_nota: int,
     *     berat_total: float,
     *     berat_teralokasi: float,
     *     berat_nama_belum_terdaftar: float,
     *     berat_abk: float,
     *     berat_tanpa_nama: float,
     *     total_upah: int,
     *     pemanen: list<array{id: int, nama: string, jumlah_nota: int, berat_kg: float, upah_per_kg: int, total_upah: int}>,
     *     nama_belum_terdaftar: list<array{nama: string, berat_kg: float}>,
     *     abk: list<array{nama: string, berat_kg: float}>
     * }|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        return $this->periode ? LembarPayrollPemanen::buat($this->periode) : null;
    }

    /**
     * Bahan tampilan halaman: porsi tonase tiap pemanen, rata-rata upah, dan pembagian tonase menurut status
     * pembayarannya. Tonase dihitung per nama, jadi nota lama yang mencatat beberapa nama ikut dihitung untuk
     * setiap nama; karena itu porsinya diukur terhadap jumlah tonase upah, bukan terhadap berat panen.
     *
     * @return array{
     *     pemanen: list<array{id: int, nama: string, inisial: string, jumlah_nota: int, berat_kg: float, upah_per_kg: int, total_upah: int, porsi: float, dibayar: ?array{jumlah: int, pada: CarbonInterface, berubah: bool}}>,
     *     rata_upah: ?float,
     *     sudah_dibayar: int,
     *     belum_dibayar: int,
     *     jumlah_dibayar: int,
     *     alokasi: list<array{label: string, keterangan: string, berat_kg: float, persen: float, warna: string}>,
     *     tonase_upah: float
     * }|null
     */
    #[Computed]
    public function tampilan(): ?array
    {
        $lembar = $this->lembar;
        if (! $lembar) {
            return null;
        }

        $teralokasi = $lembar['berat_teralokasi'];
        $alokasi = collect([
            ['label' => 'Masuk payroll pemanen', 'keterangan' => 'Dihitung ke upah pemanen terdaftar', 'berat_kg' => $teralokasi, 'warna' => 'success'],
            ['label' => 'Dipanen ABK', 'keterangan' => 'Tidak dibayar di payroll pemanen', 'berat_kg' => $lembar['berat_abk'], 'warna' => 'info'],
            ['label' => 'Nama belum terdaftar', 'keterangan' => 'Daftarkan di Master Data agar dibayar', 'berat_kg' => $lembar['berat_nama_belum_terdaftar'], 'warna' => 'warning'],
            ['label' => 'Belum teralokasi', 'keterangan' => 'Nota tanpa nama pemanen atau krat mulai', 'berat_kg' => $lembar['berat_tanpa_nama'], 'warna' => 'danger'],
        ]);
        $tonaseUpah = (float) $alokasi->sum('berat_kg');
        $pembayaran = $this->pembayaran;
        $pemanen = collect($lembar['pemanen'])->map(function (array $orang) use ($teralokasi, $pembayaran): array {
            $bayar = $pembayaran->get($orang['id']);

            return [
                ...$orang,
                'inisial' => self::inisial($orang['nama']),
                'porsi' => $teralokasi > 0 ? $orang['berat_kg'] / $teralokasi * 100 : 0.0,
                'dibayar' => $bayar ? [
                    'jumlah' => $bayar->jumlah,
                    'pada' => $bayar->dibayar_pada,
                    'berubah' => $bayar->jumlah !== $orang['total_upah'],
                ] : null,
            ];
        });
        $sudah = $pemanen->filter(fn (array $orang): bool => $orang['dibayar'] !== null);

        return [
            'pemanen' => $pemanen->all(),
            'rata_upah' => $lembar['pemanen'] !== [] ? $lembar['total_upah'] / count($lembar['pemanen']) : null,
            'sudah_dibayar' => (int) $sudah->sum(fn (array $orang): int => $orang['dibayar']['jumlah']),
            'belum_dibayar' => (int) $pemanen->whereNull('dibayar')->sum('total_upah'),
            'jumlah_dibayar' => $sudah->count(),
            'alokasi' => $alokasi
                ->map(fn (array $baris): array => [...$baris, 'persen' => $tonaseUpah > 0 ? $baris['berat_kg'] / $tonaseUpah * 100 : 0.0])
                ->all(),
            'tonase_upah' => $tonaseUpah,
        ];
    }

    /**
     * Catatan pembayaran periode terpilih, kuncinya pemanen_id.
     *
     * @return Collection<int, PembayaranPemanen>
     */
    #[Computed]
    public function pembayaran(): Collection
    {
        return $this->periode
            ? PembayaranPemanen::query()->where('periode_id', $this->periode->id)->whereNotNull('pemanen_id')->get()->keyBy('pemanen_id')
            : collect();
    }

    /**
     * Tandai upah seorang pemanen sudah dibayar, dengan nominal upahnya saat ini.
     */
    public function tandaiDibayar(int $pemanenId): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $orang = collect($this->lembar['pemanen'] ?? [])->firstWhere('id', $pemanenId) ?? abort(404);
        $this->pesan = null;

        if ($this->pembayaran->has($pemanenId)) {
            return;
        }

        DB::transaction(function () use ($orang): void {
            PembayaranPemanen::create([
                'periode_id' => $this->periode->id,
                'pemanen_id' => $orang['id'],
                'nama' => $orang['nama'],
                'jumlah' => $orang['total_upah'],
                'dibayar_pada' => now(),
            ]);
            Aktivitas::catat(
                JenisAktivitas::Tambah,
                ModulAktivitas::PayrollPemanen,
                'Pembayaran upah '.$orang['nama'],
                'Rp '.Format::angka($orang['total_upah']).', '.$this->periode->nama,
            );
        });

        $this->pesan = 'Upah '.$orang['nama'].' Rp '.Format::angka($orang['total_upah']).' ditandai sudah dibayar.';
        unset($this->pembayaran, $this->tampilan);
    }

    public function mintaBatalBayar(int $pemanenId): void
    {
        $bayar = $this->pembayaran->get($pemanenId) ?? abort(404);

        $this->pesan = null;
        $this->batalBayarId = $pemanenId;
        $this->namaBatalBayar = $bayar->nama.' (Rp '.Format::angka($bayar->jumlah).')';
    }

    /**
     * Kembalikan status pemanen menjadi belum dibayar; catatan pembayarannya dihapus.
     */
    public function batalBayar(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $bayar = $this->pembayaran->get($this->batalBayarId) ?? abort(404);

        DB::transaction(function () use ($bayar): void {
            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::PayrollPemanen,
                'Pembayaran upah '.$bayar->nama,
                'Rp '.Format::angka($bayar->jumlah).', '.$this->periode->nama,
            );
            $bayar->delete();
        });

        $this->pesan = 'Upah '.$bayar->nama.' dikembalikan menjadi belum dibayar.';
        $this->batalBayarId = null;
        $this->namaBatalBayar = '';
        unset($this->pembayaran, $this->tampilan);
    }

    public function render(): View
    {
        return view('livewire.payroll-pemanen');
    }

    /**
     * Inisial dua kata pertama nama untuk avatar, mis. "Rifi ABK" menjadi "RA".
     */
    private static function inisial(string $nama): string
    {
        return collect(preg_split('/\s+/u', trim($nama)) ?: [])
            ->filter()
            ->take(2)
            ->map(fn (string $kata): string => mb_strtoupper(mb_substr($kata, 0, 1)))
            ->implode('');
    }
}
