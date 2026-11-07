@props(['judul', 'lebar' => 'col-lg-6'])

{{-- Kartu rincian RHPP: tabel label, angka, satuan. Slot berisi <x-rhpp.baris>; slot catatan tampil di bawah tabel. --}}
<div class="{{ $lebar }} mb-4">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">{{ $judul }}</h2></div>
            @isset($ekstra)
                <div class="d-flex flex-wrap align-items-center gap-2">{{ $ekstra }}</div>
            @endisset
</header>
            <div class="tabel-data table-responsive">
                <table class="table tabel-laporan mb-0 db-table">
                    <tbody>
                        {{ $slot }}
                    </tbody>
                </table>
            </div>
            @isset($catatan)
                <p class="small text-body-secondary mt-3 mb-0">{{ $catatan }}</p>
            @endisset
        
</div>
</section>
</div>
