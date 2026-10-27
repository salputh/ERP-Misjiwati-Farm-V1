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
            @if ($farm)
                <li>
                    <x-pilih class="header-periode" :label="$farm->nama" nama="Pilih farm" ukuran="sm">
                        @foreach ($daftarFarm as $pilihan)
                            <a
                                href="{{ route('periode.index', ['farm' => $pilihan->id]) }}"
                                @class(['dropdown-item', 'active' => $pilihan->is($farm)])
                                @if ($pilihan->is($farm)) aria-current="true" @endif>
                                {{ $pilihan->nama }}
                            </a>
                        @endforeach
                    </x-pilih>
                </li>
            @endif
            @if ($periodeTerpilih)
                <li>
                    <x-pilih class="header-periode" :label="$periodeTerpilih->nama" nama="Pilih periode" ukuran="sm">
                        @foreach ($daftarPeriode as $pilihan)
                            <a
                                href="{{ request()->fullUrlWithQuery(['periode' => $pilihan->id]) }}"
                                @class(['dropdown-item', 'active' => $pilihan->is($periodeTerpilih)])
                                @if ($pilihan->is($periodeTerpilih)) aria-current="true" @endif>
                                {{ $pilihan->nama }} · {{ ucfirst($pilihan->status) }}
                            </a>
                        @endforeach
                    </x-pilih>
                </li>
            @endif
            {{-- Notifikasi (HexaDash: nav-notification). Dropdown terbuka saat disorot atau difokus. --}}
            <li class="nav-notification">
                <div class="dropdown-custom">
                    <a href="javascript:;" @class(['nav-item-toggle', 'icon-active' => $notifikasi]) aria-label="Notifikasi, {{ count($notifikasi) }} perlu ditindaklanjuti" aria-haspopup="true">
                        <img class="svg" src="{{ asset('assets/img/svg/alarm.svg') }}" alt="">
                    </a>
                    <div class="dropdown-wrapper">
                        <h2 class="dropdown-wrapper__title">Notifikasi
                            @if ($notifikasi)
                                <span class="badge-circle badge-warning ms-1">{{ count($notifikasi) }}</span>
                            @endif
                        </h2>
                        <ul>
                            @forelse ($notifikasi as $satu)
                                <li class="nav-notification__single nav-notification__single--unread d-flex flex-wrap">
                                    <div class="nav-notification__type nav-notification__type--{{ $satu['warna'] }}">
                                        <i class="uil {{ $satu['ikon'] }} fs-15" aria-hidden="true"></i>
                                    </div>
                                    <div class="nav-notification__details">
                                        <p>
                                            <a href="{{ $satu['tautan'] }}" class="subject stretched-link">{{ $satu['judul'] }}</a>
                                        </p>
                                        <p>
                                            <span class="time-posted">{{ $satu['isi'] }}</span>
                                        </p>
                                    </div>
                                </li>
                            @empty
                                <li class="nav-notification__single d-flex flex-wrap">
                                    <div class="nav-notification__type nav-notification__type--success">
                                        <i class="uil uil-check fs-15" aria-hidden="true"></i>
                                    </div>
                                    <div class="nav-notification__details">
                                        <p><span class="subject">Tidak ada yang perlu ditindaklanjuti</span></p>
                                        <p><span class="time-posted">Semua data {{ $periodeTerpilih?->nama ?? 'periode ini' }} sudah lengkap.</span></p>
                                    </div>
                                </li>
                            @endforelse
                        </ul>
                    </div>
                </div>
            </li>
            <li><span class="fs-14 color-gray">{{ now()->translatedFormat('l, j F Y') }}</span></li>
        </ul>
    </div>
</nav>
