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
