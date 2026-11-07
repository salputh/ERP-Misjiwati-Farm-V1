{{-- Menu utama Basalt. Grup, item, dan ikon berasal dari config/navigasi.php (ikon: Bootstrap Icons).
     Tautan aktif diberi aria-current="page" dan kelas active; induk dropdown kandang memakai trail-current. --}}
@php
    $parameter = ['farm' => $farm?->id, 'periode' => $periode?->id];
@endphp
<aside id="basalt-mainmenu" aria-label="Sidebar" class="basalt-mainmenu">
    <div class="basalt-mainmenu-top">
        <a aria-label="Ke ringkasan Misjiwati Farm" href="{{ route('dashboard') }}" class="basalt-logo">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="basalt-logo-art">
                <defs>
                    <linearGradient id="basalt-logo-fill" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" class="basalt-logo-fade-a" />
                        <stop offset="100%" class="basalt-logo-fade-b" />
                    </linearGradient>
                </defs>
                <path fill="url(#basalt-logo-fill)" d="M2.75 27.5V17L5.5 15.5L8.25 17V27.5Z M9.75 27.5V10L12.5 8.5L15.25 10V27.5Z M16.75 27.5V13.5L19.5 12L22.25 13.5V27.5Z M23.75 27.5V6L26.5 4.5L29.25 6V27.5Z" class="basalt-logo-glyph" />
            </svg>
            <span class="basalt-logo-word">Misjiwati</span> <span class="basalt-logo-plan">Farm</span>
        </a>
        <button data-basalt-menu-narrow aria-label="Persempit menu" aria-controls="basalt-mainmenu" aria-expanded="true" type="button" class="basalt-mainmenu-shrink">
            <i aria-hidden="true" class="basalt-mainmenu-shrink-wide bi bi-layout-sidebar-inset"></i>
            <i aria-hidden="true" class="basalt-mainmenu-shrink-narrow bi bi-layout-sidebar-inset-reverse"></i>
        </button>
        <button data-basalt-chrome="menu-close" aria-label="Tutup menu" type="button" class="btn btn-sm btn-icon basalt-mainmenu-shut d-lg-none">
            <i class="bi bi-x-lg"></i>
        </button>
    </div>

    <div role="search" aria-label="Cari menu" class="basalt-mainmenu-find">
        <label for="basalt-menu-search" class="visually-hidden">Cari halaman</label>
        <i aria-hidden="true" class="bi bi-search"></i>
        <input data-basalt-menu-search id="basalt-menu-search" type="search" placeholder="Cari halaman" autocomplete="off" class="basalt-mainmenu-find-field" spellcheck="false">
        <button data-basalt-menu-clear aria-label="Hapus pencarian" type="button" class="basalt-mainmenu-find-reset" hidden>
            <i aria-hidden="true" class="bi bi-x-lg"></i>
        </button>
    </div>

    <nav aria-label="Halaman" class="basalt-mainmenu-scroll">
        <p data-basalt-menu-empty class="basalt-mainmenu-nomatch" hidden></p>

        <div data-basalt-icon="bi-grid-1x2" class="basalt-menu-group">
            <button data-basalt-section-toggle aria-expanded="true" aria-controls="nav-ringkasan" type="button" class="basalt-menu-group-heading">
                Ringkasan<i aria-hidden="true" class="basalt-menu-group-caret bi bi-chevron-down"></i>
            </button>
            <ul id="nav-ringkasan" class="basalt-menu-links">
                <li>
                    <a href="{{ route('dashboard', $parameter) }}" @class(['basalt-menu-entry', 'active' => request()->routeIs('dashboard')]) @if (request()->routeIs('dashboard')) aria-current="page" @endif>
                        <i aria-hidden="true" class="basalt-menu-glyph bi bi-grid-1x2"></i><span class="basalt-menu-label">Ringkasan</span>
                    </a>
                </li>
                <li>
                    <a href="{{ route('aktivitas', $parameter) }}" @class(['basalt-menu-entry', 'active' => request()->routeIs('aktivitas')]) @if (request()->routeIs('aktivitas')) aria-current="page" @endif>
                        <i aria-hidden="true" class="basalt-menu-glyph bi bi-clock-history"></i><span class="basalt-menu-label">Aktivitas</span>
                    </a>
                </li>
            </ul>
        </div>

        @foreach (config('navigasi') as $kunciGrup => $grup)
            @php
                $ikonGrup = collect($grup['item'])->first()['ikon'] ?? 'bi-grid';
            @endphp
            <div data-basalt-icon="{{ $ikonGrup }}" class="basalt-menu-group">
                <button data-basalt-section-toggle aria-expanded="true" aria-controls="nav-{{ $kunciGrup }}" type="button" class="basalt-menu-group-heading">
                    {{ $grup['label'] }}<i aria-hidden="true" class="basalt-menu-group-caret bi bi-chevron-down"></i>
                </button>
                <ul id="nav-{{ $kunciGrup }}" class="basalt-menu-links">
                    @foreach ($grup['item'] as $slug => $item)
                        @isset($item['per_kandang'])
                            {{-- Induk lipat: satu tautan per kandang. --}}
                            @php($dalamInduk = request()->is($kunciGrup.'/'.$slug.'/*'))
                            <li>
                                <a data-bs-toggle="collapse" role="button" aria-expanded="{{ $dalamInduk ? 'true' : 'false' }}" aria-controls="nav-{{ $kunciGrup }}-{{ $slug }}" href="#nav-{{ $kunciGrup }}-{{ $slug }}" @class(['basalt-menu-entry basalt-menu-entry-parent', 'trail-current' => $dalamInduk, 'collapsed' => ! $dalamInduk])>
                                    <i aria-hidden="true" class="basalt-menu-glyph bi {{ $item['ikon'] }}"></i><span class="basalt-menu-label">{{ $item['label'] }}</span><i aria-hidden="true" class="basalt-menu-caret bi bi-chevron-down"></i>
                                </a>
                                <ul id="nav-{{ $kunciGrup }}-{{ $slug }}" @class(['collapse basalt-menu-children', 'show' => $dalamInduk])>
                                    @foreach ($kandangMenu as $kandang)
                                        @php($kandangAktif = request()->is($kunciGrup.'/'.$slug.'/'.$kandang->id))
                                        <li>
                                            <a href="{{ route($item['per_kandang'], ['kandang' => $kandang, 'farm' => $farm?->id, 'periode' => $periode?->id]) }}" @class(['basalt-menu-child', 'active' => $kandangAktif]) @if ($kandangAktif) aria-current="page" @endif>
                                                <i aria-hidden="true" class="basalt-menu-glyph bi bi-house-door"></i><span class="basalt-menu-label">{{ $kandang->nama }}</span>
                                            </a>
                                        </li>
                                    @endforeach
                                </ul>
                            </li>
                        @else
                            @php($aktif = isset($item['rute']) ? request()->routeIs($item['rute_aktif'] ?? $item['rute']) : request()->is($kunciGrup.'/'.$slug, $kunciGrup.'/'.$slug.'/*'))
                            <li>
                                <a href="{{ isset($item['rute']) ? route($item['rute'], $parameter) : route('modul', ['grup' => $kunciGrup, 'slug' => $slug] + $parameter) }}" @class(['basalt-menu-entry', 'active' => $aktif]) @if ($aktif) aria-current="page" @endif>
                                    <i aria-hidden="true" class="basalt-menu-glyph bi {{ $item['ikon'] }}"></i><span class="basalt-menu-label">{{ $item['label'] }}</span>
                                </a>
                            </li>
                        @endisset
                    @endforeach
                </ul>
            </div>
        @endforeach

        @if (Route::has('template.index'))
            <div data-basalt-icon="bi-grid" class="basalt-menu-group">
                <button data-basalt-section-toggle aria-expanded="true" aria-controls="nav-pengembangan" type="button" class="basalt-menu-group-heading">
                    Pengembangan<i aria-hidden="true" class="basalt-menu-group-caret bi bi-chevron-down"></i>
                </button>
                <ul id="nav-pengembangan" class="basalt-menu-links">
                    <li>
                        <a href="{{ route('template.index') }}" @class(['basalt-menu-entry', 'active' => request()->routeIs('template.*')]) @if (request()->routeIs('template.*')) aria-current="page" @endif>
                            <i aria-hidden="true" class="basalt-menu-glyph bi bi-grid"></i><span class="basalt-menu-label">Katalog template</span>
                        </a>
                    </li>
                </ul>
            </div>
        @endif
    </nav>

    @auth
        <div class="basalt-mainmenu-account">
            <span aria-hidden="true" class="basalt-mainmenu-face"><span>{{ \Illuminate\Support\Str::of(auth()->user()->name)->explode(' ')->take(2)->map(fn ($kata) => mb_substr($kata, 0, 1))->implode('') }}</span></span>
            <span class="basalt-mainmenu-account-text">
                <span class="basalt-mainmenu-person">{{ auth()->user()->name }}</span>
                <span class="basalt-mainmenu-jobline">{{ auth()->user()->email }}</span>
            </span>
            <a aria-label="Akun pengguna" href="{{ route('akun') }}" class="basalt-mainmenu-account-gear"><i aria-hidden="true" class="bi bi-gear"></i></a>
        </div>
    @endauth
</aside>
