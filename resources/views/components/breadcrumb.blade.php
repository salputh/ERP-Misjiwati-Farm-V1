@props(['judul', 'jejak' => []])

{{-- Kepala halaman bergaya katalog template (HexaDash: breadcrumb-main). Slot berisi aksi di kanan;
     tiap aksi dibungkus <div class="action-btn"> seperti halaman Member template supaya jaraknya seragam.
     Jejak tengah adalah nama grup menu tanpa halaman sendiri, jadi ditulis sebagai teks berwarna tautan template. --}}
<div class="col-lg-12">
    <div class="breadcrumb-main">
        <h4 class="text-capitalize breadcrumb-title">{{ $judul }}</h4>
        <div class="breadcrumb-action justify-content-center flex-wrap">
            {{ $slot }}
            <nav aria-label="breadcrumb" class="d-flex align-items-center ms-2">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item"><a href="{{ route('dashboard') }}"><i class="las la-home"></i>Ringkasan</a></li>
                    @foreach ($jejak as $label)
                        @if ($loop->last)
                            <li class="breadcrumb-item active" aria-current="page">{{ $label }}</li>
                        @else
                            <li class="breadcrumb-item fs-14 fw-400 color-gray">{{ $label }}</li>
                        @endif
                    @endforeach
                </ol>
            </nav>
        </div>
    </div>
</div>
