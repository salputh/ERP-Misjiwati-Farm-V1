@props([
    'warna' => 'secondary',
    'bisaDitutup' => false,
    'judul' => null,
])

@php
    $classes = ['alert', 'alert-' . $warna];
    if ($bisaDitutup) {
        $classes[] = 'alert-dismissible fade show';
    }
    if ($judul) {
        $classes[] = 'alert-big';
    }
@endphp

<div {{ $attributes->merge(['class' => implode(' ', $classes)]) }} role="alert">
    <div class="alert-content">
        @if ($judul)
            <h6 class="alert-heading">{{ $judul }}</h6>
        @endif
        
        <p>{{ $slot }}</p>

        @if ($bisaDitutup)
            <button type="button" class="btn-close text-capitalize" data-bs-dismiss="alert" aria-label="Close">
                <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg" aria-hidden="true">
            </button>
        @endif
    </div>
</div>
