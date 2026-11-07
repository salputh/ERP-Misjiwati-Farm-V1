{{-- Pilihan farm dan periode (periode berjalan jadi bawaan). Dipakai di top bar (desktop) dan sidebar (ponsel). --}}
@if ($farm)
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
@endif
@if ($periodeTerpilih)
    <x-pilih class="header-periode" :label="$periodeTerpilih->nama" nama="Pilih periode" ukuran="sm">
        @foreach ($daftarPeriode as $pilihan)
            <a
                href="{{ request()->fullUrlWithQuery(['periode' => $pilihan->id]) }}"
                @class(['dropdown-item', 'active' => $pilihan->is($periodeTerpilih)])
                @if ($pilihan->is($periodeTerpilih)) aria-current="true" @endif>
                {{ $pilihan->nama }} · {{ $pilihan->labelStatus() }}
            </a>
        @endforeach
    </x-pilih>
@endif
