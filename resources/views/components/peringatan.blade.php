@props([
    'warna' => 'info',
    'bisaDitutup' => false,
    'judul' => null,
])

{{-- Peringatan bergaya katalog template (HexaDash: Alert). Dengan judul memakai alert-big template. --}}
<div {{ $attributes->class([
    'alert alert-'.$warna,
    'alert-dismissible fade show' => $bisaDitutup,
    'alert-big' => $judul,
]) }} role="alert">
    <div class="alert-content">
        @if ($judul)
            <h6 class="alert-heading">{{ $judul }}</h6>
        @endif

        <p>{{ $slot }}</p>

        @if ($bisaDitutup)
            <button type="button" class="btn-close text-capitalize" data-bs-dismiss="alert" aria-label="Tutup">
                <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg" aria-hidden="true">
            </button>
        @endif
    </div>
</div>
