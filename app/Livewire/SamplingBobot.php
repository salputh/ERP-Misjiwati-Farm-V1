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
use App\Support\SusunanSampling;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Sampling bobot per kandang (M4). Kandang dipilih di halaman; riwayat sesinya punya aksi Lihat, Ubah, dan Hapus.
 * Form di modal hanya untuk satu tujuan: "Tambah sampling" membuat sesi baru pada tanggal yang belum punya sesi,
 * "Ubah" mengganti sampel sesi tersimpan dengan kandang dan tanggal yang terkunci. ABW sesi menjadi ABW aktual
 * recording harian tanggal itu (dibaca LembarRecording), tanpa menulis baris recording.
 */
#[Title('Sampling bobot')]
class SamplingBobot extends Component
{
    use MemilihPeriode;

    /** Catatan baris recording yang dulu dibuat otomatis oleh sampling, sebelum ABW dibaca langsung dari sesi. */
    private const CATATAN_RECORDING_OTOMATIS = 'ABW dari sampling bobot; kematian dan afkir belum dicatat.';

    #[Url(as: 'kandang')]
    public ?int $periodeKandangId = null;

    /** Tanggal sesi di form (Y-m-d). Hanya dapat dipilih saat menambah; saat mengubah, tanggal sesi dikunci. */
    public string $tanggal = '';

    public bool $denganSexing = false;

    /**
     * Ekor per sampel tiap kelamin: satu angka untuk semua titik kelamin itu dalam sesi (T10).
     *
     * @var array<string, int|string>
     */
    public array $ekor = [];

    /** Ekor per sampel dikunci: isiannya tidak dapat diubah sampai kuncinya dibuka. */
    public bool $ekorTerkunci = false;

    /**
     * Ekor per sampel saat dikunci, dipakai mengembalikan nilai bila ada perubahan yang terkirim selama terkunci.
     *
     * @var array<string, int|string>
     */
    #[Locked]
    public array $ekorSaatDikunci = [];

    /**
     * Jumlah ekor tiap titik: [lantai][kelamin][line][urutan]. Tidak diisi sendiri; selalu disamakan dengan
     * ekor per sampel kelaminnya supaya setiap titik ditimbang dengan jumlah ekor yang sama.
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

    /** Sesi yang sedang diubah di form; null berarti form menambah sesi baru. */
    #[Locked]
    public ?int $sesiId = null;

    /**
     * Sesi riwayat yang hasilnya sedang ditampilkan di modal.
     */
    public ?int $sesiDilihatId = null;

    #[Locked]
    public ?int $sesiHapusId = null;

    public string $labelHapus = '';

    public ?string $pesan = null;

    public function mount(): void
    {
        if (! $this->terpilih) {
            return;
        }

        if (! $this->daftarKandang->contains('id', $this->periodeKandangId)) {
            $this->periodeKandangId = $this->kandangAwal()?->id ?? $this->terpilih->id;
            unset($this->terpilih);
        }

        $this->kosongkanForm();
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
        return $this->umurPada($this->tanggal);
    }

