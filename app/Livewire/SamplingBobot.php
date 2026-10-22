<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\PeriodeKandang;
use App\Models\Recording;
use App\Models\SesiSampling;
use App\Support\Format;
use App\Support\HasilSampling;
use App\Support\LembarRecording;
use App\Support\Standar;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('Sampling bobot')]
class SamplingBobot extends Component
{
    use MemilihPeriode;

    #[Url(as: 'kandang')]
    public ?int $periodeKandangId = null;

    #[Url(as: 'tanggal')]
    public string $tanggal = '';

    public bool $denganSexing = false;

    /**
     * Ekor per sampel tiap kelamin, dipakai sebagai isi awal setiap titik.
     *
     * @var array<string, int|string>
     */
    public array $ekor = [];

    /**
     * Jumlah ekor tiap titik: [lantai][kelamin][line][urutan].
     * Tiap titik boleh berbeda, sesuai jumlah ayam yang ditimbang saat itu.
     *
     * @var array<string, array<string, array<string, array<int, int|string|null>>>>
     */
    public array $ekorTitik = [];

    /**
     * Berat tiap sampel (gram): [lantai][kelamin][line][urutan].
     *
     * @var array<string, array<string, array<string, array<int, int|string|null>>>>
     */
    public array $berat = [];

    public ?int $sesiId = null;

    /**
     * Sesi riwayat yang hasilnya sedang ditampilkan di modal.
     */
    public ?int $sesiDilihatId = null;

    public ?string $pesan = null;

    public function mount(): void
    {
        if (! $this->terpilih) {
            return;
        }

        $this->periodeKandangId = $this->kandangAwal()?->id ?? $this->terpilih->id;
        unset($this->terpilih);
        if (! $this->tanggalSah($this->tanggal)) {
            $this->tanggal = $this->tanggalAwal()->format('Y-m-d');
        }

        $this->muatSesi();
    }

    /**
     * Kandang yang dibuka pertama kali: yang sesinya paling akhir, supaya halaman langsung
     * menunjuk kandangs yang datanya baru saja diperbarui, bukan sekadar yang pertama secara abjad.
     */
    private function kandangAwal(): ?PeriodeKandang
    {
        return $this->daftarKandang
            ->sortByDesc(fn (PeriodeKandang $satu): string => $satu->sesiSampling->max('tanggal')?->format('Y-m-d') ?? '')
            ->first();
    }

    /**
     * @return Collection<int, PeriodeKandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        if (! $this->periode) {
            return new Collection;
        }

        return $this->periode->kandangPeriode()
            ->with(['kandang', 'periode', 'recordings', 'pemberianPakan', 'sesiSampling.titik'])
            ->get()
            ->sortBy('kandang.nama')
            ->values();
    }

    #[Computed]
    public function terpilih(): ?PeriodeKandang
    {
        return $this->daftarKandang->firstWhere('id', $this->periodeKandangId) ?? $this->daftarKandang->first();
    }

    #[Computed]
    public function umur(): int
    {
        return $this->terpilih
            ? (int) $this->terpilih->tanggalChickInEfektif()->diffInDays(Carbon::parse($this->tanggal), false)
            : $this->periode->umurPada(Carbon::parse($this->tanggal));
    }

    /**
     * @return array<string, mixed>
     */
    #[Computed]
    public function hasil(): array
    {
        return $this->hitungHasil($this->berat, $this->ekorTitik, $this->denganSexing, $this->umur);
    }

