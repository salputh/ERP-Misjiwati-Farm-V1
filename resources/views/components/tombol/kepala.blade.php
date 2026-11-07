@props(['warna' => 'primary', 'ikon' => null, 'href' => null])

{{-- Tombol aksi di kepala halaman (basalt-pagehead-actions). warna="primary" untuk aksi utama,
     warna="white" untuk aksi pendamping (tombol outline netral). --}}
@php
    $kelas = $warna === 'white' ? 'btn btn-outline-secondary btn-sm' : 'btn btn-'.$warna.' btn-sm';
@endphp
@isset($href)
    <a href="{{ $href }}" {{ $attributes->class([$kelas]) }}>
        @isset($ikon)<i class="{{ $ikon }} me-1" aria-hidden="true"></i>@endisset{{ $slot }}
    </a>
@else
    <button type="button" {{ $attributes->class([$kelas]) }}>
        @isset($ikon)<i class="{{ $ikon }} me-1" aria-hidden="true"></i>@endisset{{ $slot }}
    </button>
@endisset
