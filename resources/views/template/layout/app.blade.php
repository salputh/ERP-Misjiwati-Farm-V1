{{--
    Layout untuk halaman katalog template. Memakai kerangka aplikasi (partials/) supaya contoh
    tampil persis seperti di dalam aplikasi. Layout asli HexaDash disimpan di asli.blade.php.
--}}
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr">
@include('partials._header', ['title' => 'Template: '.View::yieldContent('title')])
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
            @yield('content')
        </div>

        <footer class="footer-wrapper">
            @include('partials._footer')
        </footer>
    </main>

    <div class="overlay-dark-sidebar"></div>

    <script>
        var env = {
            iconLoaderUrl: "{{ asset('assets/js/json/icons.json') }}",
            googleMarkerUrl: "{{ asset('assets/img/markar-icon.png') }}",
            editorIconUrl: "{{ asset('assets/img/ui/icons.svg') }}",
            mapClockIcon: "{{ asset('assets/img/svg/clock-ticket1.svg') }}"
        }
    </script>
    <script src="{{ asset('assets/js/plugins.min.js') }}"></script>
    <script src="{{ asset('assets/js/script.min.js') }}"></script>
    @livewireScripts
</body>
</html>
