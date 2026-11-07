<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-basalt-palette="dusk" data-bs-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#6d3fe0">
    <title>@yield('kode') · @yield('judul') | Misjiwati Farm</title>

    {{-- Hanya aset statis: halaman error tidak boleh bergantung pada database, Vite, atau Livewire. --}}
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/bootstrap.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/vendor/bootstrap-icons/bootstrap-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/basalt.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/pages/multipurpose/status-screens.css') }}">
    <link rel="icon" type="image/svg+xml" href="{{ asset('assets/basalt/icons/basalt-mark.svg') }}">
</head>
<body class="basalt-doc stp-body">
    {{-- Halaman status Basalt (status-screens.css): latar lembut, kepala dengan merek dan tombol mode, lalu isi. --}}
    <div aria-hidden="true" class="stp-ambient">
        <span class="stp-ambient-blob stp-ambient-blob-a"></span>
        <span class="stp-ambient-blob stp-ambient-blob-b"></span>
    </div>

    <div class="stp-shell">
        <header class="stp-topbar">
            <a aria-label="Ke dashboard Misjiwati Farm" href="{{ url('/dashboard') }}" class="stp-brand">
                <span aria-hidden="true" class="stp-brand-logo">
                    <svg role="img" aria-label="Misjiwati Farm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
                        <defs>
                            <linearGradient id="status-brand" x1="0" y1="0" x2="1" y2="1">
                                <stop class="basalt-logo-fade-a" offset="0%" />
                                <stop class="basalt-logo-fade-b" offset="100%" />
                            </linearGradient>
                        </defs>
                        <path d="M2.75 27.5V17L5.5 15.5L8.25 17V27.5Z M9.75 27.5V10L12.5 8.5L15.25 10V27.5Z M16.75 27.5V13.5L19.5 12L22.25 13.5V27.5Z M23.75 27.5V6L26.5 4.5L29.25 6V27.5Z" fill="url(#status-brand)" class="basalt-logo-glyph" />
                    </svg>
                </span>
                <span class="stp-brand-text">Misjiwati Farm</span>
            </a>
            <div class="stp-topbar-actions">
                <button data-basalt-chrome="mode" aria-label="Ganti mode terang atau gelap" type="button" class="stp-theme-toggle">
                    <i class="bi bi-moon"></i>
                    <i class="bi bi-brightness-high"></i>
                </button>
            </div>
        </header>

        <main class="stp-404">
            @if (trim($__env->yieldContent('kode')) === '404')
                <div aria-hidden="true" class="stp-404-art">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stp-404-svg" viewBox="0 0 640 280">
                        <defs>
                            <linearGradient id="route404" x1="0" y1="0" x2="1" y2="1">
                                <stop class="stp-404-stop-from" offset="0%" />
                                <stop class="stp-404-stop-mid" offset="55%" />
                                <stop class="stp-404-stop-to" offset="100%" />
                            </linearGradient>
                        </defs>
                        <g class="stp-404-layer">
                            <path d="M196 168 H44 L150 36 V228" class="stp-404-track" />
                            <path d="M196 168 H44 L150 36 V228" class="stp-404-route" pathLength="1" />
                        </g>
                        <g class="stp-404-layer is-front">
                            <path d="M364.7 210.6 A78 96 0 1 1 393.3 164.8" class="stp-404-track" />
                            <path d="M364.7 210.6 A78 96 0 1 1 393.3 164.8" class="stp-404-route stp-404-route-zero" pathLength="1" />
                            <g class="stp-404-sparks">
                                <line x1="404" y1="186" x2="416" y2="192" />
                                <line x1="398" y1="198" x2="408" y2="208" />
                                <line x1="386" y1="204" x2="390" y2="216" />
                            </g>
                            <circle class="stp-404-dot" r="11" cx="364.7" cy="210.6" />
                        </g>
                        <g class="stp-404-layer">
                            <path d="M596 168 H444 L550 36 V228" class="stp-404-track" />
                            <path d="M596 168 H444 L550 36 V228" class="stp-404-route stp-404-route-late" pathLength="1" />
                        </g>
                    </svg>
                </div>
            @endif

            <div class="stp-404-intro">
                <span @class(['stp-eyebrow', 'stp-eyebrow-danger' => (int) trim($__env->yieldContent('kode')) >= 500, 'stp-eyebrow-amber' => (int) trim($__env->yieldContent('kode')) < 500])><i class="bi bi-signpost-split"></i> Error @yield('kode')</span>
                <h1 class="stp-title">@yield('judul')</h1>
                <p class="stp-lead">@yield('pesan')</p>
                <div class="stp-cta-row">
                    <a href="{{ url('/dashboard') }}" class="btn stp-btn-primary"><i class="bi bi-house me-1"></i> Kembali ke dashboard</a>
                    <button type="button" class="btn stp-btn-ghost" onclick="history.length > 1 ? history.back() : location.assign('{{ url('/dashboard') }}')"><i class="bi bi-arrow-left me-1"></i> Halaman sebelumnya</button>
                </div>
            </div>
        </main>

        <footer class="stp-footer">
            &copy; <span data-basalt-chrome="year">{{ date('Y') }}</span> Misjiwati Farm
        </footer>
    </div>

    <script src="{{ asset('assets/vendor/bootstrap/js/bootstrap.bundle.min.js') }}" defer></script>
    <script src="{{ asset('assets/basalt/js/appearance.js') }}" defer></script>
</body>
</html>
