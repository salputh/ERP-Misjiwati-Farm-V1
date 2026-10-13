<?php

namespace Database\Seeders;

use App\Models\HargaKontrak;
use App\Models\NotaPanen;
use App\Models\Periode;
use App\Models\RhppReal;
use App\Models\RhppSimulasi;
use Illuminate\Database\Seeder;

class RhppSeeder extends Seeder
{
    /**
     * Bracket harga kontrak P.17: batas bawah ABW (kg) => Rp/kg.
     * Lembar 'Harga Kontrak' tidak tersedia; bracket disimpulkan dari harga tiap nota di lembar
     * "Simulasi RHPP" dan cocok untuk seluruh 53 nota. Harga di luar rentang ini belum diketahui.
     *
     * @var array<string, int>
     */
    private const JULI_HARGA_KONTRAK = [
        '1.30' => 22145, '1.40' => 21935, '1.50' => 21775, '1.60' => 21670, '1.70' => 21600,
        '1.80' => 21520, '1.90' => 21440, '2.00' => 21330, '2.10' => 21190,
    ];

    /**
     * Harga real per nota dari tabel "Perbandingan Harga per Trip Mobil" di lembar "RHPP Real": no. BTPA => Rp/kg.
     *
     * @var array<string, int>
     */
    private const JULI_HARGA_REAL = [
        '15881' => 22703,
        '15882' => 22703,
        '15883' => 22488,
        '15884' => 22488,
        '15886' => 22324,
        '15887' => 22324,
        '15888' => 22324,
        '15889' => 22216,
        '15890' => 22144,
        '15891' => 22144,
        '15892' => 22144,
        '15893' => 22144,
        '15894' => 22144,
        '15895' => 22062,
        '15896' => 22216,
        '15897' => 22216,
        '15898' => 22216,
        '15899' => 22144,
        '15900' => 22144,
        '16351' => 22144,
        '16352' => 22062,
        '16353' => 22062,
        '16354' => 22062,
        '16355' => 22144,
        '16356' => 22062,
        '16357' => 21980,
        '16358' => 22062,
        '16359' => 22062,
        '16360' => 22062,
        '16361' => 21980,
        '16362' => 21868,
        '16363' => 21724,
        '16364' => 21868,
        '16365' => 21868,
        '16366' => 21868,
        '16367' => 21868,
        '16368' => 21980,
        '16369' => 21868,
        '16370' => 21980,
        '16371' => 21980,
        '16372' => 21868,
        '16373' => 21868,
        '16374' => 22062,
        '16375' => 21980,
        '16376' => 21868,
        '16377' => 21868,
        '16378' => 21724,
        '16379' => 21724,
        '16380' => 21724,
        '16381' => 21724,
        '16382' => 21724,
        '16383' => 21724,
        '16384' => 21724,
    ];

    /**
     * Rekap panen per kandang dari lembar "RHPP Real" bagian E: nama kandang => [trip, ekor, tonase (kg)].
     *
     * @var array<string, array{int, int, float}>
     */
    private const JULI_PANEN_KANDANG = [
        'Kandang 1' => [23, 19704, 32871.93],
        'Kandang 2' => [30, 24374, 46949.27],
    ];

    /**
     * Periode Juli 2026, dari lembar "Simulasi RHPP" dan "RHPP Real". Aman dijalankan ulang.
     */
    public function run(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->with('kandangPeriode.kandang')->firstOrFail();

        $bobotMinimum = array_keys(self::JULI_HARGA_KONTRAK);
        foreach ($bobotMinimum as $indeks => $bobotMin) {
            $bobotMaksimum = isset($bobotMinimum[$indeks + 1])
                ? number_format((float) $bobotMinimum[$indeks + 1] - 0.01, 2, '.', '')
                : 9.99;

            HargaKontrak::updateOrCreate(
                ['periode_id' => $periode->id, 'bobot_min_kg' => $bobotMin],
                ['bobot_max_kg' => $bobotMaksimum, 'harga_per_kg' => self::JULI_HARGA_KONTRAK[$bobotMin]],
            );
        }

        // Sel kuning lembar simulasi: harga DOC, biaya pakan (2.238 zak, rata-rata Rp 497.410 per zak), OVK, insentif.
        RhppSimulasi::updateOrCreate(['periode_id' => $periode->id], [
            'kontrak' => 'P.17',
            'harga_doc' => 9415,
            'biaya_pakan' => 1113204000,
            'biaya_ovk' => 2000000,
            'insentif' => 0,
        ]);

        RhppReal::updateOrCreate(['periode_id' => $periode->id], [
            'status' => 'sementara',
            'kantor' => 'Duri',
            'no_siklus' => 'F02410000018',
            'ppl' => 'Heri Pranata',
            'tanggal_proses' => '2026-08-28',
            'doc_ekor' => 45000,
            'doc_total' => 423675000,
            'pakan_kg' => 111900,
            'pakan_total' => 1113204000,
            'ovk_jumlah' => 3000,
            'ovk_satuan' => 'GR',
            'ovk_total' => 3297000,
            'fcr_aktual' => 1.402,
            'fcr_standar' => 1.487,
            'deplesi_persen' => 2.1,
            'deplesi_standar_persen' => 3.6,
            'umur_rata' => 30.08,
            'ip' => 420,
            'tarif_efisiensi_per_kg' => 260,
            'subsidi_harga_pasar' => 100730134,
        ]);

        foreach (self::JULI_HARGA_REAL as $noBtpa => $harga) {
            NotaPanen::where('periode_id', $periode->id)->where('no_btpa', $noBtpa)->update(['harga_real_per_kg' => $harga]);
        }

        foreach ($periode->kandangPeriode as $kandang) {
            [$trip, $ekor, $tonase] = self::JULI_PANEN_KANDANG[$kandang->kandang->nama];
            $kandang->update(['panen_trip' => $trip, 'panen_ekor' => $ekor, 'panen_tonase_kg' => $tonase]);
        }
    }
}
