<?php

namespace App\Livewire;

use App\Models\JenisPakan;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Jenis pakan')]
class MasterJenisPakan extends Component
{
    public bool $formTerbuka = false;

    #[Locked]
    public ?int $jenisPakanId = null;

    public string $kode = '';

    public string $hargaPerKg = '';

    public string $kgPerZak = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $jenisPakanHapusId = null;

    public string $kodeHapus = '';

    /**
     * @return Collection<int, JenisPakan>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return JenisPakan::query()
            ->orderBy('kode')
            ->get();
    }

    public function tambah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->jenisPakanId = null;
        $this->kode = '';
        $this->hargaPerKg = '';
        $this->kgPerZak = (string) config('standar.kg_per_zak');
        $this->formTerbuka = true;
    }

    public function ubah(int $id): void
    {
        $jenisPakan = JenisPakan::findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->jenisPakanId = $jenisPakan->id;
        $this->kode = $jenisPakan->kode;
        $this->hargaPerKg = $jenisPakan->harga_per_kg === null ? '' : (string) $jenisPakan->harga_per_kg;
        $this->kgPerZak = (string) $jenisPakan->kg_per_zak;
        $this->formTerbuka = true;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->jenisPakanId = null;
        $this->kode = '';
        $this->hargaPerKg = '';
        $this->kgPerZak = '';
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $this->kode = strtoupper(trim($this->kode));

        $data = $this->validate([
            'kode' => [
                'required',
                'string',
                'max:50',
                Rule::unique('jenis_pakans', 'kode')->ignore($this->jenisPakanId),
            ],
            'hargaPerKg' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
            'kgPerZak' => ['required', 'numeric', 'decimal:0,2', 'gt:0', 'max:999999.99'],
        ], [
            'kode.required' => 'Kode jenis pakan wajib diisi.',
            'kode.max' => 'Kode jenis pakan maksimal 50 karakter.',
            'kode.unique' => 'Kode jenis pakan sudah digunakan.',
            'hargaPerKg.required' => 'Harga per kg wajib diisi.',
            'hargaPerKg.integer' => 'Harga per kg harus berupa rupiah bulat.',
            'hargaPerKg.min' => 'Harga per kg minimal Rp 1.',
            'kgPerZak.required' => 'Berat per zak wajib diisi.',
            'kgPerZak.numeric' => 'Berat per zak harus berupa angka.',
            'kgPerZak.decimal' => 'Berat per zak maksimal dua angka di belakang koma.',
            'kgPerZak.gt' => 'Berat per zak harus lebih dari 0 kg.',
        ]);

        $jenisPakan = $this->jenisPakanId
            ? JenisPakan::findOrFail($this->jenisPakanId)
            : new JenisPakan;
        $jenisPakan->kode = $data['kode'];
        $jenisPakan->harga_per_kg = $data['hargaPerKg'];
        $jenisPakan->kg_per_zak = $data['kgPerZak'];
        $jenisPakan->save();

        $this->pesan = 'Jenis pakan '.$jenisPakan->kode.($this->jenisPakanId ? ' diperbarui.' : ' ditambahkan.');
        $this->batal();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        $jenisPakan = JenisPakan::findOrFail($id);

        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->jenisPakanHapusId = $jenisPakan->id;
        $this->kodeHapus = $jenisPakan->kode;
    }

    public function hapus(): void
    {
        $id = $this->jenisPakanHapusId ?? abort(404);
        $jenisPakan = JenisPakan::query()->findOrFail($id);

        if ($jenisPakan->penerimaanPakan()->exists() || $jenisPakan->pemberianPakan()->exists()) {
            throw ValidationException::withMessages([
                'hapus' => 'Jenis pakan ini sudah digunakan pada data penerimaan atau pemberian, sehingga tidak dapat dihapus.',
            ]);
        }

        $kode = $jenisPakan->kode;
        $jenisPakan->delete();

        $this->jenisPakanHapusId = null;
        $this->kodeHapus = '';
        $this->pesan = 'Jenis pakan '.$kode.' dihapus.';
        $this->resetErrorBag('hapus');
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.master-jenis-pakan');
    }
}
