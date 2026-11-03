<?php

namespace Database\Seeders;

use App\Enums\Jabatan;
use App\Enums\KategoriKas;
use App\Enums\PeranBagiHasil;
use App\Models\BagiHasil;
use App\Models\Farm;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Kasbon;
use App\Models\KohePenjualan;
use App\Models\KoheStok;
use App\Models\NotaPanen;
use App\Models\NotaPanenPemanen;
use App\Models\Pemanen;
use App\Models\Pemodal;
use App\Models\PenerimaBagiHasil;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\PotonganKasbon;
use App\Models\Recording;
use App\Models\RhppReal;
use App\Models\SesiSampling;
use App\Models\SlipGaji;
use App\Models\TitikSampling;
use App\Models\TransaksiKas;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DemoDataLengkapSeeder extends Seeder
{
    /**
     * Seed data demo lengkap dengan nama-nama fiktif untuk semua fitur.
     *
     * Data yang dibuat:
     * - Karyawan baru dengan nama fiktif (berbeda dari seeder lama)
     * - Pemodal dengan nama fiktif
     * - Pemanen dengan nama fiktif
     * - Recording harian lengkap (umur 1-24)
     * - Sampling bobot 15 hari
     * - Panen lengkap dengan nota
     * - Bagi hasil KD1 dan KD2
     * - Payroll ABK
     * - Kasbon ABK dengan cicilan
     * - Kohe (stok dan penjualan)
     * - Kas operasional
     */
    public function run(): void
    {
        $this->command->info('🌱 Mulai seeding data demo lengkap...');

        // Hapus data lama yang bentrok
        $this->hapusDataLama();

        $farm = Farm::query()->where('kode', 'K0242')->firstOrFail();
        $kandang1 = Kandang::query()->where('nama', 'Kandang 1')->firstOrFail();
        $kandang2 = Kandang::query()->where('nama', 'Kandang 2')->firstOrFail();

        // Periode yang akan diisi (Periode Juli 2026 - ID 1)
        $periode = Periode::query()->where('nama', 'Periode Juli 2026')->firstOrFail();
        $periodeKandang1 = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang1->id)
            ->firstOrFail();
        $periodeKandang2 = PeriodeKandang::query()
            ->where('periode_id', $periode->id)
            ->where('kandang_id', $kandang2->id)
            ->firstOrFail();

        // 1. Karyawan fiktif (nama berbeda dari yang sudah ada)
        $this->command->info('📝 Membuat karyawan...');
        $karyawan = $this->buatKaryawan($kandang1, $kandang2);

        // 2. Pemodal fiktif
        $this->command->info('💰 Membuat pemodal...');
        $pemodal = $this->buatPemodal($kandang1, $kandang2);

        // 3. Pemanen fiktif
        $this->command->info('🚜 Membuat pemanen...');
        $pemanen = $this->buatPemanen();

        // 4. Recording harian lengkap
        $this->command->info('📊 Membuat recording harian...');
        $this->buatRecording($periodeKandang1, $periodeKandang2, $periode->tanggal_chick_in);

        // 5. Sampling bobot 15 hari
        $this->command->info('⚖️  Membuat sampling bobot...');
        $this->buatSampling($periodeKandang1, $periodeKandang2, $periode->tanggal_chick_in);

        // 6. Panen (gunakan data yang sudah ada, tambah yang kurang)
        $this->command->info('🐔 Melengkapi data panen...');
        $this->lengkapiPanen($periode, $pemanen);

        // 7. Bagi Hasil KD1 dan KD2
        $this->command->info('💸 Membuat bagi hasil...');
        $bagiHasil = $this->buatBagiHasil($periodeKandang1, $periodeKandang2, $karyawan, $pemodal);

        // 8. Payroll ABK (slip gaji)
        $this->command->info('📄 Membuat payroll ABK...');
        $slipGaji = $this->buatPayroll($periodeKandang1, $periodeKandang2, $karyawan, $bagiHasil);

        // 9. Kasbon ABK
        $this->command->info('🏦 Membuat kasbon ABK...');
        $this->buatKasbon($periode, $karyawan, $slipGaji);

        // 10. Kohe
        $this->command->info('🌾 Membuat data kohe...');
        $this->buatKohe($farm, $kandang1, $kandang2, $periode->tanggal_chick_in);

        Periode::query()->update(['inti' => 'PT Contoh Inti Sejahtera', 'ppl' => 'PPL Demo']);
        RhppReal::query()->update(['ppl' => 'PPL Demo']);
        foreach (TransaksiKas::all() as $transaksi) {
            $transaksi->update(['uraian' => 'Transaksi demo: '.$transaksi->kategori->label()]);
        }

        // 11. Kas Operasional (sudah ada dari DatabaseSeeder)
        $this->command->info('💵 Kas operasional sudah ada dari seeder sebelumnya');

        $this->command->info('');
        $this->command->info('✅ Seeding data demo lengkap selesai!');
        $this->command->info('📍 Periode: '.$periode->nama);
        $this->command->info('🐔 Kandang 1: '.$periodeKandang1->populasi_awal.' ekor');
        $this->command->info('🐔 Kandang 2: '.$periodeKandang2->populasi_awal.' ekor');
    }

    private function hapusDataLama(): void
    {
        // Hapus data karyawan/pemodal lama yang akan diganti
        $karyawanLama = Karyawan::whereIn('nama', ['Wahyu', 'Angga', 'Rifi', 'Mustofa', 'Frengky', 'Igo', 'Utama', 'Rafi', 'Rohim'])->get();
        foreach ($karyawanLama as $k) {
            $k->slipGaji()->delete();
            $k->kasbon()->delete();
            $k->delete();
        }

        // Hapus pemodal lama beserta pivot
        $pemodalLama = Pemodal::whereIn('nama', ['Muchrizan', 'Chatam'])->get();
        foreach ($pemodalLama as $p) {
            $p->kandangs()->detach();
            $p->delete();
        }

        $pemanenLama = ['Rizal', 'David', 'Dayat', 'Anju', 'Kondom'];
        Pemanen::whereIn('nama', $pemanenLama)->delete();

        // Hapus recording duplikat (sudah ada dari DatabaseSeeder)
        Recording::query()->whereHas('periodeKandang.periode', fn ($query) => $query->where('nama', 'Periode Juli 2026'))->delete();
        SesiSampling::query()->whereHas('periodeKandang.periode', fn ($query) => $query->where('nama', 'Periode Juli 2026'))->delete();

        // Pastikan populasi awal sesuai permintaan demo: KD1 20.000, KD2 26.000
        PeriodeKandang::query()->where('kandang_id', 1)->update(['populasi_awal' => 20000]);
        PeriodeKandang::query()->where('kandang_id', 2)->where('periode_id', 1)->update(['populasi_awal' => 26000]);

        // Hapus bagi hasil lama
        BagiHasil::query()->delete();

        // Hapus slip gaji lama
        SlipGaji::query()->delete();

        // Hapus kasbon lama
        Kasbon::query()->delete();
        TransaksiKas::where('kategori', 'pinjaman_karyawan')->delete();

        // Hapus kohe lama
        KoheStok::query()->delete();
        KohePenjualan::query()->delete();

        $this->command->info('🗑️  Data lama dihapus');
    }

    private function buatKaryawan(Kandang $kandang1, Kandang $kandang2): array
    {
        // Kandang 1 - 4 ABK dengan nama fiktif
        $kd1 = [
            Karyawan::firstOrCreate(['nama' => 'Budi Santoso', 'kandang_id' => $kandang1->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Agus Wijaya', 'kandang_id' => $kandang1->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Dedi Kurniawan', 'kandang_id' => $kandang1->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Eko Prasetyo', 'kandang_id' => $kandang1->id], ['jabatan' => Jabatan::Abk]),
        ];

        // Kandang 2 - 4 ABK + 1 Joker
        $kd2 = [
            Karyawan::firstOrCreate(['nama' => 'Samsul Arifin', 'kandang_id' => $kandang2->id], ['jabatan' => Jabatan::Abk, 'keterangan' => 'ketua ABK']),
            Karyawan::firstOrCreate(['nama' => 'Hendra Gunawan', 'kandang_id' => $kandang2->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Yanto Sugiarto', 'kandang_id' => $kandang2->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Bambang Hartono', 'kandang_id' => $kandang2->id], ['jabatan' => Jabatan::Abk]),
            Karyawan::firstOrCreate(['nama' => 'Joko Widodo', 'kandang_id' => $kandang2->id], [
                'jabatan' => Jabatan::Joker,
                'gaji_pokok' => 2_000_000,
                'hari_kerja' => 30,
                'tanggal_gajian' => 25,
            ]),
        ];

        return ['kd1' => $kd1, 'kd2' => $kd2, 'semua' => array_merge($kd1, $kd2)];
    }

    private function buatPemodal(Kandang $kandang1, Kandang $kandang2): array
    {
        $investor1 = Pemodal::firstOrCreate(['nama' => 'PT Maju Sejahtera']);
        $investor1->kandangs()->sync([
            $kandang1->id => ['persen' => 79.9],
            $kandang2->id => ['persen' => 100],
        ]);

        $investor2 = Pemodal::firstOrCreate(['nama' => 'CV Berkah Jaya']);
        $investor2->kandangs()->sync([
            $kandang1->id => ['persen' => 20.1],
        ]);

        return [$investor1, $investor2];
    }

    private function buatPemanen(): array
    {
        return collect(['Ahmad Fauzi', 'Teguh Santoso', 'Wawan Setiawan', 'Dika Pratama', 'Fikri Rahman'])
            ->map(fn (string $nama): Pemanen => Pemanen::firstOrCreate(['nama' => $nama], ['upah_per_kg' => 20]))
            ->all();
    }

    private function buatRecording(PeriodeKandang $pk1, PeriodeKandang $pk2, Carbon $chickIn): void
    {
        // Recording Kandang 1 - umur 1-24
        $recordingKd1 = [
            [1, 48, 0, 69], [2, 15, 0, 80], [3, 26, 0, 100], [4, 24, 0, 108], [5, 17, 0, 145],
            [6, 12, 0, 166], [7, 28, 0, 194], [8, 5, 0, 242], [9, 0, 0, 287], [10, 10, 0, 324],
            [11, 8, 0, 385], [12, 6, 0, 438], [13, 4, 0, 503], [14, 3, 0, 546], [15, 5, 0, 604],
            [16, 5, 0, 718], [17, 4, 0, 807], [18, 32, 0, 910], [19, 12, 0, 976], [20, 6, 0, 1051],
            [21, 12, 0, 1144], [22, 17, 0, 1251], [23, 6, 0, 1362], [24, 6, 0, 1493],
        ];

        foreach ($recordingKd1 as [$umur, $mati, $afkir, $abw]) {
            Recording::create([
                'periode_kandang_id' => $pk1->id,
                'tanggal' => $chickIn->copy()->addDays($umur),
                'umur' => $umur,
                'mati' => $mati,
                'afkir' => $afkir,
                'bobot_rata_gram' => $abw,
            ]);
        }

        // Recording Kandang 2 - umur 1-24
        $recordingKd2 = [
            [1, 97, 0, 66], [2, 70, 0, 75], [3, 57, 0, 101], [4, 35, 0, 132], [5, 23, 0, 156],
            [6, 12, 0, 180], [7, 26, 0, 221], [8, 13, 0, 269], [9, 7, 0, 317], [10, 3, 0, 357],
            [11, 10, 0, 394.8], [12, 8, 0, 445], [13, 5, 0, 498.5], [14, 11, 0, 561], [15, 11, 0, 631],
            [16, 5, 0, 738], [17, 3, 0, 811], [18, 14, 0, 876], [19, 6, 0, 943], [20, 8, 0, 1050],
            [21, 8, 0, 1136], [22, 8, 0, 1237], [23, 11, 0, 1342], [24, 8, 0, 1466],
        ];

        foreach ($recordingKd2 as [$umur, $mati, $afkir, $abw]) {
            Recording::create([
                'periode_kandang_id' => $pk2->id,
                'tanggal' => $chickIn->copy()->addDays($umur),
                'umur' => $umur,
                'mati' => $mati,
                'afkir' => $afkir,
                'bobot_rata_gram' => $abw,
            ]);
        }
    }

    private function buatSampling(PeriodeKandang $pk1, PeriodeKandang $pk2, Carbon $chickIn): void
    {
        // Sampling Kandang 1: Umur 7, 14, 21 (3 sesi)
        $samplingKd1 = [
            [7, false, 20, [
                ['bawah', 'campuran', 'A', [800, 810]], ['bawah', 'campuran', 'B', [790, 800]],
                ['atas', 'campuran', 'J', [820, 830]], ['atas', 'campuran', 'K', [810, 820]],
            ]],
            [14, false, 20, [
                ['bawah', 'campuran', 'A', [4600, 4650]], ['bawah', 'campuran', 'B', [4550, 4600]],
                ['atas', 'campuran', 'J', [4700, 4750]], ['atas', 'campuran', 'K', [4650, 4700]],
            ]],
            [21, true, 10, [
                ['bawah', 'jantan', 'A', [12500, 12600]], ['bawah', 'betina', 'A', [10800, 10900]],
                ['atas', 'jantan', 'J', [12400, 12500]], ['atas', 'betina', 'J', [10900, 11000]],
            ]],
        ];

        foreach ($samplingKd1 as [$umur, $sexing, $ekor, $titik]) {
            $sesi = SesiSampling::create([
                'periode_kandang_id' => $pk1->id,
                'tanggal' => $chickIn->copy()->addDays($umur),
                'umur' => $umur,
                'dengan_sexing' => $sexing,
            ]);

            foreach ($titik as $index => [$lantai, $kelamin, $line, $beratArray]) {
                foreach ($beratArray as $urutan => $gram) {
                    TitikSampling::create([
                        'sesi_sampling_id' => $sesi->id,
                        'lantai' => $lantai,
                        'line' => $line,
                        'kelamin' => $kelamin,
                        'urutan' => $urutan + 1,
                        'berat_gram' => $gram,
                        'ekor' => $ekor,
                    ]);
                }
            }
        }

        // Sampling Kandang 2: 15 hari (umur 1 sampai 15)
        $hariSampling = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        $baseWeight = 60;

        foreach ($hariSampling as $index => $umur) {
            $sexing = $umur >= 14;
            $ekor = $sexing ? 10 : 20;
            $beratBase = $baseWeight + ($index * 90);

            $sesi = SesiSampling::create([
                'periode_kandang_id' => $pk2->id,
                'tanggal' => $chickIn->copy()->addDays($umur),
                'umur' => $umur,
                'dengan_sexing' => $sexing,
            ]);

            if ($sexing) {
                // Dengan sexing
                foreach (['bawah', 'atas'] as $lantai) {
                    foreach ([['A', 'jantan'], ['A', 'betina'], ['J', 'jantan'], ['J', 'betina']] as [$line, $kelamin]) {
                        $beratJantan = $beratBase + ($kelamin === 'jantan' ? 150 : 0);
                        TitikSampling::create([
                            'sesi_sampling_id' => $sesi->id,
                            'lantai' => $lantai,
                            'line' => $line,
                            'kelamin' => $kelamin,
                            'urutan' => 1,
                            'berat_gram' => $beratJantan,
                            'ekor' => $ekor,
                        ]);
                    }
                }
            } else {
                // Tanpa sexing
                foreach (['bawah', 'atas'] as $lantai) {
                    foreach (['A', 'B', 'J', 'K'] as $line) {
                        TitikSampling::create([
                            'sesi_sampling_id' => $sesi->id,
                            'lantai' => $lantai,
                            'line' => $line,
                            'kelamin' => 'campuran',
                            'urutan' => 1,
                            'berat_gram' => $beratBase + rand(-20, 20),
                            'ekor' => $ekor,
                        ]);
                    }
                }
            }
        }
    }

    private function lengkapiPanen(Periode $periode, array $pemanen): void
    {
        // Panen sudah ada dari PanenSeeder, pastikan pemanennya update
        $notaPanen = NotaPanen::query()->orderBy('id')->get();

        foreach ($notaPanen as $nota) {
            // Update pembeli jadi nama fiktif
            $pembeliFiktif = ['CV Pembeli Sejahtera', 'CV Mitra Unggas', 'PT Ayam Jaya', 'CV Broiler Utama'];
            $nota->pembeli = $pembeliFiktif[array_rand($pembeliFiktif)];
            $nota->no_spa = 'SPA-DEMO-'.$nota->id;
            $nota->no_btpa = 'BTPA-DEMO-'.$nota->id;
            $nota->no_polisi = 'DEMO '.str_pad((string) $nota->id, 4, '0', STR_PAD_LEFT);
            $nota->save();

            // Update pemanen dengan nama fiktif (jika belum ada)
            if ($nota->pemanenKrat->isEmpty()) {
                $jumlahPemanen = rand(2, 4);
                $kratPerPemanen = (int) floor($nota->jumlah_krat / $jumlahPemanen);

                for ($i = 0; $i < $jumlahPemanen; $i++) {
                    $pemanenTerpilih = $pemanen[array_rand($pemanen)];
                    NotaPanenPemanen::create([
                        'nota_panen_id' => $nota->id,
                        'nama' => $pemanenTerpilih->nama,
                        'krat_mulai' => ($i * $kratPerPemanen) + 1,
                        'berat_timbang_kg' => $kratPerPemanen * ($nota->berat_kg / $nota->jumlah_krat),
                    ]);
                }
            }
        }
    }

    private function buatBagiHasil(PeriodeKandang $pk1, PeriodeKandang $pk2, array $karyawan, array $pemodal): array
    {
        // Bagi Hasil Kandang 1
        $bagiHasil1 = BagiHasil::create([
            'periode_kandang_id' => $pk1->id,
            'controller' => 'Controller Demo A',
            'operasional' => 15_000_000,
            'tarif_gaji_abk_per_kg' => 125,
            'premi_controller' => 500_000,
            'persen_upah_controller' => 2.5,
            'persen_bonus_pasar_abk' => 1.0,
            'persen_bonus_pasar_controller' => 0.5,
            'persen_zakat' => 2.5,
            'status' => 'sementara',
        ]);

        // Penerima: 4 ABK KD1
        foreach ($karyawan['kd1'] as $index => $kar) {
            PenerimaBagiHasil::create([
                'bagi_hasil_id' => $bagiHasil1->id,
                'peran' => PeranBagiHasil::Abk,
                'nama' => $kar->nama,
                'urutan' => $index + 1,
                'dijumlahkan' => true,
            ]);
        }

        // Pemodal KD1
        foreach ($pemodal as $pm) {
            $persen = $pm->porsiDi(Kandang::find($pk1->kandang_id));
            if ($persen) {
                PenerimaBagiHasil::create([
                    'bagi_hasil_id' => $bagiHasil1->id,
                    'peran' => PeranBagiHasil::Pemodal,
                    'nama' => $pm->nama,
                    'persen' => $persen,
                    'dijumlahkan' => true,
                ]);
            }
        }

        // Bagi Hasil Kandang 2
        $bagiHasil2 = BagiHasil::create([
            'periode_kandang_id' => $pk2->id,
            'controller' => 'Controller Demo B',
            'operasional' => 18_000_000,
            'tarif_gaji_abk_per_kg' => 130,
            'premi_controller' => 600_000,
            'persen_upah_controller' => 2.5,
            'persen_bonus_pasar_abk' => 1.0,
            'persen_bonus_pasar_controller' => 0.5,
            'persen_zakat' => 2.5,
            'status' => 'sementara',
        ]);

        // Penerima: 4 ABK KD2 (Joker tidak masuk bagi hasil)
        foreach ($karyawan['kd2'] as $index => $kar) {
            if ($kar->jabatan === Jabatan::Abk) {
                PenerimaBagiHasil::create([
                    'bagi_hasil_id' => $bagiHasil2->id,
                    'peran' => PeranBagiHasil::Abk,
                    'nama' => $kar->nama,
                    'urutan' => $index + 1,
                    'dijumlahkan' => true,
                ]);
            }
        }

        // Pemodal KD2
        foreach ($pemodal as $pm) {
            $persen = $pm->porsiDi(Kandang::find($pk2->kandang_id));
            if ($persen) {
                PenerimaBagiHasil::create([
                    'bagi_hasil_id' => $bagiHasil2->id,
                    'peran' => PeranBagiHasil::Pemodal,
                    'nama' => $pm->nama,
                    'persen' => $persen,
                    'dijumlahkan' => true,
                ]);
            }
        }

        return ['kd1' => $bagiHasil1, 'kd2' => $bagiHasil2];
    }

    private function buatPayroll(PeriodeKandang $pk1, PeriodeKandang $pk2, array $karyawan, array $bagiHasil): array
    {
        $slipGaji = [];

        // Slip Gaji Kandang 1 - 4 ABK
        foreach ($karyawan['kd1'] as $index => $kar) {
            $penerima = $bagiHasil['kd1']->penerima->where('nama', $kar->nama)->first();

            $slip = SlipGaji::create([
                'periode_kandang_id' => $pk1->id,
                'karyawan_id' => $kar->id,
                'penerima_bagi_hasil_id' => $penerima?->id,
                'nama' => $kar->nama,
                'jabatan' => $kar->jabatan,
                'hari_kerja' => 56,
                'gaji_pokok' => 0,
                'premi_pemeliharaan' => 0,
                'premi_panen' => rand(300_000, 500_000),
                'premi_geomembran' => rand(240_000, 420_000),
                'penghasilan_kotoran' => 1_415_000,
                'uang_makan' => 1_960_000,
                'pinjaman' => 0,
                'potongan_lain' => 0,
                'urutan' => $index + 1,
            ]);

            $slipGaji[] = $slip;
        }

        // Slip Gaji Kandang 2 - 4 ABK + 1 Joker
        foreach ($karyawan['kd2'] as $index => $kar) {
            $penerima = null;
            if ($kar->jabatan === Jabatan::Abk) {
                $penerima = $bagiHasil['kd2']->penerima->where('nama', $kar->nama)->first();
            }

            $isJoker = $kar->jabatan === Jabatan::Joker;

            $slip = SlipGaji::create([
                'periode_kandang_id' => $pk2->id,
                'karyawan_id' => $kar->id,
                'penerima_bagi_hasil_id' => $penerima?->id,
                'nama' => $kar->nama,
                'jabatan' => $kar->jabatan,
                'hari_kerja' => $isJoker ? 30 : 56,
                'gaji_pokok' => $isJoker ? 2_000_000 : 0,
                'premi_pemeliharaan' => $isJoker ? 1_960_000 : 0,
                'premi_panen' => rand(300_000, 500_000),
                'premi_geomembran' => rand(240_000, 420_000),
                'penghasilan_kotoran' => 2_115_000,
                'uang_makan' => $isJoker ? 0 : 1_960_000,
                'pinjaman' => 0,
                'potongan_lain' => 0,
                'urutan' => $index + 1,
            ]);

            $slipGaji[] = $slip;
        }

        return $slipGaji;
    }

    private function buatKasbon(Periode $periode, array $karyawan, array $slipGaji): void
    {
        // Kasbon untuk 3 karyawan acak
        $karyawanTerpilih = array_slice($karyawan['semua'], 0, 3);

        $keperluan = ['HP', 'Motor', 'Renovasi Rumah'];

        foreach ($karyawanTerpilih as $index => $kar) {
            $jumlah = rand(1_500_000, 5_000_000);
            $nilaiPotongan = rand(300_000, 500_000);
            $jumlahPotongan = (int) ceil($jumlah / $nilaiPotongan);

            // Cari periode kandang si karyawan
            $periodeKandang = PeriodeKandang::query()
                ->where('periode_id', $periode->id)
                ->where('kandang_id', $kar->kandang_id)
                ->first();

            if (! $periodeKandang) {
                continue;
            }

            // Buat transaksi kas
            $transaksiKas = TransaksiKas::create([
                'periode_kandang_id' => $periodeKandang->id,
                'tanggal' => $periode->tanggal_chick_in->copy()->addDays(rand(5, 15)),
                'kategori' => KategoriKas::PinjamanKaryawan,
                'uraian' => 'Kasbon '.$kar->nama.' ('.$keperluan[$index].')',
                'jumlah' => $jumlah,
            ]);

            $kasbon = Kasbon::create([
                'karyawan_id' => $kar->id,
                'periode_id' => $periode->id,
                'tanggal' => $transaksiKas->tanggal,
                'keperluan' => $keperluan[$index],
                'jumlah' => $jumlah,
                'jumlah_potongan' => $jumlahPotongan,
                'nilai_potongan' => $nilaiPotongan,
                'transaksi_kas_id' => $transaksiKas->id,
            ]);

            // Potongan pertama di slip gaji periode ini
            $slipKaryawan = collect($slipGaji)->firstWhere('karyawan_id', $kar->id);

            if ($slipKaryawan) {
                PotonganKasbon::create([
                    'kasbon_id' => $kasbon->id,
                    'slip_gaji_id' => $slipKaryawan->id,
                    'jumlah' => min($nilaiPotongan, $jumlah),
                ]);

                // Update pinjaman di slip
                $slipKaryawan->pinjaman = min($nilaiPotongan, $jumlah);
                $slipKaryawan->save();
            }
        }
    }

    private function buatKohe(Farm $farm, Kandang $kandang1, Kandang $kandang2, Carbon $chickIn): void
    {
        // Kohe stok masuk berkala
        $tanggalStok = [
            [$chickIn->copy()->addDays(15), $kandang1, 120, 'Pembersihan rutin minggu 2'],
            [$chickIn->copy()->addDays(20), $kandang2, 150, 'Pembersihan rutin minggu 3'],
            [$chickIn->copy()->addDays(25), $kandang1, 100, 'Pembersihan tambahan'],
            [$chickIn->copy()->addDays(30), $kandang2, 130, 'Pembersihan sebelum panen'],
        ];

        foreach ($tanggalStok as [$tanggal, $kandang, $karung, $keterangan]) {
            KoheStok::create([
                'farm_id' => $farm->id,
                'kandang_id' => $kandang->id,
                'tanggal' => $tanggal,
                'jumlah_karung' => $karung,
                'keterangan' => $keterangan,
            ]);
        }

        // Penjualan kohe
        $tanggalJual = [
            [$chickIn->copy()->addDays(18), 'Tani Subur Makmur', 80, 15000],
            [$chickIn->copy()->addDays(28), 'Kebun Sentosa', 100, 15000],
            [$chickIn->copy()->addDays(35), 'CV Pupuk Organik', 150, 14500],
        ];

        foreach ($tanggalJual as [$tanggal, $pembeli, $karung, $harga]) {
            KohePenjualan::create([
                'farm_id' => $farm->id,
                'tanggal' => $tanggal,
                'nama_pembeli' => $pembeli,
                'jumlah_karung' => $karung,
                'harga_per_karung' => $harga,
            ]);
        }
    }
}
