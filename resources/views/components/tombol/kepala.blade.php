@props(['warna' => 'primary', 'ikon' => null, 'href' => null])

{{-- Tombol aksi di kepala halaman, persis halaman Member template: <div class="action-btn"> berisi btn px-15.
     warna="primary" untuk aksi utama, warna="white" untuk aksi pendamping (CSS template menata tombol putih di sini).
     Tombol primary diberi btn-add seperti template, supaya ikonnya putih di kepala halaman (breadcrumb-action). --}}
<div class="action-btn">
    @isset($href)
        <a href="{{ $href }}" {{ $attributes->class(['btn px-15 btn-'.$warna, 'btn-add' => $warna === 'primary']) }}>
            @isset($ikon)<i class="{{ $ikon }} fs-16" aria-hidden="true"></i>@endisset{{ $slot }}
        </a>
    @else
        <button type="button" {{ $attributes->class(['btn px-15 btn-'.$warna, 'btn-add' => $warna === 'primary']) }}>
            @isset($ikon)<i class="{{ $ikon }} fs-16" aria-hidden="true"></i>@endisset{{ $slot }}
        </button>
    @endisset
</div>
