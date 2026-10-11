@props(['judul', 'lebar' => 'col-lg-6'])

{{-- Kartu rincian RHPP: tabel label, angka, satuan. Slot berisi <x-rhpp.baris>; slot catatan tampil di bawah tabel. --}}
<div class="{{ $lebar }} mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>{{ $judul }}</h6>
            @isset($ekstra)
                <div class="card-extra">{{ $ekstra }}</div>
            @endisset
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis mb-0">
                    <tbody>
                        {{ $slot }}
                    </tbody>
                </table>
            </div>
            @isset($catatan)
                <p class="fs-12 color-gray mt-15 mb-0">{{ $catatan }}</p>
            @endisset
        </div>
    </div>
</div>