    /**
     * Rentang tanggal sampling kandang terpilih: hari chick-in kandang itu sampai umur terakhir tabel standar.
     *
     * @return array{min: string, maks: string}
     */
    #[Computed]
    public function batasTanggal(): array
    {
        $chickIn = $this->terpilih?->tanggalChickInEfektif() ?? $this->periode->tanggal_chick_in;

        return [
            'min' => $chickIn->format('Y-m-d'),
            'maks' => $chickIn->copy()->addDays($this->umurMaksimal)->format('Y-m-d'),
        ];
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
            $umur = (int) $kandang->tanggalChickInEfektif()->diffInDays($tanggalSesi ?? today(), false);
            $pakan = $this->hitungPakan($kandang, $umur, $sesi?->abw());

            $berat = (float) ($sesi?->titik->sum('berat_gram') ?? 0);
            $ekor = (int) ($sesi?->titik->sum('ekor') ?? 0);
            $totalBerat += $berat;
            $totalEkor += $ekor;
            $totalTitik += (int) ($sesi?->titik->count() ?? 0);

            $baris[] = [
                'periode_kandang_id' => $kandang->id,
                'sesi_id' => $sesi?->id,
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
                'lantai' => array_map(fn (array $info): string => $info['label'], $this->susunanLantai()),
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

    /**
     * Pilih kandang yang riwayatnya ditampilkan dan yang akan ditambah sampling-nya.
     */
    public function pilihKandang(int $periodeKandangId): void
    {
        if (! $this->daftarKandang->contains('id', $periodeKandangId)) {
            return;
        }

        $this->periodeKandangId = $periodeKandangId;
        $this->pesan = null;
        $this->sesiDilihatId = null;
        unset($this->terpilih, $this->riwayat, $this->batasTanggal, $this->umur, $this->gabunganKandang);
        $this->kosongkanForm();
    }

    /**
     * Siapkan form untuk sampling baru kandang terpilih.
     */
    public function tambah(): void
    {
        $this->pesan = null;
        $this->kosongkanForm();
    }

    /**
     * Isi form dari sesi tersimpan kandang terpilih; kandang dan tanggalnya dikunci.
     */
    public function ubah(int $sesiId): void
    {
        $sesi = $this->riwayat->firstWhere('id', $sesiId) ?? abort(404);

        $this->resetValidation();
        $this->pesan = null;
        $this->sesiId = $sesi->id;
        $this->tanggal = $sesi->tanggal->format('Y-m-d');
        $this->denganSexing = $sesi->dengan_sexing;
        $this->ekor = array_merge(config('sampling.ekor_per_sampel'), $sesi->ekorPerSampel());
        $this->berat = $sesi->isianBerat();
        $this->ekorTitik = [];
        $this->samakanEkorTitik();
        // Sesi tersimpan dibuka dengan ekor per sampel terkunci, supaya angkanya tidak berubah tanpa sengaja.
        $this->ekorTerkunci = true;
        $this->ekorSaatDikunci = $this->ekor;
        unset($this->umur, $this->labelTanggal);
    }

    public function batal(): void
    {
        $this->kosongkanForm();
    }

    /**
     * Tanggal hanya dapat diganti saat menambah. Isian sampel tidak dibuang; jenis sampling menyesuaikan umur
     * selama belum ada berat yang diisi.
     */
    public function updatedTanggal(): void
    {
        $this->resetErrorBag('tanggal');
        if ($this->sesiId !== null) {
            $this->tanggal = $this->riwayat->firstWhere('id', $this->sesiId)?->tanggal->format('Y-m-d') ?? $this->tanggal;

            return;
        }

        unset($this->umur, $this->labelTanggal);
        $this->periksaTanggalBaru();

        if ($this->beratKosong()) {
            $this->denganSexing = $this->umur >= config('sampling.umur_mulai_sexing');
            $this->samakanEkorTitik();
        }
    }

    /**
     * Ekor per sampel berlaku untuk semua titik, jadi mengubahnya menulis ulang jumlah ekor setiap titik kelamin itu.
     * Selama terkunci, nilai yang terkirim dikembalikan ke nilai saat dikunci.
     */
    public function updatedEkor(): void
    {
        if ($this->ekorTerkunci) {
            $this->ekor = $this->ekorSaatDikunci;
        }

        $this->samakanEkorTitik();
    }

    /**
     * Kunci ekor per sampel setelah angkanya benar. Angka yang kosong atau tidak sah tidak dapat dikunci.
     */
    public function kunciEkor(): void
    {
        $this->resetErrorBag(array_keys($this->aturanEkor()));
        $this->validate($this->aturanEkor(), $this->pesanEkor());

        $this->ekorTerkunci = true;
        $this->ekorSaatDikunci = $this->ekor;
        $this->samakanEkorTitik();
    }

    public function bukaKunciEkor(): void
    {
        $this->ekorTerkunci = false;
        $this->ekorSaatDikunci = [];
    }

    /**
     * Mengganti jenis sampling mengganti kelamin yang diisi, jadi kunci ekor per sampel dibuka lagi.
     */
    public function pilihJenis(bool $denganSexing): void
    {
        $this->denganSexing = $denganSexing;
        $this->bukaKunciEkor();
        $this->samakanEkorTitik();
    }

    /**
     * Tampilkan hasil sesi riwayat di modal; isian form tidak berubah.
     */
    public function buka(int $sesiId): void
    {
        $this->sesiDilihatId = $this->riwayat->firstWhere('id', $sesiId)?->id;
    }

    /**
     * Dari ringkasan: pilih kandang itu dan tampilkan sesi terakhirnya di modal hasil.
     */
    public function lihatTerakhir(int $periodeKandangId): void
    {
        $this->pilihKandang($periodeKandangId);
        $this->sesiDilihatId = $this->riwayat->first()?->id;
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $sesiLama = $this->sesiId !== null ? ($this->riwayat->firstWhere('id', $this->sesiId) ?? abort(404)) : null;

        if (! $sesiLama && ! $this->periksaTanggalBaru()) {
            return;
        }

        $this->validate($this->aturan(), [
            ...$this->pesanEkor(),
            'berat.*.*.*.*.required' => 'Isi semua berat sampel.',
            'berat.*.*.*.*.integer' => 'Berat harus angka bulat (gram).',
            'berat.*.*.*.*.min' => 'Berat harus lebih dari 0.',
        ]);
        // Titik selalu memakai ekor per sampel, apa pun yang terkirim untuk titik itu.
        $this->samakanEkorTitik();

        $kelaminAktif = HasilSampling::kelamin($this->denganSexing);

        $sesi = DB::transaction(function () use ($kelaminAktif, $sesiLama): SesiSampling {
            $sesi = $sesiLama ?? new SesiSampling(['periode_kandang_id' => $this->terpilih->id, 'tanggal' => $this->tanggal]);
            $sesi->fill(['umur' => $this->umur, 'dengan_sexing' => $this->denganSexing])->save();

            $sesi->titik()->delete();
            foreach ($this->susunanLantai() as $lantai => $info) {
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
                $sesiLama ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::SamplingBobot,
                'Sampling bobot '.$this->labelTanggal,
                "{$this->terpilih->kandang->nama}, {$this->periode->nama}",
            );

            return $sesi;
        });

        $abw = $sesi->load('titik')->abw();
        $this->pesan = 'Sampling '.$this->terpilih->kandang->nama.' '.$this->labelTanggal.($sesiLama ? ' diperbarui.' : ' tersimpan.')
            .($abw !== null ? ' ABW '.Format::angka($abw, 1).' g menjadi ABW aktual recording harian tanggal itu.' : '');
        $this->dispatch('tutup-modal-sampling');
        $this->segarkan();
        $this->kosongkanForm();
    }

    public function mintaHapus(int $sesiId): void
    {
        $sesi = $this->riwayat->firstWhere('id', $sesiId) ?? abort(404);

        $this->pesan = null;
        $this->sesiHapusId = $sesi->id;
        $this->labelHapus = $this->terpilih->kandang->nama.' '.$sesi->tanggal->translatedFormat('j F Y').' (usia '.$sesi->umur.' hari)';
    }

    /**
     * Hapus satu sesi beserta sampelnya. Baris recording yang dulu dibuat otomatis oleh sampling pada tanggal itu,
     * dan belum diisi kematian atau afkir, ikut dihapus.
     */
    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $sesi = $this->riwayat->firstWhere('id', $this->sesiHapusId) ?? abort(404);
        $label = $this->labelHapus;

        DB::transaction(function () use ($sesi): void {
            Recording::query()
                ->where('periode_kandang_id', $sesi->periode_kandang_id)
                ->whereDate('tanggal', $sesi->tanggal)
                ->where('catatan', self::CATATAN_RECORDING_OTOMATIS)
                ->where('mati', 0)
                ->where('afkir', 0)
                ->delete();

            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::SamplingBobot,
                'Sampling bobot '.$sesi->tanggal->translatedFormat('j F Y'),
                "{$this->terpilih->kandang->nama}, {$this->periode->nama}",
            );
            $sesi->delete();
        });

        $this->sesiHapusId = null;
        $this->labelHapus = '';
        $this->sesiDilihatId = null;
        $this->pesan = 'Sampling '.$label.' dihapus.';
        $this->segarkan();
    }

