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
            <li><span class="fs-14 color-gray">{{ now()->translatedFormat('l, j F Y') }}</span></li>
        </ul>
    </div>
</nav>
