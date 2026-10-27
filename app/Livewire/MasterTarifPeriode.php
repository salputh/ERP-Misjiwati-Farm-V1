<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\TarifPeriode;
use App\Support\Format;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Tarif periode')]
class MasterTarifPeriode extends Component
{
    /**
     * Nilai form, kuncinya kolom tarif_periodes.
     *
     * @var array<string, string>
     */
    public array $tarif = [];

    public ?string $pesan = null;

    #[Computed]
    public function tarifGlobal(): TarifPeriode
    {
        return TarifPeriode::global();
    }

    public function ubah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->tarif = collect(TarifPeriode::KOLOM)
            ->mapWithKeys(fn (string $kolom): array => [$kolom => (string) $this->tarifGlobal->{$kolom}])
            ->all();
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->tarif = [];
    }

    public function simpan(): void
    {
        $persen = ['required', 'numeric', 'decimal:0,2', 'between:0,100'];
        $rupiah = ['required', 'integer', 'min:0', 'max:4294967295'];
        $data = $this->validate([
            'tarif.tarif_gaji_abk_per_kg' => $rupiah,
            'tarif.premi_controller' => $rupiah,
            'tarif.persen_upah_controller' => $persen,
            'tarif.persen_bonus_pasar_abk' => $persen,
            'tarif.persen_bonus_pasar_controller' => $persen,
            'tarif.persen_zakat' => $persen,
        ], [
            'tarif.*.required' => 'Nilai ini wajib diisi.',
            'tarif.*.integer' => 'Masukkan rupiah bulat.',
            'tarif.*.min' => 'Nilai tidak boleh negatif.',
            'tarif.*.max' => 'Nilai terlalu besar.',
            'tarif.*.numeric' => 'Masukkan angka persentase yang valid.',
            'tarif.*.decimal' => 'Maksimal dua angka di belakang koma.',
            'tarif.*.between' => 'Persentase harus antara 0 dan 100.',
        ])['tarif'];

        $tarif = TarifPeriode::global();

        DB::transaction(function () use ($tarif, $data): void {
            $tarif->fill($data);

            if (! $tarif->isDirty()) {
                return;
            }

            $tarif->save();
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::MasterData,
                'Tarif periode',
                'Gaji ABK Rp '.Format::angka($tarif->tarif_gaji_abk_per_kg).'/kg, zakat '.Format::persen($tarif->persen_zakat),
            );
        });

        $this->pesan = 'Tarif periode diperbarui.';
        $this->dispatch('tutup-modal-tarif-periode');
        $this->batal();
        unset($this->tarifGlobal);
    }

    public function render(): View
    {
        return view('livewire.master-tarif-periode');
    }
}
