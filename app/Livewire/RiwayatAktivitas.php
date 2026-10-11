<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Riwayat aktivitas: setiap data yang ditambah, diubah, atau dihapus lewat aplikasi, terbaru dulu.
 */
#[Title('Aktivitas')]
class RiwayatAktivitas extends Component
{
    /**
     * Jumlah aktivitas yang dimuat tiap kali.
     */
    private const SEKALI_MUAT = 50;

    /** Saringan jenis aksi: nilai JenisAktivitas, kosong berarti semua aksi. */
    #[Url(as: 'aksi')]
    public string $jenis = '';

    /** Saringan modul: nilai ModulAktivitas, kosong berarti semua modul. */
    #[Url(as: 'modul')]
    public string $modul = '';

    #[Locked]
    public int $batas = self::SEKALI_MUAT;

    public function mount(): void
    {
        $this->pilihJenis($this->jenis);
        $this->pilihModul($this->modul);
    }

    public function pilihJenis(string $jenis): void
    {
        $this->jenis = JenisAktivitas::tryFrom($jenis)?->value ?? '';
        $this->batas = self::SEKALI_MUAT;
    }

    public function pilihModul(string $modul): void
    {
        $this->modul = ModulAktivitas::tryFrom($modul)?->value ?? '';
        $this->batas = self::SEKALI_MUAT;
    }

    public function muatLagi(): void
    {
        $this->batas += self::SEKALI_MUAT;
    }

    #[Computed]
    public function saringanJenis(): ?JenisAktivitas
    {
        return JenisAktivitas::tryFrom($this->jenis);
    }

    #[Computed]
    public function saringanModul(): ?ModulAktivitas
    {
        return ModulAktivitas::tryFrom($this->modul);
    }

    /**
     * Riwayat sudah punya isi, terlepas dari saringan.
     */
    #[Computed]
    public function adaAktivitas(): bool
    {
        return Aktivitas::exists();
    }

    /**
     * Jumlah aktivitas yang cocok dengan saringan, termasuk yang belum dimuat.
     */
    #[Computed]
    public function total(): int
    {
        return $this->tersaring()->count();
    }

    /**
     * @return Collection<int, Aktivitas>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return $this->tersaring()->terbaru()->limit($this->batas)->get();
    }

    /**
     * Aktivitas yang dimuat, dikelompokkan per hari: "Y-m-d" => aktivitas hari itu.
     *
     * @return \Illuminate\Support\Collection<string, Collection<int, Aktivitas>>
     */
    #[Computed]
    public function perHari(): \Illuminate\Support\Collection
    {
        return $this->daftar->groupBy(fn (Aktivitas $aktivitas): string => $aktivitas->created_at->toDateString());
    }

    public function render(): View
    {
        return view('livewire.riwayat-aktivitas');
    }

    /**
     * @return Builder<Aktivitas>
     */
    private function tersaring(): Builder
    {
        return Aktivitas::query()
            ->when($this->saringanJenis, fn (Builder $query, JenisAktivitas $jenis) => $query->where('jenis', $jenis))
            ->when($this->saringanModul, fn (Builder $query, ModulAktivitas $modul) => $query->where('modul', $modul));
    }
}
