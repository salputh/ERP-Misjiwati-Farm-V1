<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-basalt-palette="dusk" data-bs-theme="light">
@include('partials._header')
<body class="basalt-doc">
    <a href="#basalt-stage" class="visually-hidden-focusable position-absolute top-0 start-0 p-2 bg-primary text-white">Lompat ke isi halaman</a>

    {{-- Menu utama Basalt (aside.basalt-mainmenu), digambar dari config/navigasi.php. --}}
    @include('partials._menu')

    <div data-basalt-chrome="menu-close" aria-hidden="true" class="basalt-dim"></div>

    {{-- Semua di kanan menu: top bar, isi halaman, dan kakinya. Margin kirinya mengikuti lebar menu. --}}
    <div class="basalt-frame">
        @include('partials._top_nav')

        <main id="basalt-stage" tabindex="-1" class="basalt-stage">
            <div class="container-fluid px-2 px-sm-3 px-lg-4 py-3 py-lg-4 db-page">
                @if(config('app.demo_mode'))
                    <div class="alert alert-info mb-3" role="status">
                        <strong>Versi Demo</strong> — Data contoh untuk eksplorasi fitur.
                        @if(config('app.demo_readonly'))
                            Mode hanya lihat: filter dan unduhan tersedia; perubahan data dinonaktifkan.
                        @endif
                    </div>
                @endif
                {{ $slot }}
            </div>

            @include('partials._footer')
        </main>
    </div>

    <x-panduan-sistem />

    @include('partials._skrip')
</body>
</html>
