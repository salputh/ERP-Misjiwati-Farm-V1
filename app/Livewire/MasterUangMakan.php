<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\Pengaturan;
use App\Support\Format;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Uang makan bawaan ABK: tarif per hari dan jumlah hari. Dipotong dari slip gaji ABK setelah RHPP periode itu keluar,
 * kecuali ABK sudah punya transaksi Pinjaman Makan atas namanya di kas operasional. Jabatan lain tidak dipotong.
 */
#[Title('Uang makan')]
class MasterUangMakan extends Component
{
    public string $perHari = '';

    public string $hari = '';

    public ?string $pesan = null;

    /**
     * @return array{per_hari: int, hari: int, total: int}
     */
    #[Computed]
    public function uangMakan(): array
    {
        return Pengaturan::uangMakan();
    }

    public function ubah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->perHari = (string) $this->uangMakan['per_hari'];
        $this->hari = (string) $this->uangMakan['hari'];
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->perHari = '';
        $this->hari = '';
    }

    public function simpan(): void
    {
        $data = $this->validate([
            'perHari' => ['required', 'integer', 'min:0', 'max:10000000'],
            'hari' => ['required', 'integer', 'min:0', 'max:366'],
        ], [
            'perHari.required' => 'Uang makan per hari wajib diisi.',
            'perHari.integer' => 'Masukkan rupiah bulat.',
            'perHari.min' => 'Nilai tidak boleh negatif.',
            'perHari.max' => 'Nilai terlalu besar.',
            'hari.required' => 'Jumlah hari wajib diisi.',
            'hari.integer' => 'Masukkan jumlah hari bulat.',
            'hari.min' => 'Jumlah hari tidak boleh negatif.',
            'hari.max' => 'Jumlah hari maksimal 366.',
        ]);

        DB::transaction(function () use ($data): void {
            if ([(int) $data['perHari'], (int) $data['hari']] === [$this->uangMakan['per_hari'], $this->uangMakan['hari']]) {
                return;
            }

            Pengaturan::setUangMakan((int) $data['perHari'], (int) $data['hari']);
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::MasterData,
                'Uang makan ABK',
                'Rp '.Format::angka((int) $data['perHari']).' × '.Format::angka((int) $data['hari']).' hari',
            );
        });

        $this->pesan = 'Uang makan diperbarui.';
        $this->dispatch('tutup-modal-uang-makan');
        $this->batal();
        unset($this->uangMakan);
    }

    public function render(): View
    {
        return view('livewire.master-uang-makan');
    }
}
