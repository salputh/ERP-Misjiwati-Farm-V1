<?php

namespace App\Livewire;

use App\Models\Pemanen;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Pemanen')]
class MasterPemanen extends Component
{
    public bool $formTerbuka = false;

    #[Locked]
    public ?int $pemanenId = null;

    public string $nama = '';

    public string $upahPerKg = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $pemanenHapusId = null;

    public string $namaHapus = '';

    /**
     * @return Collection<int, Pemanen>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return Pemanen::query()
            ->orderBy('id')
            ->get();
    }

    public function tambah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->pemanenId = null;
        $this->nama = '';
        $this->upahPerKg = '20';
        $this->formTerbuka = true;
    }

    public function ubah(int $id): void
    {
        $pemanen = Pemanen::query()->findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->pemanenId = $pemanen->id;
        $this->nama = $pemanen->nama;
        $this->upahPerKg = (string) $pemanen->upah_per_kg;
        $this->formTerbuka = true;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->pemanenId = null;
        $this->nama = '';
        $this->upahPerKg = '';
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $this->nama = trim($this->nama);
        $data = $this->validate([
            'nama' => [
                'required',
                'string',
                'max:150',
                Rule::unique('pemanens', 'nama')->ignore($this->pemanenId),
            ],
            'upahPerKg' => ['required', 'integer', 'min:0', 'max:2147483647'],
        ], [
            'nama.required' => 'Nama pemanen wajib diisi.',
            'nama.max' => 'Nama pemanen maksimal 150 karakter.',
            'nama.unique' => 'Nama pemanen sudah terdaftar.',
            'upahPerKg.required' => 'Upah per kg wajib diisi.',
            'upahPerKg.integer' => 'Upah per kg harus berupa rupiah bulat.',
            'upahPerKg.min' => 'Upah per kg tidak boleh kurang dari Rp 0.',
            'upahPerKg.max' => 'Upah per kg terlalu besar.',
        ]);

        $sedangMengubah = $this->pemanenId !== null;
        $pemanen = $this->pemanenId
            ? Pemanen::query()->findOrFail($this->pemanenId)
            : new Pemanen;
        $pemanen->fill([
            'nama' => $data['nama'],
            'upah_per_kg' => $data['upahPerKg'],
        ])->save();

        $this->pesan = 'Pemanen '.$pemanen->nama.($sedangMengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-pemanen');
        $this->batal();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        $pemanen = Pemanen::query()->findOrFail($id);

        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->pemanenHapusId = $pemanen->id;
        $this->namaHapus = $pemanen->nama;
    }

    public function hapus(): void
    {
        $id = $this->pemanenHapusId ?? abort(404);
        $pemanen = Pemanen::query()->findOrFail($id);
        $nama = $pemanen->nama;
        $pemanen->delete();

        $this->pemanenHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Pemanen '.$nama.' dihapus.';
        $this->resetErrorBag('hapus');
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.master-pemanen');
    }
}
