<?php

namespace App\Livewire;

use App\Models\HargaDoc;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Harga DOC')]
class MasterHargaDoc extends Component
{
    public bool $formTerbuka = false;

    public string $hargaPerEkor = '';

    public string $jumlahEkor = '';

    public ?string $pesan = null;

    #[Computed]
    public function hargaDoc(): HargaDoc
    {
        return HargaDoc::query()->findOrFail(HargaDoc::GLOBAL_ID);
    }

    public function ubah(): void
    {
        $hargaDoc = $this->hargaDoc;

        $this->resetValidation();
        $this->pesan = null;
        $this->hargaPerEkor = (string) $hargaDoc->harga_per_ekor;
        $this->jumlahEkor = (string) $hargaDoc->jumlah_ekor;
        $this->formTerbuka = true;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->hargaPerEkor = '';
        $this->jumlahEkor = '';
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $data = $this->validate([
            'hargaPerEkor' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'jumlahEkor' => ['required', 'integer', 'min:1', 'max:2147483647'],
        ], [
            'hargaPerEkor.required' => 'Harga DOC per ekor wajib diisi.',
            'hargaPerEkor.integer' => 'Harga DOC per ekor harus berupa rupiah bulat.',
            'hargaPerEkor.min' => 'Harga DOC per ekor minimal Rp 1.',
            'hargaPerEkor.max' => 'Harga DOC per ekor terlalu besar.',
            'jumlahEkor.required' => 'Jumlah DOC wajib diisi.',
            'jumlahEkor.integer' => 'Jumlah DOC harus berupa bilangan bulat.',
            'jumlahEkor.min' => 'Jumlah DOC minimal 1 ekor.',
            'jumlahEkor.max' => 'Jumlah DOC terlalu besar.',
        ]);

        HargaDoc::query()
            ->findOrFail(HargaDoc::GLOBAL_ID)
            ->update([
                'harga_per_ekor' => $data['hargaPerEkor'],
                'jumlah_ekor' => $data['jumlahEkor'],
            ]);

        $this->pesan = 'Master harga DOC diperbarui.';
        $this->dispatch('tutup-modal-harga-doc');
        $this->batal();
        unset($this->hargaDoc);
    }

    public function render(): View
    {
        return view('livewire.master-harga-doc');
    }
}
