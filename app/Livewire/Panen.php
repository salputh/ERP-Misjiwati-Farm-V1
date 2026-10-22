<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\NotaPanen as ModelNotaPanen;
use App\Support\RekapPanen;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Panen')]
class Panen extends Component
{
    use MemilihPeriode;

    #[Locked]
    public ?int $notaId = null;

    #[Locked]
    public ?int $notaHapusId = null;

    #[Locked]
    public ?string $noBtpaDihapus = null;

    public string $tanggalPanen = '';

    public string $noSpa = '';

    public string $noBtpa = '';

    public string $noPolisi = '';

    public string $pembeli = '';

    public string $mulai = '';

    public string $selesai = '';

    public string $jumlahKrat = '';

    public string $ekor = '';

    public string $beratKg = '';

    public string $nettoNotaKg = '';

    public string $tukangTangkap = '';

    /**
     * @var array<string, array{kratMulai: string, beratTimbang: string}>
     */
    public array $detailPemanen = [];

    public ?string $pesan = null;

    public function mount(): void
    {
        $this->bersihkanForm();
    }

    public function updatedPeriodeId(): void
    {
        $this->bersihkanForm();
        $this->notaHapusId = null;
        $this->noBtpaDihapus = null;
        unset($this->rekap);
    }

    public function tambah(): void
    {
        $this->bersihkanForm();
    }

    public function updatedTukangTangkap(): void
    {
        unset($this->rincianPemanen);
    }

