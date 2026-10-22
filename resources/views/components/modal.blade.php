@props([
    'id',
    'judul',
    'ukuran' => 'md', // sm, md, lg, xl
    'scrollable' => true,
    'footer' => null,
    'submit' => null,
])

{{--
    Bila "submit" diisi, komponen ini yang membungkus badan dan footer modal dengan satu form,
    sehingga tombol simpan di footer ikut mengirim form. Modal yang sudah punya form sendiri
    (misalnya untuk pintasan tekan Enter) memakai komponen ini tanpa "submit".
--}}

<div
    {{ $attributes->merge(['class' => 'modal-basic modal fade', 'id' => $id]) }}
    tabindex="-1"
    role="dialog"
    aria-labelledby="{{ $id }}-judul"
    aria-hidden="true"
    wire:ignore.self
>
    <div class="modal-dialog modal-{{ $ukuran }} @if($scrollable) modal-dialog-scrollable @endif modal-dialog-centered" role="document">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <h6 class="modal-title" id="{{ $id }}-judul">{{ $judul }}</h6>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg">
                </button>
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
