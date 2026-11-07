@props([
    'warna' => 'info',
    'bisaDitutup' => false,
    'judul' => null,
])

{{-- Peringatan Basalt (Bootstrap alert). Dengan judul, judulnya tampil tebal di atas isi. --}}
<div {{ $attributes->class([
    'alert alert-'.$warna,
    'alert-dismissible fade show' => $bisaDitutup,
]) }} role="alert">
    @if ($judul)
        <h2 class="alert-heading h6">{{ $judul }}</h2>
    @endif

    <p class="mb-0">{{ $slot }}</p>

    @if ($bisaDitutup)
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Tutup"></button>
    @endif
</div>