    public function render(): View
    {
        return view('livewire.sampling-bobot');
    }

    /**
     * Form kosong untuk sampling baru kandang terpilih: tanggal disarankan, jenis sampling mengikuti umur.
     */
    private function kosongkanForm(): void
    {
        $this->resetValidation();
        $this->sesiId = null;
        $this->tanggal = $this->tanggalSaranBaru();
        unset($this->umur, $this->labelTanggal);
        $this->denganSexing = $this->umur >= config('sampling.umur_mulai_sexing');
        $this->ekor = config('sampling.ekor_per_sampel');
        $this->ekorTerkunci = false;
        $this->ekorSaatDikunci = [];
        $this->berat = [];
        $this->ekorTitik = [];
        $this->samakanEkorTitik();
    }

    /**
     * Tanggal sampling baru harus berada di rentang kandang dan belum punya sesi. Pesan kesalahannya
     * menunjuk ke riwayat, supaya sesi yang sudah ada diubah dari sana dan tidak tertimpa diam-diam.
     */
    /**
     * Lantai dan line kandang terpilih (kandang tertentu punya susunan line sendiri).
     *
     * @return array<string, array{label: string, line: list<string>}>
     */
    public function susunanLantai(): array
    {
        return SusunanSampling::untuk($this->terpilih?->kandang?->nama);
    }

