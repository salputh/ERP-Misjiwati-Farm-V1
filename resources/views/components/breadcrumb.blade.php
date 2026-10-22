@props(['judul', 'jejak' => []])

{{-- Judul halaman + jejak. Slot diisi aksi tambahan di kanan (misalnya pemilih periode). --}}
<div class="col-lg-12">
    <div class="breadcrumb-main">
        <h4 class="text-capitalize breadcrumb-title">{{ $judul }}</h4>
        <div class="breadcrumb-action justify-content-center flex-wrap">
            {{ $slot }}
            <nav aria-label="breadcrumb" class="d-flex align-items-center">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item"><a href="{{ route('dashboard') }}"><i class="uil uil-create-dashboard"></i>Ringkasan</a></li>
                    @foreach ($jejak as $label)
                        <li @class(['breadcrumb-item', 'active' => $loop->last]) @if ($loop->last) aria-current="page" @endif>{{ $label }}</li>
                    @endforeach
                </ol>
            </nav>
        </div>
    </div>
</div>
