<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('kode') · @yield('judul') | Misjiwati Farm</title>

    {{-- Hanya aset statis: halaman error tidak boleh bergantung pada database, Vite, atau Livewire. --}}
    <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('assets/css/plugin.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/style.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/css/variables.css') }}">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ asset('assets/img/favicon.png') }}">
</head>
<body>
    {{-- Halaman error bergaya katalog template (HexaDash: 404). --}}
    <main class="main-content">
        <div class="container-fluid">
            <div class="row justify-content-center">
                <div class="col-12">
                    <div class="min-vh-100 content-center">
                        <div class="error-page text-center">
                            <img src="{{ asset('assets/img/svg/404.svg') }}" alt="" class="svg">
                            <div class="error-page__title">@yield('kode')</div>
                            <h5 class="fw-500">@yield('judul')</h5>
                            <p class="color-gray mt-10 mb-0">@yield('pesan')</p>
                            <div class="content-center mt-30">
                                <a href="{{ url('/dashboard') }}" class="btn btn-primary btn-default btn-squared px-30">Kembali ke dashboard</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>
</body>
</html>
