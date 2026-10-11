@props(['daftar', 'terpilih', 'rute', 'parameter' => []])

{{-- Pemilih periode: muat ulang halaman dengan ?periode=. Hanya tampil bila ada lebih dari satu periode.
     Parameter berisi parameter rute lain yang ikut dibawa (misalnya kandang). --}}
@if ($daftar->count() > 1)
    <x-pilih class="me-3" :label="$terpilih->nama" nama="Pilih periode">
        @foreach ($daftar as $pilihan)
            <a href="{{ route($rute, [...$parameter, 'periode' => $pilihan->id]) }}" @class(['dropdown-item', 'active' => $pilihan->is($terpilih)]) @if ($pilihan->is($terpilih)) aria-current="true" @endif>{{ $pilihan->nama }}</a>
        @endforeach
    </x-pilih>
@endif
