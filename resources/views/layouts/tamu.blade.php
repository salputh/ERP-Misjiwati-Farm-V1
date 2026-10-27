<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr">
@include('partials._header')
<body>
    {{-- Halaman tanpa sidebar untuk pengguna yang belum masuk (HexaDash: Log In). --}}
    <main class="main-content">
        <div class="admin" style="background-image:url({{ asset('assets/img/admin-bg-light.png') }});">
            {{ $slot }}
        </div>
    </main>

    <script src="{{ asset('assets/js/plugins.min.js') }}"></script>
    <script src="{{ asset('assets/js/script.min.js') }}"></script>
    @livewireScripts
</body>
</html>
