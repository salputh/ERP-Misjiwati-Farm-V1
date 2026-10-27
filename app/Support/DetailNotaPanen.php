<?php

namespace App\Support;

use App\Models\NotaPanen;
use App\Models\Pemanen;
use Carbon\CarbonInterface;

/**
 * Seluruh isi satu nota timbang (satu trip mobil) untuk modal detail di halaman Panen: identitas, waktu, timbangan,
 * harga kontrak dan real, serta pembagian berat ke tim tangkap memakai aturan yang sama dengan payroll pemanen.
 */
class DetailNotaPanen
{
    /**
     * Pakai relasi periode.hargaKontrak dan pemanenKrat yang sudah di-load.
     *
     * @param  ?int  $hariPanen  nomor hari panen nota ini di rekap panen
     * @return array{
     *     identitas: array{no_btpa: string, no_spa: ?string, tanggal: CarbonInterface, pembeli: string, no_polisi: string, hari: ?int},
     *     waktu: array{mulai: CarbonInterface, selesai: CarbonInterface, durasi_menit: int, durasi: string, umur: int},
     *     timbang: array{krat: int, ekor: int, berat: float, netto: float, selisih: float, bw: ?float, per_krat: ?float, ekor_per_krat: ?float},
     *     harga: array{kontrak: ?int, nilai_kontrak: ?int, real: ?int, nilai_real: ?int, selisih_harga: ?int, selisih_nilai: ?int},
     *     tim: list<array{nama: string, krat_mulai: ?int, krat_selesai: ?int, jumlah_krat: ?int, berat_kg: float, manual: bool, cara: string, status: string, tarif: ?int, upah: ?int}>,
     *     tanpa_nama_kg: float,
     *     nota_lama: bool,
     *     utama: list<array{label: string, nilai: string, catatan: string}>
     * }
     */
    public static function buat(NotaPanen $nota, ?int $hariPanen = null): array
    {
        $periode = $nota->periode;
        $berat = (float) $nota->berat_kg;
        $netto = (float) $nota->netto_nota_kg;
        $bw = $nota->ekor > 0 ? $berat / $nota->ekor : null;
        $hargaKontrak = LembarRhpp::hargaKontrak($periode->hargaKontrak, $bw);
        $nilaiKontrak = $hargaKontrak !== null ? LembarRhpp::nilaiPanen($berat, $hargaKontrak) : null;
        $hargaReal = $nota->harga_real_per_kg;
        $nilaiReal = $hargaReal !== null ? LembarRhpp::nilaiPanen($berat, $hargaReal) : null;

        $pemanen = Pemanen::query()->get()->keyBy(fn (Pemanen $orang): string => mb_strtolower(trim($orang->nama)));
        $alokasi = LembarPayrollPemanen::alokasiNota($nota);

        $tim = array_map(function (array $rentang) use ($pemanen): array {
            $terdaftar = $pemanen->get(mb_strtolower($rentang['nama']));
            $status = match (true) {
                LembarPayrollPemanen::abk($rentang['nama']) => 'abk',
                $terdaftar !== null => 'terdaftar',
                default => 'belum_terdaftar',
            };
            $tarif = $status === 'terdaftar' ? (int) $terdaftar->upah_per_kg : null;

            return [
                'nama' => $rentang['nama'],
                'krat_mulai' => $rentang['krat_mulai'],
                'krat_selesai' => $rentang['krat_selesai'],
                'jumlah_krat' => $rentang['krat_mulai'] !== null ? $rentang['krat_selesai'] - $rentang['krat_mulai'] + 1 : null,
                'berat_kg' => (float) ($rentang['berat'] / 100),
                'manual' => $rentang['manual'],
                'cara' => match (true) {
                    $rentang['manual'] => 'berat timbang aktual',
                    $rentang['krat_mulai'] === null => 'seluruh berat nota',
                    default => 'dibagi menurut krat',
                },
                'status' => $status,
                'tarif' => $tarif,
                'upah' => $tarif !== null ? (int) round($rentang['berat'] * $tarif / 100) : null,
            ];
        }, $alokasi['rentang']);

        $durasiMenit = (int) $nota->mulai->diffInMinutes($nota->selesai);

        return [
            'utama' => [
                ['label' => 'Ekor', 'nilai' => Format::angka($nota->ekor), 'catatan' => Format::angka($nota->jumlah_krat).' krat'],
                ['label' => 'Berat timbang', 'nilai' => Format::angka($berat, 2).' kg', 'catatan' => 'netto nota '.Format::angka($netto, 2).' kg'],
                ['label' => 'BW rata-rata', 'nilai' => Format::angka($bw, 3).' kg', 'catatan' => Format::angka($nota->jumlah_krat > 0 ? $berat / $nota->jumlah_krat : null, 2).' kg per krat'],
                ['label' => 'Umur panen', 'nilai' => $periode->umurPada($nota->mulai).' hari', 'catatan' => 'timbang '.self::durasi($durasiMenit)],
            ],
            'identitas' => [
                'no_btpa' => $nota->no_btpa,
                'no_spa' => $nota->no_spa,
                'tanggal' => $nota->tanggal_panen,
                'pembeli' => $nota->pembeli,
                'no_polisi' => $nota->no_polisi,
                'hari' => $hariPanen,
            ],
            'waktu' => [
                'mulai' => $nota->mulai,
                'selesai' => $nota->selesai,
                'durasi_menit' => $durasiMenit,
                'durasi' => self::durasi($durasiMenit),
                'umur' => $periode->umurPada($nota->mulai),
            ],
            'timbang' => [
                'krat' => (int) $nota->jumlah_krat,
                'ekor' => (int) $nota->ekor,
                'berat' => $berat,
                'netto' => $netto,
                'selisih' => round($berat - $netto, 2),
                'bw' => $bw,
                'per_krat' => $nota->jumlah_krat > 0 ? $berat / $nota->jumlah_krat : null,
                'ekor_per_krat' => $nota->jumlah_krat > 0 ? $nota->ekor / $nota->jumlah_krat : null,
            ],
            'harga' => [
                'kontrak' => $hargaKontrak,
                'nilai_kontrak' => $nilaiKontrak,
                'real' => $hargaReal,
                'nilai_real' => $nilaiReal,
                'selisih_harga' => $hargaKontrak !== null && $hargaReal !== null ? $hargaReal - $hargaKontrak : null,
                'selisih_nilai' => $nilaiKontrak !== null && $nilaiReal !== null ? $nilaiReal - $nilaiKontrak : null,
            ],
            'tim' => $tim,
            'tanpa_nama_kg' => (float) ($alokasi['tanpa_nama'] / 100),
            'nota_lama' => $nota->pemanenKrat->isEmpty() && $tim !== [],
        ];
    }

    /**
     * Lama timbang dalam kata: "1 jam 25 menit", "40 menit".
     */
    private static function durasi(int $menit): string
    {
        $jam = intdiv($menit, 60);
        $sisa = $menit % 60;

        return trim(($jam > 0 ? $jam.' jam ' : '').($sisa > 0 || $jam === 0 ? $sisa.' menit' : ''));
    }
}
