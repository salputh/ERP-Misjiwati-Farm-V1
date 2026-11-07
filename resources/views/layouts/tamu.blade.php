@push('gaya-halaman')
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/pages/multipurpose/sign-in.css') }}">
@endpush
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-basalt-palette="dusk" data-bs-theme="light">
@include('partials._header')
<body class="basalt-doc signin-body signin-body-daylight">
    {{-- Halaman tanpa sidebar untuk pengguna yang belum masuk: halaman Sign In Basalt (langit mengikuti jam pengunjung). --}}
    {{ $slot }}

    @include('partials._skrip')
    <script src="{{ asset('assets/basalt/js/pages/multipurpose/sign-in.js') }}"></script>
</body>
</html>
