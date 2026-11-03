<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr">
@include('partials._header')
<body class="layout-light side-menu">
    <div class="mobile-search"></div>
    <div class="mobile-author-actions"></div>

    <header class="header-top">
        @include('partials._top_nav')
    </header>

    <main class="main-content">
        <div class="sidebar-wrapper">
            <aside class="sidebar sidebar-collapse" id="sidebar">
                @include('partials._menu')
            </aside>
        </div>

        <div class="contents">
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

        <footer class="footer-wrapper">
            @include('partials._footer')
        </footer>
    </main>

    <div class="overlay-dark-sidebar"></div>

    <x-panduan-sistem />

    <script src="{{ asset('assets/js/plugins.min.js') }}"></script>
    <script src="{{ asset('assets/js/script.min.js') }}"></script>
    @livewireScripts
</body>
</html>