    /**
     * Ringkasan sampling seluruh kandangs dalam periode, memakai sesi terbaru tiap kandangs:
     * jumlah titik, ekor, ABW tertimbang, dan pakan standar terhadap aktual.
     *
     * @return array{kandang: list<array<string, mixed>>, total: array<string, mixed>}
     */
    #[Computed]
    public function gabunganKandang(): array
    {
        $baris = [];
        $totalBerat = 0.0;
        $totalEkor = 0;
        $totalTitik = 0;

        foreach ($this->daftarKandang as $kandang) {
            $sesi = $kandang->sesiSampling->sortByDesc('tanggal')->first();
            $tanggalSesi = $sesi?->tanggal;
            $umur = (int) $kandang->tanggalChickInEfektif()->diffInDays($tanggalSesi ?? Carbon::parse($this->tanggal), false);
            $pakan = $this->hitungPakan($kandang, $umur, $sesi?->abw());

            $berat = (float) ($sesi?->titik->sum('berat_gram') ?? 0);
            $ekor = (int) ($sesi?->titik->sum('ekor') ?? 0);
            $totalBerat += $berat;
            $totalEkor += $ekor;
            $totalTitik += (int) ($sesi?->titik->count() ?? 0);

            $baris[] = [
                'periode_kandang_id' => $kandang->id,
                'kandang' => $kandang->kandang->nama,
                'tanggal' => $tanggalSesi,
                'umur' => $umur,
                'ada_sesi' => $sesi !== null,
                'terpilih' => $kandang->id === $this->terpilih?->id,
                'jenis' => $sesi?->dengan_sexing,
                'total' => $berat,
                'titik' => (int) ($sesi?->titik->count() ?? 0),
                'ekor' => $ekor,
                'abw' => $ekor > 0 ? $berat / $ekor : null,
                'zak_standar' => $pakan['zak_standar'],
                'zak' => $pakan['zak'],
            ];
        }

        return [
            'kandang' => $baris,
            'total' => [
                'total' => $totalBerat,
                'titik' => $totalTitik,
                'ekor' => $totalEkor,
                'abw' => $totalEkor > 0 ? $totalBerat / $totalEkor : null,
            ],
        ];
    }

    /**
     * Umur maksimal menurut tabel standar farm, dipakai untuk batas tanggal sampling.
     */
    #[Computed]
    public function umurMaksimal(): int
    {
        return $this->standar()->umurMaksimal();
    }

    /**
     * Pemberian pakan hari sampling terhadap standar, dan FCR dari ABW sampling.
     *
     * @return array{zak_standar: ?float, zak: ?float, fcr_standar: ?float, fcr: ?float, pakan_sampai_umur: ?int}
     */
    #[Computed]
    public function pakan(): array
    {
        return $this->hitungPakan($this->terpilih, $this->umur, $this->hasil['gabungan']['abw']);
    }

    /**
     * Hasil sesi riwayat yang dibuka di modal, dihitung dari sampel tersimpan tanpa menyentuh form.
     *
     * @return ?array{sesi: SesiSampling, ekor: array<string, int>, hasil: array<string, mixed>, pakan: array{zak_standar: ?float, zak: ?float, fcr_standar: ?float, fcr: ?float, pakan_sampai_umur: ?int}, lembar: array<string, mixed>}
     */
    #[Computed]
    public function dilihat(): ?array
    {
        $sesi = $this->riwayat->firstWhere('id', $this->sesiDilihatId);
        if (! $sesi) {
            return null;
        }

        $ekor = array_merge(config('sampling.ekor_per_sampel'), $sesi->ekorPerSampel());
        $hasil = $this->hitungHasil($sesi->isianBerat(), $sesi->isianEkor(), $sesi->dengan_sexing, $sesi->umur);
        $pakan = $this->hitungPakan($this->terpilih, $sesi->umur, $hasil['gabungan']['abw']);
        $kandang = $this->terpilih->kandang->nama;

        return [
            'sesi' => $sesi,
            'ekor' => $ekor,
            'hasil' => $hasil,
            'pakan' => $pakan,
            // Bahan gambar PNG yang dilukis di peramban (resources/js/gambar-sampling.js).
            'lembar' => [
                'berkas' => 'sampling-'.Str::slug($kandang).'-'.$sesi->tanggal->format('Y-m-d'),
                'kandang' => $kandang,
                'tanggal' => $sesi->tanggal->translatedFormat('j F Y'),
                'umur' => $sesi->umur,
                'dengan_sexing' => $sesi->dengan_sexing,
                'ekor' => $ekor,
                'lantai' => array_map(fn (array $info): string => $info['label'], config('sampling.lantai')),
                'hasil' => $hasil,
                'pakan' => $pakan,
            ],
        ];
    }

    /**
     * Tanggal terpilih untuk judul modal konfirmasi: 3 Oktober 2026.
     */
    #[Computed]
    public function labelTanggal(): string
    {
        return Carbon::parse($this->tanggal)->translatedFormat('j F Y');
    }

    /**
     * Sesi tersimpan kandang terpilih, terbaru dulu.
     *
     * @return \Illuminate\Support\Collection<int, SesiSampling>
     */
    #[Computed]
    public function riwayat(): \Illuminate\Support\Collection
    {
        return $this->terpilih?->sesiSampling->sortByDesc('tanggal')->values() ?? collect();
    }

    public function updatedPeriodeKandangId(): void
    {
        unset($this->terpilih);
        $this->muatSesi();
    }

