<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\Periode;
use App\Models\StandarStrain;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Standar strain')]
class MasterStandarStrain extends Component
{
    /**
     * Jumlah hari standar awal untuk strain baru, sama dengan lembar Recording Harian.
     */
    private const HARI_AWAL = 42;

    private const HARI_MAKS = 60;

    public bool $formTerbuka = false;

    #[Locked]
    public ?int $strainId = null;

    public string $nama = '';

    /**
     * Standar per umur (hari), kunci umur mulai dari 1.
     *
     * @var array<int, array{abw: string, pakan_gram: string, deplesi_persen: string}>
     */
    public array $hari = [];

    public ?string $pesan = null;

    #[Locked]
    public ?int $strainHapusId = null;

    public string $namaHapus = '';

    /**
     * @return Collection<int, StandarStrain>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return StandarStrain::query()
            ->withCount('harian')
            ->with(['harian' => fn ($query) => $query->where('umur', '>=', 1)])
            ->orderBy('nama')
            ->get();
    }

    /**
     * Jumlah periode per nama strain.
     *
     * @return array<string, int>
     */
    #[Computed]
    public function pemakaian(): array
    {
        return Periode::query()
            ->selectRaw('strain, count(*) as jumlah')
            ->groupBy('strain')
            ->pluck('jumlah', 'strain')
            ->all();
    }

    public function tambah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->strainId = null;
        $this->nama = '';

