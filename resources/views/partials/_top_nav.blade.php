<nav class="navbar navbar-light">
    <div class="navbar-left">
        <div class="logo-area">
            <a class="navbar-brand brand-teks" href="{{ route('dashboard') }}">Misjiwati Farm</a>
            <a href="#" class="sidebar-toggle" aria-label="Buka atau tutup sidebar">
                <img class="svg" src="{{ asset('assets/img/svg/align-center-alt.svg') }}" alt="">
            </a>
        </div>
    </div>
    <div class="navbar-right">
        <ul class="navbar-right__menu">
            <li><span class="fs-14 color-gray">{{ now()->translatedFormat('l, j F Y') }}</span></li>
        </ul>
    </div>
</nav>
