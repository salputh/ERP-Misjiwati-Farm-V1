@props(['judul', 'lebar' => 'col-lg-6'])

{{-- Kartu rincian RHPP: tabel label, angka, satuan. Slot berisi <x-rhpp.baris>; slot catatan tampil di bawah tabel. --}}
<div class="{{ $lebar }} mb-25">
    <div class="card card-default card-md h-100">
        <div class="card-header">
            <h6>{{ $judul }}</h6>
            @isset($ekstra)
                <div class="card-extra">{{ $ekstra }}</div>
            @endisset
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan mb-0">
                    <tbody>
                        {{ $slot }}
                    </tbody>
                </table>
            </div>
            @isset($catatan)
                <p class="fs-13 color-light mt-15 mb-0">{{ $catatan }}</p>
            @endisset
        </div>
    </div>
</div>
