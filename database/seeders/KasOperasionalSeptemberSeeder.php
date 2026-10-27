<?php

namespace Database\Seeders;

use App\Enums\KategoriKas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class KasOperasionalSeptemberSeeder extends Seeder
{
    /**
     * Dana masuk (Kandang 2, periode September 2026) dari "3. Administrasi Harian Periode 18" (judul lembar tertulis Kandang 1, isinya Kandang 2).
     *
     * @var list<array{string, int}>
     */
    private const DANA = [
        ['2026-09-04', 10000000],
        ['2026-09-10', 10000000],
        ['2026-09-10', 3862000],
        ['2026-09-22', 10000000],
        ['2026-09-29', 10000000],
        ['2026-10-14', 10000000],
    ];

    /**
     * Buku besar laporan kas Kandang 2: [tanggal, kategori, uraian, jumlah (Rp)].
     *
     * @var list<array{string, KategoriKas, string, int}>
     */
    private const KELUAR = [
        ['2026-09-05', KategoriKas::Maintenance, 'Paku 1.5', 110000],
        ['2026-09-05', KategoriKas::Maintenance, 'Paku 2,5', 110000],
        ['2026-09-05', KategoriKas::Maintenance, 'Martil', 50000],
        ['2026-09-05', KategoriKas::Transport, 'Ongkos kirim kayu', 300000],
        ['2026-09-05', KategoriKas::Maintenance, 'Cat hitam 10 kaleng', 900000],
        ['2026-09-05', KategoriKas::Maintenance, 'Thinner', 400000],
        ['2026-09-05', KategoriKas::Maintenance, 'Kayu', 3862000],
        ['2026-09-06', KategoriKas::Maintenance, 'Cat hitam 10 kaleng', 900000],
        ['2026-09-06', KategoriKas::Maintenance, 'Thinner 2 kaleng', 390000],
        ['2026-09-07', KategoriKas::Maintenance, 'Cat minyak 8 kaleng', 760000],
        ['2026-09-07', KategoriKas::Maintenance, 'Cat minyak 22 kaleng', 1980000],
        ['2026-09-07', KategoriKas::Maintenance, 'Thinner 2 kaleng', 390000],
        ['2026-09-08', KategoriKas::Maintenance, 'Cat minyak 8 kaleng', 720000],
        ['2026-09-08', KategoriKas::Maintenance, 'Thinner 2 kaleng', 390000],
        ['2026-09-08', KategoriKas::MakanMinum, 'Air minum8', 48000],
        ['2026-09-08', KategoriKas::Upah, 'Upah tukang listrik', 300000],
        ['2026-09-08', KategoriKas::Maintenance, 'Kabel nym', 210000],
        ['2026-09-08', KategoriKas::Maintenance, 'Gas untuk fogging', 150000],
        ['2026-09-09', KategoriKas::Gas, 'Gas 3kg', 1680000],
        ['2026-09-10', KategoriKas::Maintenance, 'Sarung tangan karet', 200000],
        ['2026-09-10', KategoriKas::Upah, 'Upah supir doc', 100000],
        ['2026-09-10', KategoriKas::GajiKaryawan, 'Upah tukang masak', 1000000],
        ['2026-09-12', KategoriKas::Gas, 'Gas 3 kg', 1680000],
        ['2026-09-12', KategoriKas::Solar, 'Solar', 1500000],
        ['2026-09-12', KategoriKas::MakanMinum, 'Air minum', 42000],
        ['2026-09-12', KategoriKas::Maintenance, 'Tali tambang 1 gulung', 45000],
        ['2026-09-12', KategoriKas::Maintenance, 'Saklar mesin air', 40000],
        ['2026-09-12', KategoriKas::PinjamanKaryawan, 'Pinjaman rohim', 100000],
        ['2026-09-12', KategoriKas::MakanMinum, 'Kopi ABK', 400000],
        ['2026-09-12', KategoriKas::Maintenance, 'Cas untuk bor baterai', 250000],
        ['2026-09-12', KategoriKas::Maintenance, 'Mesin bor', 700000],
        ['2026-09-12', KategoriKas::Maintenance, 'Mesin sprayer cat', 450000],
        ['2026-09-12', KategoriKas::Transport, 'Ongkos kirim mesin bor', 40000],
        ['2026-09-12', KategoriKas::Transport, 'Ongkos kirim sprayer cat', 40000],
        ['2026-09-12', KategoriKas::Maintenance, 'Desinfektan fogging', 625000],
        ['2026-09-12', KategoriKas::Maintenance, 'Alat fogging', 925000],
        ['2026-09-12', KategoriKas::Maintenance, 'Racun lalat 1 kotak', 940000],
        ['2026-09-17', KategoriKas::Upah, 'Upah tukang listrik', 100000],
        ['2026-09-17', KategoriKas::Upah, 'Upah orang PLN', 100000],
        ['2026-09-18', KategoriKas::Upah, 'Upah supir pakan', 100000],
        ['2026-09-18', KategoriKas::Gas, 'Gas 3 kg', 1680000],
        ['2026-09-18', KategoriKas::Solar, 'Solar 2 jerigen', 600000],
        ['2026-09-18', KategoriKas::PinjamanKaryawan, 'Pinjaman rohim', 50000],
        ['2026-09-19', KategoriKas::Maintenance, 'Perbaiki supra', 180000],
        ['2026-09-20', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 120000],
        ['2026-09-22', KategoriKas::PinjamanKaryawan, 'Pinjaman rohim', 100000],
        ['2026-09-22', KategoriKas::Listrik, 'PLN september', 10996000],
        ['2026-09-22', KategoriKas::PinjamanKaryawan, 'Pinjaman juni', 100000],
        ['2026-09-23', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-09-23', KategoriKas::MakanMinum, 'Pudding abk', 125000],
        ['2026-09-25', KategoriKas::GajiKaryawan, 'Gaji rohim', 1750000],
        ['2026-09-25', KategoriKas::Maintenance, 'Lahar angkong 5', 50000],
        ['2026-09-25', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 120000],
        ['2026-09-28', KategoriKas::Berobat, 'Berobat tama', 100000],
        ['2026-09-28', KategoriKas::Berobat, 'Berobat frengky', 170000],
        ['2026-10-03', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 450000],
        ['2026-10-04', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 120000],
        ['2026-10-07', KategoriKas::GajiKaryawan, 'Gaji tukang masak', 1000000],
        ['2026-10-07', KategoriKas::Upah, 'Upah pengurangan 3 orang', 300000],
        ['2026-10-07', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-10-07', KategoriKas::PinjamanKaryawan, 'Pinjaman rohim', 200000],
        ['2026-10-07', KategoriKas::Maintenance, 'Sarung tangan panen', 110000],
        ['2026-10-07', KategoriKas::Maintenance, 'Lampu 50 watt 2 pcs', 200000],
        ['2026-10-07', KategoriKas::Maintenance, 'Tali plastik', 80000],
        ['2026-10-07', KategoriKas::ObatAyam, 'Biodes 4 botol', 400000],
        ['2026-10-07', KategoriKas::ObatAyam, 'Phycurma 2 botol', 500000],
        ['2026-10-11', KategoriKas::MakanMinum, 'Belanja keperluan makan panen dan kopi', 400000],
        ['2026-10-17', KategoriKas::Upah, 'Upaah tangkap', 5090250],
        ['2026-10-17', KategoriKas::SewaLahan, 'Fee ayam', 4911400],
        ['2026-10-18', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 320000],
        ['2026-10-18', KategoriKas::Listrik, 'PLN Oktober', 7622000],
        ['2026-10-19', KategoriKas::PinjamanKaryawan, 'Pinjaman Rohim', 100000],
        ['2026-10-19', KategoriKas::Entertain, 'Sumbangan masyarakat', 500000],
        ['2026-10-19', KategoriKas::Maintenance, 'Deterjen cuci karung', 100000],
        ['2026-10-19', KategoriKas::GajiKaryawan, 'Gaji rohim', 1450000],
        ['2026-10-19', KategoriKas::PinjamanKaryawan, 'Pinjaman frengky', 200000],
    ];

    /**
     * Total per kategori dari ringkasan "3. Administrasi Harian Periode 18".
     *
     * @var array<string, int>
     */
    private const KATEGORI_PENGELUARAN = [
        'berobat' => 270000,
        'entertain' => 500000,
        'gaji-karyawan' => 5200000,
        'gas' => 5040000,
        'listrik' => 18618000,
        'maintenance' => 16217000,
        'makan-minum' => 1123000,
        'obat-ayam' => 900000,
        'pinjaman-karyawan' => 1980000,
        'sewa-lahan' => 4911400,
        'solar' => 2100000,
        'transport' => 380000,
        'upah' => 6090250,
    ];

    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();
        $kandang = Kandang::where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::where([
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
        ])->firstOrFail();

        $totalDana = array_sum(array_column(self::DANA, 1));
        $totalKeluar = array_sum(array_column(self::KELUAR, 3));
        $totalPerKategori = collect(self::KELUAR)
            ->groupBy(fn (array $baris): string => $baris[1]->value)
            ->map(fn ($baris): int => (int) $baris->sum(fn (array $transaksi): int => $transaksi[3]))
            ->sortKeys()
            ->all();
        $kategoriDiharapkan = self::KATEGORI_PENGELUARAN;
        ksort($kategoriDiharapkan);

        if (
            $totalDana !== 53_862_000
            || $totalKeluar !== 63_329_650
            || count(self::KELUAR) !== 76
            || $totalPerKategori !== $kategoriDiharapkan
        ) {
            throw new RuntimeException('Total transaksi laporan kas September Kandang 2 tidak cocok dengan rincian PDF.');
        }

        DB::transaction(function () use ($periodeKandang): void {
            foreach (self::DANA as [$tanggal, $jumlah]) {
                $this->simpanJikaBelumAda($periodeKandang, $tanggal, KategoriKas::DanaOperasional, 'Uang Masuk', $jumlah);
            }

            foreach (self::KELUAR as [$tanggal, $kategori, $uraian, $jumlah]) {
                $this->simpanJikaBelumAda($periodeKandang, $tanggal, $kategori, $uraian, $jumlah);
            }
        });
    }

    private function simpanJikaBelumAda(
        PeriodeKandang $periodeKandang,
        string $tanggal,
        KategoriKas $kategori,
        string $uraian,
        int $jumlah,
    ): void {
        $transaksi = $periodeKandang->transaksiKas()
            ->whereDate('tanggal', $tanggal)
            ->where('kategori', $kategori->value)
            ->where('jumlah', $jumlah)
            ->where('uraian', $uraian)
            ->first();

        if ($transaksi) {
            return;
        }

        $periodeKandang->transaksiKas()->create([
            'tanggal' => $tanggal,
            'kategori' => $kategori,
            'uraian' => $uraian,
            'jumlah' => $jumlah,
        ]);
    }
}