    /**
     * @return list<array{nama: string, kunci: string, kratMulai: string, beratTimbang: string}>
     */
    #[Computed]
    public function rincianPemanen(): array
    {
        return $this->namaPemanen()
            ->map(fn (string $nama): array => [
                'nama' => $nama,
                'kunci' => $this->kunciPemanen($nama),
                'kratMulai' => $this->detailPemanen[$this->kunciPemanen($nama)]['kratMulai'] ?? '',
                'beratTimbang' => $this->detailPemanen[$this->kunciPemanen($nama)]['beratTimbang'] ?? '',
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function rekap(): ?array
    {
        return $this->periode
            ? RekapPanen::buat($this->periode->loadMissing(['notaPanen', 'kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan']))
            : null;
    }

    public function ubah(int $id): void
    {
        $nota = $this->notaUntukPeriode($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->notaId = $nota->id;
        $this->tanggalPanen = $nota->tanggal_panen->toDateString();
        $this->noSpa = $nota->no_spa ?? '';
        $this->noBtpa = $nota->no_btpa;
        $this->noPolisi = $nota->no_polisi;
        $this->pembeli = $nota->pembeli;
        $pemanenKrat = $nota->pemanenKrat()->orderBy('krat_mulai')->get();
        $this->tukangTangkap = $nota->tukang_tangkap ?? '';
        $this->detailPemanen = $pemanenKrat
            ->mapWithKeys(fn ($pemanen): array => [
                $this->kunciPemanen($pemanen->nama) => [
                    'kratMulai' => $pemanen->krat_mulai === 1 ? '' : (string) $pemanen->krat_mulai,
                    'beratTimbang' => $pemanen->berat_timbang_kg === null
                        ? ''
                        : number_format($pemanen->berat_timbang_kg, 2, '.', ''),
                ],
            ])
            ->all();
        $this->mulai = $nota->mulai->format('Y-m-d\TH:i');
        $this->selesai = $nota->selesai->format('Y-m-d\TH:i');
        $this->jumlahKrat = (string) $nota->jumlah_krat;
        $this->ekor = (string) $nota->ekor;
        $this->beratKg = (string) $nota->berat_kg;
        $this->nettoNotaKg = (string) $nota->netto_nota_kg;
    }

    public function batalUbah(): void
    {
        $this->bersihkanForm();
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode ?? abort(404);
        $data = $this->validate([
            'tanggalPanen' => ['required', 'date_format:Y-m-d'],
            'noSpa' => ['nullable', 'string', 'max:255'],
            'noBtpa' => [
                'required',
                'string',
                'max:255',
                Rule::unique('nota_panens', 'no_btpa')
                    ->where('periode_id', $periode->id)
                    ->ignore($this->notaId),
            ],
            'noPolisi' => ['required', 'string', 'max:255'],
            'pembeli' => ['required', 'string', 'max:255'],
            'tukangTangkap' => ['nullable', 'string', 'max:2000'],
            'detailPemanen' => ['array', 'max:50'],
            'detailPemanen.*.kratMulai' => ['nullable', 'integer', 'min:1', 'max:4294967295', 'lte:jumlahKrat'],
            'detailPemanen.*.beratTimbang' => ['nullable', 'numeric', 'gt:0', 'max:99999999.99'],
            'mulai' => ['required', 'date_format:Y-m-d\TH:i'],
            'selesai' => ['required', 'date_format:Y-m-d\TH:i', 'after_or_equal:mulai'],
            'jumlahKrat' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'ekor' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'beratKg' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'nettoNotaKg' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ], [
            'tanggalPanen.required' => 'Tanggal panen wajib diisi.',
            'tanggalPanen.date_format' => 'Tanggal panen tidak valid.',
            'noBtpa.required' => 'Nomor BTPA wajib diisi.',
            'noBtpa.unique' => 'Nomor BTPA sudah digunakan di periode ini.',
            'noPolisi.required' => 'Nomor polisi wajib diisi.',
            'pembeli.required' => 'Nama pembeli wajib diisi.',
            'detailPemanen.*.kratMulai.integer' => 'Krat mulai harus berupa bilangan bulat.',
            'detailPemanen.*.kratMulai.min' => 'Krat mulai minimal 1.',
            'detailPemanen.*.kratMulai.lte' => 'Krat mulai tidak boleh melebihi jumlah krat nota.',
            'detailPemanen.*.beratTimbang.numeric' => 'Berat timbangan pemanen harus berupa angka.',
            'detailPemanen.*.beratTimbang.gt' => 'Berat timbangan pemanen harus lebih dari 0.',
            'detailPemanen.*.beratTimbang.max' => 'Berat timbangan pemanen terlalu besar.',
            'mulai.required' => 'Waktu mulai timbang wajib diisi.',
            'mulai.date_format' => 'Waktu mulai timbang tidak valid.',
            'selesai.required' => 'Waktu selesai timbang wajib diisi.',
            'selesai.date_format' => 'Waktu selesai timbang tidak valid.',
            'selesai.after_or_equal' => 'Waktu selesai harus sama atau setelah waktu mulai.',
            'jumlahKrat.required' => 'Jumlah krat wajib diisi.',
            'jumlahKrat.integer' => 'Jumlah krat harus berupa bilangan bulat.',
            'jumlahKrat.min' => 'Jumlah krat minimal 1.',
            'ekor.required' => 'Jumlah ekor wajib diisi.',
            'ekor.integer' => 'Jumlah ekor harus berupa bilangan bulat.',
            'ekor.min' => 'Jumlah ekor minimal 1.',
            'beratKg.required' => 'Berat panen wajib diisi.',
            'beratKg.numeric' => 'Berat panen harus berupa angka.',
            'beratKg.gt' => 'Berat panen harus lebih dari 0.',
            'nettoNotaKg.required' => 'Netto nota wajib diisi.',
            'nettoNotaKg.numeric' => 'Netto nota harus berupa angka.',
            'nettoNotaKg.min' => 'Netto nota tidak boleh kurang dari 0.',
        ]);

        $namaPemanen = $this->namaPemanen();
        $inputPemanen = $namaPemanen
            ->map(function (string $nama) use ($data): array {
                $detail = $data['detailPemanen'][$this->kunciPemanen($nama)] ?? [];

                return [
                    'nama' => $nama,
                    'krat_mulai' => (int) (($detail['kratMulai'] ?? '') ?: 1),
                    'berat_timbang_kg' => ($detail['beratTimbang'] ?? '') === '' ? null : $detail['beratTimbang'],
                ];
            })
            ->all();

        $adaDetailKhusus = collect($inputPemanen)->contains(
            fn (array $pemanen): bool => $pemanen['krat_mulai'] > 1 || $pemanen['berat_timbang_kg'] !== null,
        );
        $daftarPemanenKrat = $adaDetailKhusus ? $inputPemanen : [];

        $totalBeratTimbangSen = collect($daftarPemanenKrat)
            ->sum(fn (array $pemanen): int => $pemanen['berat_timbang_kg'] === null
                ? 0
                : (int) round((float) $pemanen['berat_timbang_kg'] * 100));
        if ($totalBeratTimbangSen > (int) round((float) $data['beratKg'] * 100)) {
            throw ValidationException::withMessages([
                'detailPemanen' => 'Jumlah berat timbangan pemanen tidak boleh melebihi berat panen pada nota.',
            ]);
        }

        $daftarPemanenKrat = collect($daftarPemanenKrat)->sortBy('krat_mulai')->values();
        $mulai = Carbon::createFromFormat('Y-m-d\TH:i', $data['mulai']);
        $selesai = Carbon::createFromFormat('Y-m-d\TH:i', $data['selesai']);
        $baru = $this->notaId === null;
        $noBtpa = $data['noBtpa'];

        DB::transaction(function () use ($data, $daftarPemanenKrat, $periode, $mulai, $selesai, $baru, $noBtpa): void {
            $nota = $this->notaId
                ? $periode->notaPanen()->whereKey($this->notaId)->lockForUpdate()->firstOrFail()
                : $periode->notaPanen()->make();

            $nota->fill([
                'tanggal_panen' => $data['tanggalPanen'],
                'no_spa' => $data['noSpa'] ?: null,
                'no_btpa' => $noBtpa,
                'no_polisi' => $data['noPolisi'],
                'pembeli' => $data['pembeli'],
                'tukang_tangkap' => trim($data['tukangTangkap']) ?: null,
                'mulai' => $mulai,
                'selesai' => $selesai,
                'jumlah_krat' => (int) $data['jumlahKrat'],
                'ekor' => (int) $data['ekor'],
                'berat_kg' => $data['beratKg'],
                'netto_nota_kg' => $data['nettoNotaKg'],
            ])->save();

            $nota->pemanenKrat()->delete();
            $nota->pemanenKrat()->createMany($daftarPemanenKrat->all());

            Aktivitas::catat(
                $baru ? JenisAktivitas::Tambah : JenisAktivitas::Ubah,
                ModulAktivitas::Panen,
                'Nota panen '.$noBtpa,
                $periode->nama,
            );
        });

        $this->bersihkanForm();
        $this->pesan = 'Nota panen '.$noBtpa.($baru ? ' ditambahkan.' : ' diperbarui.');
        $this->dispatch('tutup-modal-panen');
        unset($this->periode, $this->rekap);
        $this->dispatch('nota-panen-disimpan');
    }

    public function mintaHapus(int $id): void
    {
        $nota = $this->notaUntukPeriode($id);
        $this->resetErrorBag('nota_hapus');
        $this->pesan = null;
        $this->notaHapusId = $nota->id;
        $this->noBtpaDihapus = $nota->no_btpa;
    }

    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $id = $this->notaHapusId ?? abort(404);
        $periode = $this->periode ?? abort(404);
        $noBtpa = DB::transaction(function () use ($id, $periode): string {
            $nota = $periode->notaPanen()->whereKey($id)->lockForUpdate()->firstOrFail();
            $noBtpa = $nota->no_btpa;

            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::Panen,
                'Nota panen '.$noBtpa,
                $periode->nama,
            );
            $nota->delete();

            return $noBtpa;
        });

        if ($this->notaId === $id) {
            $this->bersihkanForm();
        }

        $this->notaHapusId = null;
        $this->noBtpaDihapus = null;
        $this->pesan = 'Nota panen '.$noBtpa.' dihapus.';
        unset($this->periode, $this->rekap);
    }

    public function render(): View
    {
        return view('livewire.panen');
    }

    private function notaUntukPeriode(int $id): ModelNotaPanen
    {
        return ($this->periode ?? abort(404))
            ->notaPanen()
            ->whereKey($id)
            ->firstOrFail();
    }

    private function bersihkanForm(): void
    {
        $now = now();
        $this->resetValidation();
        $this->notaId = null;
        $this->tanggalPanen = $now->toDateString();
        $this->noSpa = '';
        $this->noBtpa = '';
        $this->noPolisi = '';
        $this->pembeli = '';
        $this->tukangTangkap = '';
        $this->detailPemanen = [];
        $this->mulai = $now->format('Y-m-d\TH:i');
        $this->selesai = $now->copy()->addMinutes(30)->format('Y-m-d\TH:i');
        $this->jumlahKrat = '';
        $this->ekor = '';
        $this->beratKg = '';
        $this->nettoNotaKg = '';
        $this->pesan = null;
        unset($this->rincianPemanen);
    }

    /**
     * @return Collection<int, string>
     */
    private function namaPemanen(): Collection
    {
        return collect(preg_split('/[,;\r\n]+/u', $this->tukangTangkap, -1, PREG_SPLIT_NO_EMPTY))
            ->map(fn (string $nama): string => trim($nama))
            ->filter()
            ->unique(fn (string $nama): string => mb_strtolower($nama))
            ->values();
    }

    private function kunciPemanen(string $nama): string
    {
        return hash('sha256', mb_strtolower(trim($nama)));
    }
}
