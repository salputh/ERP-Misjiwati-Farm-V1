{{-- Top bar Basalt: tombol menu (ponsel), pilihan farm dan periode, notifikasi, mode terang/gelap, dan menu akun. --}}
<header class="basalt-topbar">
    <div class="basalt-topbar-start">
        <button data-basalt-chrome="menu-open" aria-label="Buka menu" aria-controls="basalt-mainmenu" aria-expanded="false" type="button" class="btn btn-icon basalt-topbar-menubtn d-lg-none">
            <i class="bi bi-list"></i>
        </button>

        <div class="basalt-topbar-pilih d-none d-lg-flex">
            @include('partials._pilih_farm_periode')
        </div>
    </div>

    <div class="basalt-topbar-end">
        <span class="small text-body-secondary d-none d-xl-inline">{{ now()->translatedFormat('l, j F Y') }}</span>

        <div class="basalt-topbar-tools">
            <button data-basalt-fullscreen data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Layar penuh" aria-pressed="false" aria-label="Layar penuh" type="button" class="btn btn-icon basalt-fullscreen d-none d-md-inline-flex">
                <i aria-hidden="true" class="bi bi-arrows-fullscreen basalt-fullscreen-enter"></i>
                <i aria-hidden="true" class="bi bi-fullscreen-exit basalt-fullscreen-exit"></i>
            </button>
            <button data-basalt-chrome="mode" aria-label="Ganti mode terang atau gelap" type="button" class="btn btn-icon basalt-modeswitch">
                <i class="bi bi-brightness-high basalt-modeswitch-day"></i>
                <i class="bi bi-moon basalt-modeswitch-night"></i>
            </button>
        </div>

        {{-- Notifikasi: hal di periode terpilih yang perlu ditindaklanjuti. --}}
        <div class="basalt-topbar-inbox">
            <div class="dropdown">
                <button data-bs-toggle="dropdown" aria-expanded="false" aria-label="Notifikasi, {{ count($notifikasi) }} perlu ditindaklanjuti" type="button" class="btn btn-icon">
                    <i class="bi bi-bell"></i>
                    @if ($notifikasi)
                        <span class="basalt-tally bg-warning">{{ count($notifikasi) }}</span>
                    @endif
                </button>
                <div class="dropdown-menu dropdown-menu-end basalt-tray">
                    <div class="basalt-tray-top">
                        <p class="h6 mb-0">Notifikasi</p>
                    </div>
                    <ul class="basalt-tray-rows">
                        @forelse ($notifikasi as $satu)
                            <li>
                                <a href="{{ $satu['tautan'] }}" class="basalt-tray-row basalt-tray-row-new">
                                    <span class="basalt-avatar basalt-avatar-sm bg-{{ $satu['warna'] }}-subtle text-{{ $satu['warna'] }}"><i class="bi {{ $satu['ikon'] }}" aria-hidden="true"></i></span>
                                    <span class="basalt-tray-copy">
                                        <span class="basalt-tray-what">{{ $satu['judul'] }}</span>
                                        <small class="text-body-secondary">{{ $satu['isi'] }}</small>
                                    </span>
                                </a>
                            </li>
                        @empty
                            <li>
                                <span class="basalt-tray-row">
                                    <span class="basalt-avatar basalt-avatar-sm bg-success-subtle text-success"><i class="bi bi-check-lg" aria-hidden="true"></i></span>
                                    <span class="basalt-tray-copy">
                                        <span class="basalt-tray-what">Tidak ada yang perlu ditindaklanjuti</span>
                                        <small class="text-body-secondary">Semua data {{ $periodeTerpilih?->nama ?? 'periode ini' }} sudah lengkap.</small>
                                    </span>
                                </span>
                            </li>
                        @endforelse
                    </ul>
                </div>
            </div>
        </div>

        @auth
            @php($inisial = \Illuminate\Support\Str::of(auth()->user()->name)->explode(' ')->take(2)->map(fn ($kata) => mb_substr($kata, 0, 1))->implode(''))
            <div class="dropdown basalt-topbar-account">
                <button data-bs-toggle="dropdown" aria-expanded="false" aria-label="Menu akun" type="button" class="btn basalt-me">
                    <span class="basalt-avatar basalt-avatar-sm bg-primary-subtle text-primary fw-semibold">{{ $inisial }}</span>
                    <span class="basalt-me-info d-none d-lg-flex">
                        <span class="basalt-me-name">{{ auth()->user()->name }}</span>
                        <span class="basalt-me-job">{{ auth()->user()->email }}</span>
                    </span>
                    <i class="bi bi-chevron-down d-none d-lg-inline"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end basalt-tray basalt-tray-account">
                    <li class="basalt-tray-top basalt-tray-me">
                        <span class="basalt-avatar bg-primary-subtle text-primary fw-semibold">{{ $inisial }}</span>
                        <div>
                            <p class="mb-0 fw-semibold">{{ auth()->user()->name }}</p>
                            <small class="text-body-secondary">{{ auth()->user()->email }}</small>
                        </div>
                    </li>
                    <li><a href="{{ route('akun') }}" class="dropdown-item"><i class="bi bi-person-badge"></i>Akun pengguna</a></li>
                    <li><hr class="dropdown-divider"></li>
                    @unless (config('app.demo_mode'))
                        <li>
                            <form action="{{ route('logout') }}" method="POST">
                                @csrf
                                <button type="submit" class="dropdown-item text-danger"><i class="bi bi-door-closed"></i>Keluar</button>
                            </form>
                        </li>
                    @else
                        <li><span class="dropdown-item-text text-body-secondary small"><i class="bi bi-door-closed me-2"></i>Versi Demo</span></li>
                    @endunless
                </ul>
            </div>
        @endauth
    </div>
</header>
