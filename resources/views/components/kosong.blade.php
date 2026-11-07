@props(['judul', 'aksi' => null])

{{-- Keadaan kosong Basalt (basalt-empty) di dalam kartu selebar halaman.
     Slot berisi penjelasan; slot "aksi" berisi tombol bila ada langkah berikutnya. --}}
<div {{ $attributes->class(['col-12 mb-4']) }}>
    <section class="card basalt-box db-card">
<div class="db-card-body">
            <div class="basalt-empty">
                <span aria-hidden="true" class="basalt-empty-icon"><i class="bi bi-inbox"></i></span>
                <p class="basalt-empty-title">{{ $judul }}</p>
                <p class="basalt-empty-text">{{ $slot }}</p>
                @isset($aksi)
                    <div class="mt-3">{{ $aksi }}</div>
                @endisset
            </div>
        
</div>
</section>
</div>
