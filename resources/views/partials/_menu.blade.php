<div class="sidebar__menu-group">
    <ul class="sidebar_nav">
        <li>
            <a href="{{ route('dashboard', ['farm' => $farm?->id, 'periode' => $periode?->id]) }}" @class(['active' => request()->routeIs('dashboard')])>
                <span class="nav-icon uil uil-create-dashboard"></span>
                <span class="menu-text">Ringkasan</span>
            </a>
        </li>
        <li>
            <a href="{{ route('aktivitas', ['farm' => $farm?->id, 'periode' => $periode?->id]) }}" @class(['active' => request()->routeIs('aktivitas')])>
                <span class="nav-icon uil uil-history"></span>
                <span class="menu-text">Aktivitas</span>
            </a>
        </li>

        @foreach (config('navigasi') as $kunciGrup => $grup)
            <li class="menu-title menu-title--garis mt-30">
                <span>{{ $grup['label'] }}</span>
            </li>
            @foreach ($grup['item'] as $slug => $item)
                @isset($item['per_kandang'])
                    {{-- Dropdown template (has-child): satu tautan per kandang --}}
                    <li @class(['has-child', 'open' => request()->is($kunciGrup.'/'.$slug.'/*')])>
                        <a href="#" @class(['active' => request()->is($kunciGrup.'/'.$slug.'/*')])>
                            <span class="nav-icon uil {{ $item['ikon'] }}"></span>
                            <span class="menu-text">{{ $item['label'] }}</span>
                            <span class="toggle-icon"></span>
                        </a>
                        <ul>
                            @foreach ($kandangMenu as $kandang)
                                <li @class(['active' => request()->is($kunciGrup.'/'.$slug.'/'.$kandang->id)])>
                                    <a href="{{ route($item['per_kandang'], ['kandang' => $kandang, 'farm' => $farm?->id, 'periode' => $periode?->id]) }}">{{ $kandang->nama }}</a>
                                </li>
                            @endforeach
                        </ul>
                    </li>
                @else
                    <li>
                        <a href="{{ isset($item['rute']) ? route($item['rute'], ['farm' => $farm?->id, 'periode' => $periode?->id]) : route('modul', ['grup' => $kunciGrup, 'slug' => $slug, 'farm' => $farm?->id, 'periode' => $periode?->id]) }}" @class(['active' => isset($item['rute']) ? request()->routeIs($item['rute']) : request()->is($kunciGrup.'/'.$slug, $kunciGrup.'/'.$slug.'/*')])>
                            <span class="nav-icon uil {{ $item['ikon'] }}"></span>
                            <span class="menu-text">{{ $item['label'] }}</span>
                        </a>
                    </li>
                @endisset
            @endforeach
        @endforeach

        @if (Route::has('template.index'))
            <li class="menu-title menu-title--garis mt-30">
                <span>Pengembangan</span>
            </li>
            <li>
                <a href="{{ route('template.index') }}" @class(['active' => request()->routeIs('template.*')])>
                    <span class="nav-icon uil uil-apps"></span>
                    <span class="menu-text">Katalog template</span>
                </a>
            </li>
        @endif
    </ul>
</div>
