<?php

namespace App\Livewire;

use Illuminate\View\View;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Master data')]
class MasterData extends Component
{
    public function render(): View
    {
        return view('livewire.master-data');
    }
}
