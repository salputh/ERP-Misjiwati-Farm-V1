<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Pemanen;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Payroll pemanen')]
class PayrollPemanen extends Component
{
    use MemilihPeriode;

    /**
     * @return array{
     *     jumlah_nota: int,
     *     berat_total: float,
     *     berat_teralokasi: float,
     *     berat_nama_belum_terdaftar: float,
     *     berat_tanpa_nama: float,
     *     total_upah: int,
     *     pemanen: list<array{nama: string, jumlah_nota: int, berat_kg: float, upah_per_kg: int, total_upah: int}>,
     *     nama_belum_terdaftar: list<array{nama: string, berat_kg: float}>
     * }|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        if (! $this->periode) {
            return null;
        }

        $notas = $this->periode->notaPanen()->with('pemanenKrat')->orderBy('mulai')->get();
        if ($notas->isEmpty()) {
            return null;
        }

        $pemanen = Pemanen::query()->orderBy('nama')->get();
        $pemanenMenurutNama = $pemanen->keyBy(fn (Pemanen $orang): string => mb_strtolower(trim($orang->nama)));
        $beratPerPemanen = [];
        $beratNamaBelumTerdaftar = [];
        $beratTanpaNama = 0;
        $beratTotal = 0;

        foreach ($notas as $nota) {
            $beratNota = (int) round((float) $nota->berat_kg * 100);
            $beratTotal += $beratNota;

            if ($nota->pemanenKrat->isNotEmpty()) {
                $totalKrat = (int) $nota->jumlah_krat;
                if ($totalKrat < 1) {
                    $beratTanpaNama += $beratNota;

                    continue;
                }

                $daftarPemanen = $nota->pemanenKrat->sortBy('krat_mulai')->values();
                $adaBeratTimbangManual = $daftarPemanen->contains(
                    fn ($pemanenNota): bool => $pemanenNota->berat_timbang_kg !== null,
                );
                $rentangPemanen = [];
                $beratManualTotal = 0;
                $kratTanpaBeratTotal = 0;
                $grupMenurutKratMulai = $daftarPemanen->groupBy('krat_mulai')->sortKeys()->values();

                foreach ($grupMenurutKratMulai as $index => $grupPemanen) {
                    $kratMulai = (int) $grupPemanen->first()->krat_mulai;
                    $kratSelesai = min(
                        $index + 1 < $grupMenurutKratMulai->count()
                            ? (int) $grupMenurutKratMulai[$index + 1]->first()->krat_mulai - 1
                            : $totalKrat,
                        $totalKrat,
                    );

                    if ($kratMulai < 1 || $kratMulai > $totalKrat || $kratSelesai < $kratMulai) {
                        continue;
                    }

                    foreach ($grupPemanen as $pemanenNota) {
                        $beratManual = $pemanenNota->berat_timbang_kg === null
                            ? null
                            : (int) round((float) $pemanenNota->berat_timbang_kg * 100);
                        $rentangPemanen[] = [
                            'pemanen' => $pemanenNota,
                            'krat_mulai' => $kratMulai,
                            'krat_selesai' => $kratSelesai,
                            'berat_manual' => $beratManual,
                        ];

                        if ($beratManual !== null) {
                            $beratManualTotal += $beratManual;
                        } else {
                            $kratTanpaBeratTotal += $kratSelesai - $kratMulai + 1;
                        }
                    }
                }

                $beratDialokasikan = 0;
                $beratPerNamaDiNota = [];
                $kratTanpaBeratTerkumulasi = 0;
                $beratSisaUntukPemanenTanpaBerat = max(0, $beratNota - $beratManualTotal);

                foreach ($rentangPemanen as $rentang) {
                    $pemanenNota = $rentang['pemanen'];
                    $kratMulai = $rentang['krat_mulai'];
                    $kratSelesai = $rentang['krat_selesai'];
                    if ($rentang['berat_manual'] !== null) {
                        $beratPemanen = $rentang['berat_manual'];
                    } elseif ($adaBeratTimbangManual && $kratTanpaBeratTotal > 0) {
                        $kratTanpaBeratTerkumulasi += $kratSelesai - $kratMulai + 1;
                        $sampai = (int) round(
                            $beratSisaUntukPemanenTanpaBerat * $kratTanpaBeratTerkumulasi / $kratTanpaBeratTotal,
                        );
                        $sebelum = (int) round(
                            $beratSisaUntukPemanenTanpaBerat
                            * ($kratTanpaBeratTerkumulasi - ($kratSelesai - $kratMulai + 1))
                            / $kratTanpaBeratTotal,
                        );
                        $beratPemanen = $sampai - $sebelum;
                    } else {
                        $sebelum = (int) round($beratNota * ($kratMulai - 1) / $totalKrat);
                        $sampai = (int) round($beratNota * $kratSelesai / $totalKrat);
                        $beratPemanen = $sampai - $sebelum;
                    }

                    $nama = trim((string) $pemanenNota->nama);

                    if ($nama === '') {
                        continue;
                    }

                    $beratDialokasikan += $beratPemanen;
                    $namaKunci = mb_strtolower($nama);
                    $beratPerNamaDiNota[$namaKunci] ??= ['nama' => $nama, 'berat' => 0];
                    $beratPerNamaDiNota[$namaKunci]['berat'] += $beratPemanen;
                }

                $beratTanpaNama += $beratNota - $beratDialokasikan;

                foreach ($beratPerNamaDiNota as $orang) {
                    $pemanenTerdaftar = $pemanenMenurutNama->get(mb_strtolower($orang['nama']));

                    if ($pemanenTerdaftar) {
                        $beratPerPemanen[$pemanenTerdaftar->id] ??= [
                            'nama' => $pemanenTerdaftar->nama,
                            'jumlah_nota' => 0,
                            'berat' => 0,
                            'upah_per_kg' => (int) $pemanenTerdaftar->upah_per_kg,
                        ];
                        $beratPerPemanen[$pemanenTerdaftar->id]['jumlah_nota']++;
                        $beratPerPemanen[$pemanenTerdaftar->id]['berat'] += $orang['berat'];

                        continue;
                    }

                    $namaKunci = mb_strtolower($orang['nama']);
                    $beratNamaBelumTerdaftar[$namaKunci] ??= ['nama' => $orang['nama'], 'berat' => 0];
                    $beratNamaBelumTerdaftar[$namaKunci]['berat'] += $orang['berat'];
                }

                continue;
            }

            $namaTim = collect(preg_split('/[,;\r\n]+/u', $nota->tukang_tangkap ?? '', -1, PREG_SPLIT_NO_EMPTY))
                ->map(fn (string $nama): string => trim($nama))
                ->filter()
                ->unique(fn (string $nama): string => mb_strtolower($nama))
                ->values();

            if ($namaTim->isEmpty()) {
                $beratTanpaNama += $beratNota;

                continue;
            }

            foreach ($namaTim as $nama) {
                $pemanenTerdaftar = $pemanenMenurutNama->get(mb_strtolower($nama));

                if ($pemanenTerdaftar) {
                    $beratPerPemanen[$pemanenTerdaftar->id] ??= [
                        'nama' => $pemanenTerdaftar->nama,
                        'jumlah_nota' => 0,
                        'berat' => 0,
                        'upah_per_kg' => (int) $pemanenTerdaftar->upah_per_kg,
                    ];
                    $beratPerPemanen[$pemanenTerdaftar->id]['jumlah_nota']++;
                    $beratPerPemanen[$pemanenTerdaftar->id]['berat'] += $beratNota;

                    continue;
                }

                $namaKunci = mb_strtolower($nama);
                $beratNamaBelumTerdaftar[$namaKunci] ??= ['nama' => $nama, 'berat' => 0];
                $beratNamaBelumTerdaftar[$namaKunci]['berat'] += $beratNota;
            }
        }

        $barisPemanen = collect($beratPerPemanen)
            ->map(fn (array $orang): array => [
                'nama' => $orang['nama'],
                'jumlah_nota' => $orang['jumlah_nota'],
                'berat_kg' => $orang['berat'] / 100,
                'upah_per_kg' => $orang['upah_per_kg'],
                'total_upah' => (int) round($orang['berat'] * $orang['upah_per_kg'] / 100),
            ])
            ->sortBy('nama')
            ->values();

        return [
            'jumlah_nota' => $notas->count(),
            'berat_total' => $beratTotal / 100,
            'berat_teralokasi' => (float) $barisPemanen->sum('berat_kg'),
            'berat_nama_belum_terdaftar' => array_sum(array_column($beratNamaBelumTerdaftar, 'berat')) / 100,
            'berat_tanpa_nama' => $beratTanpaNama / 100,
            'total_upah' => (int) $barisPemanen->sum('total_upah'),
            'pemanen' => $barisPemanen->all(),
            'nama_belum_terdaftar' => collect($beratNamaBelumTerdaftar)
                ->map(fn (array $orang): array => ['nama' => $orang['nama'], 'berat_kg' => $orang['berat'] / 100])
                ->sortBy('nama')
                ->values()
                ->all(),
        ];
    }

    public function render(): View
    {
        return view('livewire.payroll-pemanen');
    }
}