    public function updatedTanggal(): void
    {
        if (! $this->tanggalSah($this->tanggal)) {
            $this->tanggal = $this->tanggalAwal()->format('Y-m-d');
        }

        unset($this->umur, $this->labelTanggal);
        $this->muatSesi();
    }

    /**
     * Jumlah ekor per sampel berlaku untuk semua titik alike, jadi mengubahnya
     * menulis ulang jumlah ekor setiap titik kelamin itu.
     */
    public function updatedEkor(mixed $nilai, string $kelamin): void
    {
        if (! is_numeric($nilai)) {
            return;
        }

        foreach (config('sampling.lantai') as $lantai => $info) {
            foreach ($info['line'] as $line) {
                for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                    $this->ekorTitik[$lantai][$kelamin][$line][$urutan] = (int) $nilai;
                }
            }
        }
    }

    public function pilihJenis(bool $denganSexing): void
    {
        $this->denganSexing = $denganSexing;
        $this->isiEkorTitikKosong();
    }

    /**
     * Buka form sampling untuk satu kandang pada tanggal sesinya, dipakai dari ringkasan kandangs.
     */
    public function bukaSesi(int $periodeKandangId, string $tanggal): void
    {
        $this->periodeKandangId = $periodeKandangId;
        $this->tanggal = $tanggal;
        unset($this->terpilih, $this->umur, $this->labelTanggal);
        $this->muatSesi();
    }

    /**
     * Tampilkan hasil sesi riwayat di modal; isian form tidak berubah.
     */
    public function buka(int $sesiId): void
    {
        $this->sesiDilihatId = $this->riwayat->firstWhere('id', $sesiId)?->id;
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $this->validate($this->aturan(), [
            'berat.*.*.*.*.required' => 'Isi semua berat sampel.',
            'berat.*.*.*.*.integer' => 'Berat harus angka bulat (gram).',
            'berat.*.*.*.*.min' => 'Berat harus lebih dari 0.',
            'ekorTitik.*.*.*.*.required' => 'Isi jumlah ekor setiap titik.',
            'ekorTitik.*.*.*.*.integer' => 'Jumlah ekor harus angka bulat.',
            'ekorTitik.*.*.*.*.min' => 'Jumlah ekor harus lebih dari 0.',
        ]);

        $kelaminAktif = HasilSampling::kelamin($this->denganSexing);

        $sesi = DB::transaction(function () use ($kelaminAktif): SesiSampling {
            // Satu sesi per kandang per tanggal; dicari dengan whereDate karena kolom tanggal tersimpan sebagai datetime.
            $sesi = SesiSampling::where('periode_kandang_id', $this->terpilih->id)->whereDate('tanggal', $this->tanggal)->first()
                ?? new SesiSampling(['periode_kandang_id' => $this->terpilih->id, 'tanggal' => $this->tanggal]);
            $sesi->fill(['umur' => $this->umur, 'dengan_sexing' => $this->denganSexing])->save();

            $sesi->titik()->delete();
            foreach (config('sampling.lantai') as $lantai => $info) {
                foreach ($kelaminAktif as $kelamin) {
                    foreach ($info['line'] as $line) {
                        for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                            $sesi->titik()->create([
                                'lantai' => $lantai,
                                'line' => $line,
                                'kelamin' => $kelamin,
                                'urutan' => $urutan,
                                'berat_gram' => (int) $this->berat[$lantai][$kelamin][$line][$urutan],
                                'ekor' => (int) $this->ekorTitik[$lantai][$kelamin][$line][$urutan],
                            ]);
                        }
                    }
                }
            }

            Aktivitas::catat(
                $sesi->wasRecentlyCreated ? JenisAktivitas::Tambah : JenisAktivitas::Ubah,
                ModulAktivitas::SamplingBobot,
                'Sampling bobot '.$this->labelTanggal,
                "{$this->terpilih->kandang->nama}, {$this->periode->nama}",
            );

            return $sesi;
        });

        $abw = $sesi->abw();
        if ($abw !== null) {
            $this->isiRecording((float) $abw);
        }

        $this->sesiId = $sesi->id;
        $this->pesan = 'Sampling '.Carbon::parse($this->tanggal)->translatedFormat('j F Y').' tersimpan.'
            .($abw !== null ? ' ABW '.Format::angka($abw, 1).' g masuk ke recording harian.' : '');
        unset($this->daftarKandang, $this->terpilih, $this->riwayat, $this->gabunganKandang);
    }

    public function render(): View
    {
        return view('livewire.sampling-bobot');
    }

    /**
     * Isi form dari sesi tersimpan pada tanggal terpilih, atau kosongkan dan pilih jenis sampling sesuai umur.
     */
    private function muatSesi(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $sesi = $this->terpilih?->sesiSampling->first(fn (SesiSampling $sesi): bool => $sesi->tanggal->format('Y-m-d') === $this->tanggal);

        $this->sesiId = $sesi?->id;
        $this->denganSexing = $sesi ? $sesi->dengan_sexing : $this->umur >= config('sampling.umur_mulai_sexing');
        $this->ekor = array_merge(config('sampling.ekor_per_sampel'), $sesi?->ekorPerSampel() ?? []);
        $this->berat = $sesi?->isianBerat() ?? [];
        $this->ekorTitik = $sesi?->isianEkor() ?? [];
        $this->isiEkorTitikKosong();
    }

    /**
     * @return array<string, mixed>
     */
    private function aturan(): array
    {
        $aturan = [];
        foreach (HasilSampling::kelamin($this->denganSexing) as $kelamin) {
            $aturan["ekor.{$kelamin}"] = ['required', 'integer', 'min:1', 'max:500'];
            foreach (config('sampling.lantai') as $lantai => $info) {
                foreach ($info['line'] as $line) {
                    for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                        $aturan["berat.{$lantai}.{$kelamin}.{$line}.{$urutan}"] = ['required', 'integer', 'min:1', 'max:1000000'];
                        $aturan["ekorTitik.{$lantai}.{$kelamin}.{$line}.{$urutan}"] = ['required', 'integer', 'min:1', 'max:500'];
                    }
                }
            }
        }

        return $aturan;
    }

    /**
     * @param  array<string, array<string, array<string, array<int, int|string|null>>>>  $berat
     * @param  array<string, array<string, array<string, array<int, int|string|null>>>>  $ekorTitik
     * @return array<string, mixed>
     */
    private function hitungHasil(array $berat, array $ekorTitik, bool $denganSexing, int $umur): array
    {
        $sesiSebelumnya = $this->sesiSebelumUmur($umur);
        $acuan = $this->acuan($umur, $sesiSebelumnya);

        // Data per lantai hanya dipakai bila sesi sebelumnya benar-benar penimbangan terakhir.
        // Kalau ada penimbangan yang lebih baru (misalnya recording), satu-satunya acuan adalah ABW gabungan.
        $kelompok = $sesiSebelumnya && $sesiSebelumnya->umur >= (int) ($acuan['umur'] ?? 0)
            ? $sesiSebelumnya->abwKelompok()
            : [];
        $hariAcuanKelompok = $sesiSebelumnya ? max(1, $umur - (int) $sesiSebelumnya->umur) : 1;

        return HasilSampling::hitung(
            $berat,
            $ekorTitik,
            $denganSexing,
            $umur,
            $this->standar(),
            $acuan['abw'],
            $kelompok,
            $acuan['hari'],
            $hariAcuanKelompok,
        );
    }

    /**
     * Acuan DG: penimbangan terakhir sebelum sesi ini. Sesi sampling dan recording sama-sama dipakai,
     * yang paling baru dipilih, lalu jaraknya dipakai untuk menormalkan DG per hari.
     *
     * @return array{abw: ?float, umur: ?int, hari: int}
     */
    private function acuan(int $umur, ?SesiSampling $sesiSebelumnya): array
    {
        $kandidat = [];

        if ($sesiSebelumnya !== null && $sesiSebelumnya->abw() !== null) {
            $kandidat[] = ['abw' => $sesiSebelumnya->abw(), 'umur' => (int) $sesiSebelumnya->umur];
        }

        $recording = $this->terpilih?->recordings
            ->filter(fn (Recording $satu): bool => $satu->umur < $umur && $satu->bobot_rata_gram !== null)
            ->last();
        if ($recording) {
            $kandidat[] = ['abw' => (float) $recording->bobot_rata_gram, 'umur' => (int) $recording->umur];
        }

        if ($kandidat === []) {
            $beratDoc = (float) ($this->terpilih?->beratDocGramEfektif() ?? 0);

            return ['abw' => $beratDoc > 0 ? $beratDoc : null, 'umur' => 0, 'hari' => max(1, $umur)];
        }

        $dipilih = collect($kandidat)->sortByDesc('umur')->first();

        return [
            'abw' => $dipilih['abw'],
            'umur' => $dipilih['umur'],
            'hari' => max(1, $umur - (int) $dipilih['umur']),
        ];
    }

    /**
     * @return array{zak_standar: ?float, zak: ?float, fcr_standar: ?float, fcr: ?float, pakan_sampai_umur: ?int}
     */
    private function hitungPakan(PeriodeKandang $kandang, int $umur, ?float $abw): array
    {
        $baris = collect(LembarRecording::baris($kandang));
        $hariIni = $baris->firstWhere('umur', $umur);
        $pakanTerakhir = $baris->filter(fn (array $hari): bool => $hari['umur'] <= $umur && isset($hari['pakan_gram_kumulatif']))->last();
        $pemberian = $kandang->pemberianPakan->where('umur', $umur);

        return [
            'zak_standar' => $hariIni ? $hariIni['pakan_gram_standar'] * $hariIni['saldo'] / (config('standar.kg_per_zak') * 1000) : null,
            'zak' => $pemberian->isEmpty() ? null : (float) $pemberian->sum('zak'),
            'fcr_standar' => $hariIni['fcr_standar'] ?? null,
            'fcr' => $abw && $pakanTerakhir ? $pakanTerakhir['pakan_gram_kumulatif'] / $abw : null,
            'pakan_sampai_umur' => $pakanTerakhir['umur'] ?? null,
        ];
    }

    private function standar(): Standar
    {
        return new Standar($this->periode->strain, (float) ($this->terpilih?->beratDocGramEfektif() ?? $this->periode->berat_doc_gram));
    }

    /**
     * Sesi sampling terakhir yang umurnya lebih kecil dari umur yang dihitung.
     */
    private function sesiSebelumUmur(int $umur): ?SesiSampling
    {
        return $this->terpilih?->sesiSampling
            ->filter(fn (SesiSampling $sesi): bool => $sesi->umur < $umur)
            ->sortByDesc('umur')
            ->first();
    }

    /**
     * Isi jumlah ekor titik yang belum ada, memakai nilai bawaan tiap kelamin.
     */
    private function isiEkorTitikKosong(): void
    {
        foreach (HasilSampling::kelamin($this->denganSexing) as $kelamin) {
            $bawaan = (int) ($this->ekor[$kelamin] ?? config("sampling.ekor_per_sampel.{$kelamin}") ?? 0);
            foreach (config('sampling.lantai') as $lantai => $info) {
                foreach ($info['line'] as $line) {
                    for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                        if (! isset($this->ekorTitik[$lantai][$kelamin][$line][$urutan])) {
                            $this->ekorTitik[$lantai][$kelamin][$line][$urutan] = $bawaan;
                        }
                    }
                }
            }
        }
    }

    /**
     * ABW hasil sampling mengisi ABW aktual di recording harian, jadi tidak perlu disalin manual.
     */
    private function isiRecording(float $abw): void
    {
        $rekaman = Recording::where('periode_kandang_id', $this->terpilih->id)
            ->whereDate('tanggal', $this->tanggal)
            ->first();

        if (! $rekaman) {
            Recording::create([
                'periode_kandang_id' => $this->terpilih->id,
                'tanggal' => $this->tanggal,
                'umur' => $this->umur,
                'mati' => 0,
                'afkir' => 0,
                'bobot_rata_gram' => round($abw, 1),
                'catatan' => 'ABW dari sampling bobot; kematian dan afkir belum dicatat.',
            ]);

            return;
        }

        $rekaman->fill(['bobot_rata_gram' => round($abw, 1)])->save();
    }

    private function tanggalSah(string $tanggal): bool
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || ! $this->periode) {
            return false;
        }

        $umur = $this->terpilih
            ? (int) $this->terpilih->tanggalChickInEfektif()->diffInDays(Carbon::parse($tanggal), false)
            : $this->periode->umurPada(Carbon::parse($tanggal));

        return $umur >= 0 && $umur <= $this->standar()->umurMaksimal();
    }

    /**
     * Hari ini bila masih di dalam periode, selain itu sesi sampling terakhir atau hari pertama.
     */
    private function tanggalAwal(): Carbon
    {
        if ($this->tanggalSah(today()->format('Y-m-d'))) {
            return today();
        }

        return $this->terpilih?->sesiSampling->last()?->tanggal
            ?? $this->terpilih?->tanggalChickInEfektif()->copy()->addDay()
            ?? $this->periode->tanggal_chick_in->copy()->addDay();
    }
}