        // Strain baru dimulai dari salinan standar yang ada supaya tinggal disesuaikan.
        $acuan = StandarStrain::query()->orderBy('id')->first();
        $this->hari = $acuan ? $this->barisDari($acuan) : $this->barisKosong(self::HARI_AWAL);
        $this->formTerbuka = true;
    }

    public function ubah(int $id): void
    {
        $strain = StandarStrain::query()->findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->strainId = $strain->id;
        $this->nama = $strain->nama;
        $this->hari = $this->barisDari($strain);
        $this->formTerbuka = true;
    }

    public function tambahHari(): void
    {
        if (count($this->hari) >= self::HARI_MAKS) {
            return;
        }

        $this->hari[count($this->hari) + 1] = ['abw' => '', 'pakan_gram' => '', 'deplesi_persen' => ''];
    }

    public function kurangiHari(): void
    {
        if (count($this->hari) > 1) {
            unset($this->hari[count($this->hari)]);
        }
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->strainId = null;
        $this->nama = '';
        $this->hari = [];
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $this->nama = trim($this->nama);

        $data = $this->validate([
            'nama' => ['required', 'string', 'max:100', Rule::unique('standar_strains', 'nama')->ignore($this->strainId)],
            'hari' => ['required', 'array', 'min:1', 'max:'.self::HARI_MAKS],
            'hari.*.abw' => ['required', 'numeric', 'gt:0', 'max:99999'],
            'hari.*.pakan_gram' => ['required', 'numeric', 'gte:0', 'max:9999'],
            'hari.*.deplesi_persen' => ['required', 'numeric', 'between:0,100'],
        ], [
            'nama.required' => 'Nama strain wajib diisi.',
            'nama.max' => 'Nama strain maksimal 100 karakter.',
            'nama.unique' => 'Nama strain sudah digunakan.',
            'hari.required' => 'Standar minimal berisi satu hari.',
            'hari.*.abw.required' => 'Bobot badan wajib diisi pada setiap hari.',
            'hari.*.abw.numeric' => 'Bobot badan harus berupa angka.',
            'hari.*.abw.gt' => 'Bobot badan harus lebih dari 0 gram.',
            'hari.*.pakan_gram.required' => 'Konsumsi pakan wajib diisi pada setiap hari.',
            'hari.*.pakan_gram.numeric' => 'Konsumsi pakan harus berupa angka.',
            'hari.*.pakan_gram.gte' => 'Konsumsi pakan tidak boleh negatif.',
            'hari.*.deplesi_persen.required' => 'Deplesi wajib diisi pada setiap hari.',
            'hari.*.deplesi_persen.numeric' => 'Deplesi harus berupa angka.',
            'hari.*.deplesi_persen.between' => 'Deplesi harus antara 0 dan 100 persen.',
        ]);

        $mengubah = $this->strainId !== null;
        $strain = $mengubah ? StandarStrain::query()->findOrFail($this->strainId) : new StandarStrain;
        $namaLama = $strain->nama;
        $baris = $this->barisUntukDisimpan($data['hari']);
        $berubah = ! $mengubah || $namaLama !== $data['nama'] || $this->barisDari($strain) !== $this->barisDari($strain, $baris);

        DB::transaction(function () use ($strain, $data, $baris, $mengubah, $namaLama, $berubah): void {
            if (! $berubah) {
                return;
            }

            $strain->nama = $data['nama'];
            $strain->save();

            // Periode menyimpan nama strain, jadi ikut diganti bila strainnya diganti nama.
            if ($mengubah && $namaLama !== $strain->nama) {
                Periode::query()->where('strain', $namaLama)->update(['strain' => $strain->nama]);
            }

            $strain->harian()->delete();
            $strain->harian()->createMany($baris);

            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::StandarStrain,
                'Standar strain '.$strain->nama,
                count($baris).' hari',
            );
        });

        $this->pesan = 'Standar strain '.$data['nama'].($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-standar-strain');
        $this->batal();
        unset($this->daftar, $this->pemakaian);
    }

    public function mintaHapus(int $id): void
    {
        $strain = StandarStrain::query()->findOrFail($id);

        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->strainHapusId = $strain->id;
        $this->namaHapus = $strain->nama;
    }

    public function hapus(): void
    {
        $strain = StandarStrain::query()->findOrFail($this->strainHapusId ?? abort(404));

        if ($strain->jumlahPeriode() > 0) {
            throw ValidationException::withMessages([
                'hapus' => 'Strain ini dipakai oleh periode, sehingga tidak dapat dihapus.',
            ]);
        }

        $nama = $strain->nama;
        $jumlahHari = $strain->harian()->count();

        DB::transaction(function () use ($strain, $nama, $jumlahHari): void {
            $strain->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::StandarStrain, 'Standar strain '.$nama, $jumlahHari.' hari');
        });

        $this->strainHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Standar strain '.$nama.' dihapus.';
        $this->resetErrorBag('hapus');
        unset($this->daftar, $this->pemakaian);
    }

    public function render(): View
    {
        return view('livewire.master-standar-strain');
    }

    /**
     * @return array<int, array{abw: string, pakan_gram: string, deplesi_persen: string}>
     */
    private function barisKosong(int $jumlah): array
    {
        return array_fill(1, $jumlah, ['abw' => '', 'pakan_gram' => '', 'deplesi_persen' => '']);
    }

    /**
     * Baris form dari standar tersimpan. Umur 0 tidak ada; berat DOC dibaca dari periode.
     *
     * @param  ?list<array{umur: int, abw: float, pakan_gram: float, deplesi_persen: float}>  $baris
     * @return array<int, array{abw: string, pakan_gram: string, deplesi_persen: string}>
     */
    private function barisDari(StandarStrain $strain, ?array $baris = null): array
    {
        $sumber = $baris ?? $strain->harian()->where('umur', '>=', 1)->get()->map->only(['umur', 'abw', 'pakan_gram', 'deplesi_persen'])->all();

        return collect($sumber)
            ->mapWithKeys(fn (array $satu): array => [(int) $satu['umur'] => [
                'abw' => (string) (float) $satu['abw'],
                'pakan_gram' => (string) (float) $satu['pakan_gram'],
                'deplesi_persen' => (string) (float) $satu['deplesi_persen'],
            ]])
            ->all();
    }

    /**
     * @param  array<int, array{abw: string, pakan_gram: string, deplesi_persen: string}>  $hari
     * @return list<array{umur: int, abw: float, pakan_gram: float, deplesi_persen: float}>
     */
    private function barisUntukDisimpan(array $hari): array
    {
        return collect($hari)
            ->map(fn (array $satu, int|string $umur): array => [
                'umur' => (int) $umur,
                'abw' => (float) $satu['abw'],
                'pakan_gram' => (float) $satu['pakan_gram'],
                'deplesi_persen' => (float) $satu['deplesi_persen'],
            ])
            ->sortBy('umur')
            ->values()
            ->all();
    }
}
