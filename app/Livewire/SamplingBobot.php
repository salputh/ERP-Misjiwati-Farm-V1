<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\PeriodeKandang;
use App\Models\SesiSampling;
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
     * Ekor per sampel tiap kelamin.
     *
     * @var array<string, int|string>
     */
    public array $ekor = [];

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

        $this->periodeKandangId = $this->terpilih->id;
        if (! $this->tanggalSah($this->tanggal)) {
            $this->tanggal = $this->tanggalAwal()->format('Y-m-d');
        }

        $this->muatSesi();
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
        return $this->periode->umurPada(Carbon::parse($this->tanggal));
    }

    /**
     * @return array<string, mixed>
     */
    #[Computed]
    public function hasil(): array
    {
        return $this->hitungHasil($this->berat, $this->ekor, $this->denganSexing, $this->umur);
    }

    /**
     * Pemberian pakan hari sampling terhadap standar, dan FCR dari ABW sampling.
     *
     * @return array{zak_standar: ?float, zak: ?float, fcr_standar: ?float, fcr: ?float, pakan_sampai_umur: ?int}
     */
    #[Computed]
    public function pakan(): array
    {
        return $this->hitungPakan($this->umur, $this->hasil['gabungan']['abw']);
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
        $hasil = $this->hitungHasil($sesi->isianBerat(), $ekor, $sesi->dengan_sexing, $sesi->umur);
        $pakan = $this->hitungPakan($sesi->umur, $hasil['gabungan']['abw']);
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

    public function pilihJenis(bool $denganSexing): void
    {
        $this->denganSexing = $denganSexing;
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
        $this->validate($this->aturan(), [
            'berat.*.*.*.*.required' => 'Isi semua berat sampel.',
            'berat.*.*.*.*.integer' => 'Berat harus angka bulat (gram).',
            'berat.*.*.*.*.min' => 'Berat harus lebih dari 0.',
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
                                'ekor' => (int) $this->ekor[$kelamin],
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

        $this->sesiId = $sesi->id;
        $this->pesan = 'Sampling '.Carbon::parse($this->tanggal)->translatedFormat('j F Y').' tersimpan.';
        unset($this->daftarKandang, $this->terpilih, $this->riwayat);
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
                    }
                }
            }
        }

        return $aturan;
    }

    /**
     * @param  array<string, array<string, array<string, array<int, int|string|null>>>>  $berat
     * @param  array<string, int|string>  $ekor
     * @return array<string, mixed>
     */
    private function hitungHasil(array $berat, array $ekor, bool $denganSexing, int $umur): array
    {
        $sesiKemarin = $this->sesiPadaUmur($umur - 1);

        return HasilSampling::hitung(
            $berat,
            array_map('intval', $ekor),
            $denganSexing,
            $umur,
            $this->standar(),
            $this->abwKemarin($umur, $sesiKemarin),
            $sesiKemarin?->abwKelompok() ?? [],
        );
    }

    /**
     * @return array{zak_standar: ?float, zak: ?float, fcr_standar: ?float, fcr: ?float, pakan_sampai_umur: ?int}
     */
    private function hitungPakan(int $umur, ?float $abw): array
    {
        $baris = collect(LembarRecording::baris($this->terpilih));
        $hariIni = $baris->firstWhere('umur', $umur);
        $pakanTerakhir = $baris->filter(fn (array $hari): bool => $hari['umur'] <= $umur && isset($hari['pakan_gram_kumulatif']))->last();
        $pemberian = $this->terpilih->pemberianPakan->where('umur', $umur);

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
        return new Standar($this->periode->strain, (float) $this->periode->berat_doc_gram);
    }

    private function sesiPadaUmur(int $umur): ?SesiSampling
    {
        return $this->terpilih->sesiSampling->firstWhere('umur', $umur);
    }

    /**
     * ABW gabungan hari sebelumnya: dari sampling, lalu recording, lalu berat DOC untuk umur 1.
     */
    private function abwKemarin(int $umur, ?SesiSampling $sesiKemarin): ?float
    {
        $umurKemarin = $umur - 1;

        return $sesiKemarin?->abw()
            ?? $this->terpilih->recordings->firstWhere('umur', $umurKemarin)?->bobot_rata_gram
            ?? ($umurKemarin === 0 ? (float) $this->periode->berat_doc_gram : null);
    }

    private function tanggalSah(string $tanggal): bool
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || ! $this->periode) {
            return false;
        }

        $umur = $this->periode->umurPada(Carbon::parse($tanggal));

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

        return $this->terpilih?->sesiSampling->last()?->tanggal ?? $this->periode->tanggal_chick_in->copy()->addDay();
    }
}
