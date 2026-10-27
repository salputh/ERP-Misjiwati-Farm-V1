<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\PremiAbk;
use App\Support\Format;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Tabel "Estimasi hasil kandang koloni per ekor (4 abk)": premi pemeliharaan ABK menurut total budidaya per ekor.
 * RHPP (simulasi bagi hasil) dan lembar bagi hasil mengambil premi dari tabel ini.
 */
#[Title('Premi ABK')]
class MasterPremiAbk extends Component
{
    #[Locked]
    public ?int $premiId = null;

    public string $hasilPerEkor = '';

    public string $intensif = '';

    public string $premi = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $premiHapusId = null;

    /**
     * @return Collection<int, PremiAbk>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return PremiAbk::query()->orderBy('hasil_per_ekor')->get();
    }

    public function tambah(): void
    {
        $this->pesan = null;
        $this->bersihkanForm();
    }

    public function ubah(int $id): void
    {
        $baris = PremiAbk::query()->findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->premiId = $baris->id;
        $this->hasilPerEkor = (string) $baris->hasil_per_ekor;
        $this->intensif = (string) $baris->intensif;
        $this->premi = (string) $baris->premi;
    }

    public function batal(): void
    {
        $this->bersihkanForm();
    }

    public function simpan(): void
    {
        $data = $this->validate([
            'hasilPerEkor' => ['required', 'integer', 'min:1', 'max:4294967295', Rule::unique('premi_abks', 'hasil_per_ekor')->ignore($this->premiId)],
            'intensif' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'premi' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
        ], [
            'hasilPerEkor.required' => 'Hasil per ekor wajib diisi.',
            'hasilPerEkor.integer' => 'Hasil per ekor harus berupa rupiah bulat.',
            'hasilPerEkor.min' => 'Hasil per ekor minimal Rp 1.',
            'hasilPerEkor.max' => 'Hasil per ekor terlalu besar.',
            'hasilPerEkor.unique' => 'Hasil per ekor ini sudah ada di tabel.',
            'intensif.required' => 'Intensif wajib diisi.',
            'intensif.integer' => 'Intensif harus berupa angka bulat.',
            'intensif.min' => 'Intensif tidak boleh negatif.',
            'intensif.max' => 'Intensif terlalu besar.',
            'premi.required' => 'Premi wajib diisi.',
            'premi.integer' => 'Premi harus berupa rupiah bulat.',
            'premi.min' => 'Premi tidak boleh negatif.',
            'premi.max' => 'Premi terlalu besar.',
        ]);

        $baru = $this->premiId === null;
        $baris = DB::transaction(function () use ($data, $baru): PremiAbk {
            $baris = $baru ? new PremiAbk : PremiAbk::query()->findOrFail($this->premiId);
            $baris->fill([
                'hasil_per_ekor' => (int) $data['hasilPerEkor'],
                'intensif' => (int) $data['intensif'],
                'premi' => (int) $data['premi'],
            ]);

            if ($baris->isDirty()) {
                $baris->save();
                Aktivitas::catat(
                    $baru ? JenisAktivitas::Tambah : JenisAktivitas::Ubah,
                    ModulAktivitas::MasterData,
                    self::subjek($baris),
                    self::rincian($baris),
                );
            }

            return $baris;
        });

        $this->pesan = self::subjek($baris).($baru ? ' ditambahkan.' : ' diperbarui.');
        $this->dispatch('tutup-modal-premi-abk');
        $this->bersihkanForm();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        PremiAbk::query()->findOrFail($id);

        $this->pesan = null;
        $this->premiHapusId = $id;
    }

    public function hapus(): void
    {
        $id = $this->premiHapusId ?? abort(404);

        $subjek = DB::transaction(function () use ($id): string {
            $baris = PremiAbk::query()->findOrFail($id);
            $subjek = self::subjek($baris);
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::MasterData, $subjek, self::rincian($baris));
            $baris->delete();

            return $subjek;
        });

        $this->premiHapusId = null;
        $this->pesan = $subjek.' dihapus.';
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.master-premi-abk');
    }

    private function bersihkanForm(): void
    {
        $this->resetValidation();
        $this->premiId = null;
        $this->hasilPerEkor = '';
        $this->intensif = '';
        $this->premi = '';
    }

    private static function subjek(PremiAbk $baris): string
    {
        return 'Premi ABK Rp '.Format::angka($baris->hasil_per_ekor).' per ekor';
    }

    private static function rincian(PremiAbk $baris): string
    {
        return 'Intensif '.Format::angka($baris->intensif).', premi Rp '.Format::angka($baris->premi);
    }
}
