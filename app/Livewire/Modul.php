<?php

namespace App\Livewire;

use Livewire\Component;

/** Halaman sementara untuk modul yang belum dibuat. */
class Modul extends Component
{
    public string $grup;

    public string $slug;

    public function mount(string $grup, string $slug): void
    {
        abort_unless(config("navigasi.$grup.item.$slug"), 404);
    }

    public function render()
    {
        $grup = config("navigasi.{$this->grup}");
        $item = $grup['item'][$this->slug];

        return view('livewire.modul', ['kelompok' => $grup, 'item' => $item])
            ->title($item['label']);
    }
}