    private function periksaTanggalBaru(): bool
    {
        if (! $this->tanggalSah($this->tanggal)) {
            $this->addError('tanggal', 'Pilih tanggal antara '.Carbon::parse($this->batasTanggal['min'])->translatedFormat('j F Y').' dan '.Carbon::parse($this->batasTanggal['maks'])->translatedFormat('j F Y').'.');

            return false;
        }

        if ($this->riwayat->contains(fn (SesiSampling $sesi): bool => $sesi->tanggal->format('Y-m-d') === $this->tanggal)) {
            $this->addError('tanggal', $this->terpilih->kandang->nama.' sudah punya sampling '.$this->labelTanggal.'. Ubah sesi itu dari Riwayat sampling.');

            return false;
        }

        return true;
    }

    private function beratKosong(): bool
    {
        return collect($this->berat)->flatten()->filter(fn (mixed $nilai): bool => filled($nilai))->isEmpty();
    }

    private function segarkan(): void
    {
        unset($this->daftarKandang, $this->terpilih, $this->riwayat, $this->gabunganKandang, $this->dilihat);
    }

    /**
     * @return array<string, list<string>>
     */
    private function aturanEkor(): array
    {
        return collect(HasilSampling::kelamin($this->denganSexing))
            ->mapWithKeys(fn (string $kelamin): array => ["ekor.{$kelamin}" => ['required', 'integer', 'min:1', 'max:500']])
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function pesanEkor(): array
    {
        return [
            'ekor.*.required' => 'Isi ekor per sampel.',
            'ekor.*.integer' => 'Ekor per sampel harus angka bulat.',
            'ekor.*.min' => 'Ekor per sampel harus lebih dari 0.',
            'ekor.*.max' => 'Ekor per sampel paling banyak 500.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function aturan(): array
    {
        $aturan = $this->aturanEkor();
        foreach (HasilSampling::kelamin($this->denganSexing) as $kelamin) {
            foreach ($this->susunanLantai() as $lantai => $info) {
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
            $this->susunanLantai(),
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
     * Samakan jumlah ekor setiap titik dengan ekor per sampel kelaminnya. Ekor per sampel yang kosong atau tidak
     * sah membuat titik ikut kosong, sehingga ABW tidak dihitung dari angka lama.
     */
    private function samakanEkorTitik(): void
    {
        foreach (HasilSampling::kelamin($this->denganSexing) as $kelamin) {
            $nilai = $this->ekor[$kelamin] ?? null;
            $ekor = is_numeric($nilai) && (int) $nilai > 0 ? (int) $nilai : null;
            foreach ($this->susunanLantai() as $lantai => $info) {
                foreach ($info['line'] as $line) {
                    for ($urutan = 1; $urutan <= config('sampling.sampel_per_line'); $urutan++) {
                        $this->ekorTitik[$lantai][$kelamin][$line][$urutan] = $ekor;
                    }
                }
            }
        }
    }

    private function umurPada(string $tanggal): int
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal)) {
            return 0;
        }

        return $this->terpilih
            ? (int) $this->terpilih->tanggalChickInEfektif()->diffInDays(Carbon::parse($tanggal), false)
            : $this->periode->umurPada(Carbon::parse($tanggal));
    }

    private function tanggalSah(string $tanggal): bool
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) || ! $this->periode) {
            return false;
        }

        $umur = $this->umurPada($tanggal);

        return $umur >= 0 && $umur <= $this->standar()->umurMaksimal();
    }

    /**
     * Saran tanggal sampling baru: hari ini bila masih di rentang kandang dan belum ada sesi, selain itu sehari
     * setelah sesi terakhir (dibatasi umur maksimal), atau sehari setelah chick-in.
     */
    private function tanggalSaranBaru(): string
    {
        if (! $this->periode) {
            return '';
        }

        $sudahAda = fn (string $tanggal): bool => $this->riwayat->contains(fn (SesiSampling $sesi): bool => $sesi->tanggal->format('Y-m-d') === $tanggal);
        $hariIni = today()->format('Y-m-d');
        if ($this->tanggalSah($hariIni) && ! $sudahAda($hariIni)) {
            return $hariIni;
        }

        $chickIn = $this->terpilih?->tanggalChickInEfektif() ?? $this->periode->tanggal_chick_in;
        $terakhir = $this->riwayat->first()?->tanggal;
        $saran = ($terakhir ?? $chickIn)->copy()->addDay()->format('Y-m-d');

        return $this->tanggalSah($saran) ? $saran : $chickIn->copy()->addDay()->format('Y-m-d');
    }
}
