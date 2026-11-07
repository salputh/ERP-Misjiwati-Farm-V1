@props([
    'id',
    'judul',
    'ukuran' => 'md', // sm, md, lg, xl
    'scrollable' => true,
    'footer' => null,
    'submit' => null,
    'aksiTutup' => null,
])

{{--
    "aksiTutup" adalah aksi Livewire yang dijalankan tombol tutup di kepala modal, misalnya untuk mengosongkan form.
    Bila "submit" diisi, komponen ini yang membungkus badan dan footer modal dengan satu form,
    sehingga tombol simpan di footer ikut mengirim form. Modal yang sudah punya form sendiri
    (misalnya untuk pintasan tekan Enter) memakai komponen ini tanpa "submit".
--}}

<div
    {{ $attributes->merge(['class' => 'modal fade', 'id' => $id]) }}
    tabindex="-1"
    role="dialog"
    aria-labelledby="{{ $id }}-judul"
    aria-hidden="true"
    wire:ignore.self
>
    <div class="modal-dialog {{ ['sm' => 'modal-sm', 'lg' => 'modal-lg', 'xl' => 'modal-xl'][$ukuran] ?? '' }} @if($scrollable) modal-dialog-scrollable @endif modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title h6" id="{{ $id }}-judul">{{ $judul }}</h2>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup" @isset($aksiTutup) wire:click="{{ $aksiTutup }}" @endisset></button>
            </div>
            @if ($submit)
                <form wire:submit="{{ $submit }}">
                    <div class="modal-body">
                        {{ $slot }}
                    </div>
                    @if ($footer || isset($footerSlot))
                        <div class="modal-footer">
                            {{ $footer ?? $footerSlot }}
                        </div>
                    @endif
                </form>
            @else
                <div class="modal-body">
                    {{ $slot }}
                </div>
                @if ($footer || isset($footerSlot))
                    <div class="modal-footer">
                        {{ $footer ?? $footerSlot }}
                    </div>
                @endif
            @endif
        </div>
    </div>
</div>
