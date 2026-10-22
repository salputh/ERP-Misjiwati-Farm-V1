<?php

namespace Database\Seeders;

use App\Enums\KategoriKas;
use App\Models\Kandang;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use Illuminate\Database\Seeder;

class KasOperasionalSeeder extends Seeder
{
    /**
     * Kandang 2 periode Juli 2026, dari tabel "Riwayat Dana Operasional" di lembar
     * "Laporan Biaya Operasional — Kandang 2": [tanggal, jumlah (Rp)].
     * Setoran 1 September tidak ikut di buku besar lembar itu, tetapi dihitung di ringkasannya (Rp 45.000.000).
     *
     * @var list<array{string, int}>
     */
    private const JULI_KANDANG_2_DANA = [
        ['2026-07-09', 10_000_000],
        ['2026-07-13', 10_000_000],
        ['2026-07-25', 15_000_000],
        ['2026-09-01', 10_000_000],
    ];

    /**
     * Pengeluaran dari "Buku Besar / Rincian Transaksi" lembar yang sama, urut seperti di lembar
     * (no. 4 sampai 129): [tanggal, kategori, uraian, jumlah (Rp)]. Total Rp 67.327.239.
     *
     * @var list<array{string, KategoriKas, string, int}>
     */
    private const JULI_KANDANG_2_KELUAR = [
        ['2026-07-09', KategoriKas::Gas, 'Gas 35', 840000],
        ['2026-07-15', KategoriKas::Solar, 'Solar 5 jerigen', 1500000],
        ['2026-07-17', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-18', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-19', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-20', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-21', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-25', KategoriKas::Gas, 'Gas 35 tabung', 840000],
        ['2026-07-25', KategoriKas::Listrik, 'PLN Agustus', 6550000],
        ['2026-07-25', KategoriKas::Upah, 'Upah tangkap', 2682439],
        ['2026-07-25', KategoriKas::SewaLahan, 'Fee ayam', 4874800],
        ['2026-07-11', KategoriKas::Upah, 'Gaji Tukang Masak', 1000000],
        ['2026-07-15', KategoriKas::Upah, 'Upah supir DOC', 100000],
        ['2026-07-22', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-07-25', KategoriKas::Upah, 'Upah supir pakan', 100000],
        ['2026-07-26', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-07-29', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-07-30', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-07-31', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-08-02', KategoriKas::Upah, 'Upah sortir 2 malam', 50000],
        ['2026-08-02', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-08-03', KategoriKas::Upah, 'Upah supir pakan', 50000],
        ['2026-08-04', KategoriKas::Upah, 'Upah supir pakan', 100000],
        ['2026-08-06', KategoriKas::Upah, 'Gaji Juni tukang masak', 1000000],
        ['2026-08-22', KategoriKas::Upah, 'Upah tukang listrik perbaiki colokan doorsmeer', 200000],
        ['2026-07-03', KategoriKas::LainLain, 'Briket 140 kg', 2070000],
        ['2026-07-03', KategoriKas::Transport, 'Ongkos becak', 70000],
        ['2026-07-03', KategoriKas::Maintenance, 'Dinamo doorsmeer', 500000],
        ['2026-07-11', KategoriKas::Maintenance, 'Tempah corong kotoran 1 buah', 1000000],
        ['2026-07-11', KategoriKas::LainLain, 'Briket 160 kg', 2280000],
        ['2026-07-11', KategoriKas::Maintenance, 'Wipol 6 bungkus', 150000],
        ['2026-07-11', KategoriKas::Maintenance, 'Sapu lidi 4', 40000],
        ['2026-07-11', KategoriKas::Maintenance, 'Sapu air 4', 140000],
        ['2026-07-13', KategoriKas::Maintenance, 'Klem kabel 5 bungkus', 125000],
        ['2026-07-13', KategoriKas::Maintenance, 'Racun lalat 12 kotak', 540000],
        ['2026-07-13', KategoriKas::Maintenance, 'Roda heater', 170000],
        ['2026-07-17', KategoriKas::Maintenance, 'Tempah corong kotoran 3 buah', 3200000],
        ['2026-07-17', KategoriKas::Maintenance, 'Perbaiki kereta supra', 200000],
        ['2026-07-17', KategoriKas::Maintenance, 'Paranet 1 roll', 1430000],
        ['2026-07-21', KategoriKas::Maintenance, 'Testpen', 50000],
        ['2026-07-23', KategoriKas::MakanMinum, 'Air minum 9', 54000],
        ['2026-07-23', KategoriKas::Maintenance, 'Tali plastik', 50000],
        ['2026-07-23', KategoriKas::MakanMinum, 'Pudding ABK', 100000],
        ['2026-07-23', KategoriKas::Maintenance, 'Lampu 50 watt 2 pcs', 210000],
        ['2026-07-30', KategoriKas::MakanMinum, 'Air minum 6', 36000],
        ['2026-07-30', KategoriKas::Maintenance, 'Sarung tangan karet 10 pasang', 250000],
        ['2026-07-30', KategoriKas::MakanMinum, 'Kopi ABK', 320000],
        ['2026-08-02', KategoriKas::Maintenance, 'Biodes 8 botol', 912000],
        ['2026-08-02', KategoriKas::ObatAyam, 'Vitakur 20 bungkus', 1300000],
        ['2026-08-02', KategoriKas::ObatAyam, 'Phycurma 2 botol', 600000],
        ['2026-08-02', KategoriKas::Maintenance, 'Thermometer 20 pcs', 500000],
        ['2026-08-02', KategoriKas::ObatAyam, 'Therapy 4 bungkus', 360000],
        ['2026-08-02', KategoriKas::ObatAyam, 'Vitastress 5 bungkus', 300000],
        ['2026-08-02', KategoriKas::ObatAyam, 'Sorbitol 5 liter', 400000],
        ['2026-08-04', KategoriKas::ObatAyam, 'Floxamicyne', 1445000],
        ['2026-08-04', KategoriKas::Maintenance, 'Lampu 100 watt 5 pcs', 500000],
        ['2026-08-04', KategoriKas::Berobat, 'Berobat Tama', 75000],
        ['2026-08-08', KategoriKas::Maintenance, 'Sarung tangan panen 10 pasang', 50000],
        ['2026-08-08', KategoriKas::MakanMinum, 'Air minum 8', 48000],
        ['2026-08-10', KategoriKas::Berobat, 'Berobat Tama dokter THT', 502000],
        ['2026-08-10', KategoriKas::Maintenance, 'Tempel ban gerobak sorong', 80000],
        ['2026-08-10', KategoriKas::ObatAyam, 'Gula merah', 145000],
        ['2026-08-13', KategoriKas::Maintenance, 'Sandal swallow 4 pasang', 60000],
        ['2026-08-13', KategoriKas::Entertain, 'Minum untuk audit', 50000],
        ['2026-08-15', KategoriKas::Maintenance, 'Bayar kayu', 5800000],
        ['2026-08-15', KategoriKas::MakanMinum, 'Belanja keperluan makan panen', 200000],
        ['2026-08-18', KategoriKas::Maintenance, 'Deterjen cuci kandang', 50000],
        ['2026-08-18', KategoriKas::Maintenance, 'Service selang doorsmeer', 85000],
        ['2026-08-18', KategoriKas::Maintenance, 'Oli doorsmeer', 100000],
        ['2026-08-18', KategoriKas::Maintenance, 'MCB colokan doorsmeer', 140000],
        ['2026-08-18', KategoriKas::Maintenance, 'Terminal 2 lobang 1 pcs', 15000],
        ['2026-08-18', KategoriKas::Maintenance, 'Terminal 6 lobang 1 pcs', 25000],
        ['2026-08-22', KategoriKas::Maintenance, 'Tang kombinasi', 75000],
        ['2026-08-22', KategoriKas::Maintenance, 'Ring + mur', 3000],
        ['2026-08-22', KategoriKas::Maintenance, 'Anti kusut', 100000],
        ['2026-08-22', KategoriKas::Maintenance, 'Sambungan doorsmeer', 80000],
        ['2026-08-22', KategoriKas::Maintenance, 'Gramoxone 2 botol', 180000],
        ['2026-08-22', KategoriKas::Maintenance, 'Kabel NYM 2 x 2,5', 44000],
        ['2026-08-22', KategoriKas::Maintenance, 'Kabel GL 4mm', 32000],
        ['2026-08-22', KategoriKas::Maintenance, 'Skun 6-6', 8000],
        ['2026-08-22', KategoriKas::Maintenance, 'Skun cucuk besar', 8000],
        ['2026-08-22', KategoriKas::Maintenance, 'Isolasi nasional 9 pcs', 90000],
        ['2026-08-23', KategoriKas::Maintenance, 'Baut skrup 2 kotak', 100000],
        ['2026-08-23', KategoriKas::Maintenance, 'Kabel NYM 2 x 2,5', 22000],
        ['2026-08-23', KategoriKas::Maintenance, 'Baut 10 pcs', 10000],
        ['2026-08-23', KategoriKas::Maintenance, 'Stop kontak arde 2', 110000],
        ['2026-08-23', KategoriKas::Maintenance, 'Plat stop kontak', 20000],
        ['2026-08-23', KategoriKas::Maintenance, 'Paku 1,5 inch 1 kg', 22000],
        ['2026-08-23', KategoriKas::Maintenance, 'Paku 0,5 inch 1 kg', 22000],
        ['2026-08-23', KategoriKas::Maintenance, 'Paku 2 inch 1 kg', 22000],
        ['2026-08-23', KategoriKas::Upah, 'Upah tukang listrik', 300000],
        ['2026-08-23', KategoriKas::Maintenance, 'Lampu 50 watt 2 pcs', 200000],
        ['2026-08-23', KategoriKas::MakanMinum, 'Air minum', 90000],
        ['2026-08-23', KategoriKas::Maintenance, 'Servis mesin doorsmeer', 395000],
        ['2026-08-24', KategoriKas::Maintenance, 'Bais meja 3 inch tehiro', 700000],
        ['2026-08-24', KategoriKas::Maintenance, 'Socket 3/4 inch 10 pcs', 50000],
        ['2026-08-24', KategoriKas::Maintenance, 'Stop kran 3/4 1 pcs', 25000],
        ['2026-08-24', KategoriKas::Maintenance, 'Pulley dinamo', 75000],
        ['2026-08-24', KategoriKas::Maintenance, 'Bubut pulley dinamo', 120000],
        ['2026-08-24', KategoriKas::Maintenance, 'Formalin 3 botol', 270000],
        ['2026-07-05', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1300000],
        ['2026-07-12', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1000000],
        ['2026-07-15', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 300000],
        ['2026-07-18', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1450000],
        ['2026-07-26', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1500000],
        ['2026-08-02', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1500000],
        ['2026-08-06', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1600000],
        ['2026-08-08', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 200000],
        ['2026-08-15', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1400000],
        ['2026-08-23', KategoriKas::PinjamanMakan, 'Pinjaman Makan', 1400000],
        ['2026-07-22', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 300000],
        ['2026-07-26', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 100000],
        ['2026-08-02', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 100000],
        ['2026-08-02', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 120000],
        ['2026-08-04', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 200000],
        ['2026-08-08', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 50000],
        ['2026-08-13', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 100000],
        ['2026-08-13', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 200000],
        ['2026-08-17', KategoriKas::PinjamanAbk, 'Pinjaman Frengky', 120000],
        ['2026-08-30', KategoriKas::PinjamanAbk, 'Pinjaman Tama', 100000],
    ];

    /**
     * Dilewati bila buku kas kandang itu sudah berisi, supaya seeding ulang tidak menggandakan transaksi.
     */
    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $kandang = Kandang::where('nama', 'Kandang 2')->firstOrFail();
        $periodeKandang = PeriodeKandang::where(['periode_id' => $periode->id, 'kandang_id' => $kandang->id])->firstOrFail();

        if (! $periodeKandang->transaksiKas()->exists()) {
            foreach (self::JULI_KANDANG_2_DANA as [$tanggal, $jumlah]) {
                $periodeKandang->transaksiKas()->create([
                    'tanggal' => $tanggal,
                    'kategori' => KategoriKas::DanaOperasional,
                    'uraian' => 'Uang masuk (operasional)',
                    'jumlah' => $jumlah,
                ]);
            }

            foreach (self::JULI_KANDANG_2_KELUAR as [$tanggal, $kategori, $uraian, $jumlah]) {
                $periodeKandang->transaksiKas()->create([
                    'tanggal' => $tanggal,
                    'kategori' => $kategori,
                    'uraian' => $uraian,
                    'jumlah' => $jumlah,
                ]);
            }
        }

        $this->call(KasOperasionalSeptemberSeeder::class);
        $this->call(KasOperasionalSeptemberKandangSatuSeeder::class);
    }
}
