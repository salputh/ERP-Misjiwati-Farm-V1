<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\HargaKontrak;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Harga kontrak')]
class MasterHargaKontrak extends Component
{
    use MemilihPeriode;

    public bool $formTerbuka = false;

    #[Locked]
    public ?int $hargaKontrakId = null;

    public string $bobotMinKg = '';

    public string $bobotMaxKg = '';

    public string $hargaPerKg = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $hargaKontrakHapusId = null;

    public string $rentangHapus = '';

    /**
     * @return Collection<int, HargaKontrak>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return $this->periode?->hargaKontrak ?? new Collection;
    }

    public function tambah(): void
    {
        abort_unless($this->periode, 404);

        $this->resetValidation();
        $this->pesan = null;
        $this->hargaKontrakId = null;
        $this->bobotMinKg = '';
        $this->bobotMaxKg = '';
        $this->hargaPerKg = '';
        $this->formTerbuka = true;
    }

    public function ubah(int $id): void
    {
        $hargaKontrak = $this->hargaKontrakUntukPeriode($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->hargaKontrakId = $hargaKontrak->id;
        $this->bobotMinKg = number_format($hargaKontrak->bobot_min_kg, 2, '.', '');
        $this->bobotMaxKg = number_format($hargaKontrak->bobot_max_kg, 2, '.', '');
        $this->hargaPerKg = (string) $hargaKontrak->harga_per_kg;
        $this->formTerbuka = true;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->hargaKontrakId = null;
        $this->bobotMinKg = '';
        $this->bobotMaxKg = '';
        $this->hargaPerKg = '';
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $periode = $this->periode ?? abort(404);
        $data = $this->validate([
            'bobotMinKg' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9.99'],
            'bobotMaxKg' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9.99', 'gte:bobotMinKg'],
            'hargaPerKg' => ['required', 'integer', 'min:1', 'max:'.PHP_INT_MAX],
        ], [
            'bobotMinKg.required' => 'BW minimum wajib diisi.',
            'bobotMinKg.numeric' => 'BW minimum harus berupa angka.',
            'bobotMinKg.decimal' => 'BW minimum maksimal dua angka di belakang koma.',
            'bobotMinKg.min' => 'BW minimum tidak boleh kurang dari 0 kg.',
            'bobotMinKg.max' => 'BW minimum maksimal 9,99 kg.',
            'bobotMaxKg.required' => 'BW maksimum wajib diisi.',
            'bobotMaxKg.numeric' => 'BW maksimum harus berupa angka.',
            'bobotMaxKg.decimal' => 'BW maksimum maksimal dua angka di belakang koma.',
            'bobotMaxKg.min' => 'BW maksimum tidak boleh kurang dari 0 kg.',
            'bobotMaxKg.max' => 'BW maksimum maksimal 9,99 kg.',
            'bobotMaxKg.gte' => 'BW maksimum harus sama dengan atau lebih besar dari BW minimum.',
            'hargaPerKg.required' => 'Harga kontrak per kg wajib diisi.',
            'hargaPerKg.integer' => 'Harga kontrak harus berupa rupiah bulat.',
            'hargaPerKg.min' => 'Harga kontrak minimal Rp 1/kg.',
        ]);

        $tumpangTindih = $periode->hargaKontrak()
            ->where('bobot_min_kg', '<=', $data['bobotMaxKg'])
            ->where('bobot_max_kg', '>=', $data['bobotMinKg'])
            ->when($this->hargaKontrakId, fn ($query) => $query->whereKeyNot($this->hargaKontrakId))
            ->exists();

        if ($tumpangTindih) {
            throw ValidationException::withMessages([
                'bobotMinKg' => 'Rentang BW bertumpang tindih dengan bracket lain pada periode ini.',
            ]);
        }

        $hargaKontrak = $this->hargaKontrakId
            ? $this->hargaKontrakUntukPeriode($this->hargaKontrakId)
            : $periode->hargaKontrak()->make();
        $hargaKontrak->fill([
            'bobot_min_kg' => $data['bobotMinKg'],
            'bobot_max_kg' => $data['bobotMaxKg'],
            'harga_per_kg' => $data['hargaPerKg'],
        ])->save();

        $this->pesan = $this->hargaKontrakId ? 'Bracket harga diperbarui.' : 'Bracket harga baru ditambahkan.';
        $this->dispatch('tutup-modal-harga-kontrak');
        $this->batal();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        $hargaKontrak = $this->hargaKontrakUntukPeriode($id);

        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->hargaKontrakHapusId = $hargaKontrak->id;
        $this->rentangHapus = number_format($hargaKontrak->bobot_min_kg, 2, ',', '.').'–'.number_format($hargaKontrak->bobot_max_kg, 2, ',', '.').' kg';
    }

    public function hapus(): void
    {
        $id = $this->hargaKontrakHapusId ?? abort(404);
        $hargaKontrak = $this->hargaKontrakUntukPeriode($id);
        $rentang = $this->rentangHapus;
        $hargaKontrak->delete();

        $this->hargaKontrakHapusId = null;
        $this->rentangHapus = '';
        $this->pesan = 'Bracket BW '.$rentang.' dihapus.';
        $this->resetErrorBag('hapus');
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.master-harga-kontrak');
    }

    private function hargaKontrakUntukPeriode(int $id): HargaKontrak
    {
        return ($this->periode ?? abort(404))
            ->hargaKontrak()
            ->whereKey($id)
            ->firstOrFail();
    }
}
