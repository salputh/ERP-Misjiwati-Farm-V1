@props(['judul', 'jejak' => []])

{{-- Kepala halaman Basalt (basalt-pagehead): satu h1, jejak halaman kecil di atas judul, dan aksi di kanan lewat slot. --}}
<div class="col-12">
    <header class="basalt-pagehead">
        <div class="basalt-pagehead-text">
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb small mb-1">
                    <li class="breadcrumb-item"><a href="{{ route('dashboard') }}">Ringkasan</a></li>
                    @foreach ($jejak as $label)
                        @if ($loop->last)
                            <li class="breadcrumb-item active" aria-current="page">{{ $label }}</li>
                        @else
                            <li class="breadcrumb-item">{{ $label }}</li>
                        @endif
                    @endforeach
                </ol>
            </nav>
            <h1 class="basalt-pagehead-title">{{ $judul }}</h1>
        </div>
        <div class="basalt-pagehead-actions flex-wrap">
            {{ $slot }}
        </div>
    </header>
</div>
