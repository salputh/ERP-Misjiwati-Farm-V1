@props(['periode', 'masterData'])

{{-- Kesiapan master data periode (HexaDash: List), tiap butir menuju halaman pengelolanya. --}}
<x-kartu judul="Master data dan kesiapan periode" subjudul="Acuan sebelum pencatatan transaksi dan perhitungan keuangan.">
    <div class="list-box">
        <ul>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('modul', ['grup' => 'master', 'slug' => 'standar-strain']) }}">Standar strain</a>
                <span class="text-end">{{ count($masterData['standar']) }} standar tersedia · ABW, DG, pakan per umur</span>
            </li>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('master-data') }}">Jenis pakan</a>
                <span class="text-end">{{ $masterData['pakan']->count() }} jenis · harga/kg dan berat/zak</span>
            </li>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('master-data', ['periode' => $periode->id]) }}">Harga kontrak</a>
                <span class="text-end">{{ $masterData['harga']->count() }} bracket berat untuk periode ini</span>
            </li>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('karyawan') }}">Karyawan dan controller kandang</a>
                <span class="text-end">{{ $masterData['karyawan']->count() }} karyawan · ditugaskan per kandang</span>
            </li>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('master-data') }}">Pemodal</a>
                <span class="text-end">{{ $masterData['pemodal']->count() }} pemodal terdaftar</span>
            </li>
            <li class="list-box__item d-flex justify-content-between gap-3">
                <a href="{{ route('master-data') }}">Tarif periode</a>
                <span class="text-end">Gaji/kg, premi, bonus, dan zakat</span>
            </li>
        </ul>
    </div>
</x-kartu>
