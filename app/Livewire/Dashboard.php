<?php

namespace App\Livewire;

use App\Enums\StatusBobot;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\PeriodeKandang;
use App\Support\Standar;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Ringkasan')]
class Dashboard extends Component
{
    use MemilihPeriode;

    /**
     * Rentang sumbu umur pada grafik bobot (hari).
     */
    private const HARI_MAKS = 42;

    /**
     * Jumlah aktivitas di kartu aktivitas terbaru.
     */
    private const JUMLAH_AKTIVITAS = 6;

    /**
     * Ringkasan tiap kandang pada periode terpilih, urut nama.
     *
     * @return list<array<string, mixed>>
     */
    #[Computed]
    public function kandang(): array
    {
        if (! $this->periode) {
            return [];
        }

        $kgPerZakStandar = config('standar.kg_per_zak');

        return $this->periode->kandangPeriode()
            ->with(['kandang', 'periode', 'recordings', 'pemberianPakan.jenisPakan'])
            ->get()
            ->sortBy('kandang.nama')
            ->map(function (PeriodeKandang $periodeKandang) use ($kgPerZakStandar): array {
                $ringkasan = $periodeKandang->ringkasan();
                $nama = $periodeKandang->kandang->nama;
                $standarKandang = new Standar($this->periode->strain, (float) $periodeKandang->beratDocGramEfektif());

                return $ringkasan + [
                    'nama' => $nama,
                    'kode' => trim(str_ireplace('kandang', '', $nama)) ?: $nama,
                    'status' => StatusBobot::dariSelisih($ringkasan['abw_selisih']),
                    'bobot_harian' => $this->interpolasi($ringkasan['titik_aktual'], $standarKandang),
                    'pakan_harian' => $periodeKandang->pemberianPakan->groupBy('umur')->map(
                        fn ($pemberian): float => (float) $pemberian->sum(
                            fn ($satu): float => $satu->zak * ($satu->jenisPakan?->kg_per_zak ?? $kgPerZakStandar),
                        ),
                    )->all(),
                    'kematian_harian' => $periodeKandang->recordings->mapWithKeys(fn ($r) => [$r->umur => $r->mati + $r->afkir])->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Total semua kandang.
     *
     * @return array{sisa: int, awal: int, mati: int, afkir: int, terpanen: int, mortalitas: float, pakan_kg: float, bobot_hidup_kg: float, fcr: ?float, abw: ?float, abw_standar: ?float, abw_selisih: ?float, abw_umur: ?int}
     */
    #[Computed]
    public function total(): array
    {
        $kandang = collect($this->kandang);
        $awal = (int) $kandang->sum('populasi_awal');
        $terpanen = (int) $this->periode->notaPanen()->sum('ekor');
        $sisa = (int) $kandang->sum('sisa') - $terpanen;
        $bobotHidup = (float) $kandang->sum(fn (array $k) => $k['abw'] ? $k['sisa'] * $k['abw'] / 1000 : 0);

        $gabungan = $this->bobotGabungan();
        $umurTimbang = $gabungan ? count($gabungan) - 1 : null;
        $abw = $gabungan ? (float) end($gabungan) : null;
        $standar = $umurTimbang !== null ? $this->standar()->abw($umurTimbang) : null;

        return [
            'sisa' => $sisa,
            'awal' => $awal,
            'mati' => (int) $kandang->sum('mati'),
            'afkir' => (int) $kandang->sum('afkir'),
            'terpanen' => $terpanen,
            'mortalitas' => $awal ? ($kandang->sum('mati') + $kandang->sum('afkir')) / $awal * 100 : 0.0,
            'pakan_kg' => (float) $kandang->sum('pakan_kg'),
            'bobot_hidup_kg' => $bobotHidup,
            // Rata-rata FCR kandang, ditimbang bobot hidup, supaya sama dengan lembar recording.
            'fcr' => $bobotHidup ? $kandang->sum(fn (array $k) => $k['fcr'] ? $k['fcr'] * $k['sisa'] * $k['abw'] / 1000 : 0) / $bobotHidup : null,
            'abw' => $abw,
            'abw_standar' => $standar,
            'abw_selisih' => $abw && $standar ? ($abw - $standar) / $standar * 100 : null,
            'abw_umur' => $umurTimbang,
        ];
    }

    /**
     * Data grafik untuk Chart.js: bobot per kandang dan gabungan terhadap standar, serta pakan dan kematian harian.
     *
     * @return array{hari: list<int>, standar: list<float>, bobot: array<string, array{nama: string, label: string, data: list<float>}>, umur: list<int>, pakan: list<float>, kematian: list<int>}
     */
    #[Computed]
    public function grafik(): array
    {
        $kandang = collect($this->kandang);

        $bobot = ['semua' => ['nama' => 'Semua kandang', 'label' => 'Semua', 'data' => $this->bobotGabungan()]];
        foreach ($this->kandang as $k) {
            // Kunci diberi awalan agar urutan tab tidak diubah JavaScript (kunci angka diurutkan lebih dulu).
            $bobot['kandang-'.$k['kode']] = ['nama' => $k['nama'], 'label' => $k['kode'], 'data' => $k['bobot_harian']];
        }

        $umur = $kandang->flatMap(fn (array $k) => [...array_keys($k['pakan_harian']), ...array_keys($k['kematian_harian'])])->unique()->sort()->values();

        return [
            'hari' => range(0, self::HARI_MAKS),
            'standar' => array_map(fn (int $umur) => $this->standar()->abw($umur), range(0, self::HARI_MAKS)),
            'bobot' => $bobot,
            'umur' => $umur->all(),
            'pakan' => $umur->map(fn (int $u) => round($kandang->sum(fn (array $k) => $k['pakan_harian'][$u] ?? 0), 1))->all(),
            'kematian' => $umur->map(fn (int $u) => (int) $kandang->sum(fn (array $k) => $k['kematian_harian'][$u] ?? 0))->all(),
        ];
    }

    /**
     * Aktivitas terakhir dari semua modul, tidak terbatas pada periode terpilih.
     *
     * @return Collection<int, Aktivitas>
     */
    #[Computed]
    public function aktivitasTerbaru(): Collection
    {
        return Aktivitas::terbaru()->limit(self::JUMLAH_AKTIVITAS)->get();
    }

    private function standar(): Standar
    {
        return new Standar($this->periode->strain, (float) $this->periode->berat_doc_gram);
    }

    public function render(): View
    {
        return view('livewire.dashboard');
    }

    /**
     * Bobot rata-rata semua kandang per hari, tertimbang jumlah ayam hidup,
     * sampai hari timbang terakhir yang dimiliki semua kandang.
     *
     * @return list<float>
     */
    private function bobotGabungan(): array
    {
        $kandang = collect($this->kandang);
        $jumlahHari = (int) $kandang->min(fn (array $k) => count($k['bobot_harian']));
        $totalHidup = $kandang->sum('sisa') ?: 1;

        $gabungan = [];
        for ($hari = 0; $hari < $jumlahHari; $hari++) {
            $gabungan[] = round($kandang->sum(fn (array $k) => $k['bobot_harian'][$hari] * $k['sisa']) / $totalHidup);
        }

        return $gabungan;
    }

    /**
     * Bobot harian dari hari 0 sampai timbang terakhir, linear di antara titik timbang.
     * Hari 0 memakai standar DOC.
     *
     * @param  list<array{umur: int, gram: float}>  $titik
     * @return list<float>
     */
    private function interpolasi(array $titik, Standar $standar): array
    {
        if (! $titik) {
            return [];
        }

        $titik = array_merge([['umur' => 0, 'gram' => $standar->abw(0)]], $titik);
        $hasil = [];
        for ($i = 1; $i < count($titik); $i++) {
            [$awal, $akhir] = [$titik[$i - 1], $titik[$i]];
            for ($hari = $awal['umur']; $hari < $akhir['umur']; $hari++) {
                $hasil[$hari] = round($awal['gram'] + ($akhir['gram'] - $awal['gram']) * ($hari - $awal['umur']) / ($akhir['umur'] - $awal['umur']));
            }
        }
        $terakhir = end($titik);
        $hasil[$terakhir['umur']] = (float) $terakhir['gram'];

        return array_values($hasil);
    }
}
