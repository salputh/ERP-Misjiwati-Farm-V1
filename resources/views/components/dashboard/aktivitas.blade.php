@props(['daftar'])

{{-- Aktivitas terbaru: daftar Basalt (list-group) dengan titik warna menurut jenis aksi. --}}
<div class="col-lg-12 mb-4">
    <section class="card basalt-box db-card aktivitas-terbaru h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Aktivitas terbaru</h2></div>
            <a class="small fw-medium" href="{{ route('aktivitas') }}">Lihat semua</a>
</header>
            @if ($daftar->isNotEmpty())
                <ul class="list-group list-group-flush">
                    @foreach ($daftar as $aktivitas)
                        <li class="list-group-item d-flex flex-wrap align-items-center gap-3" wire:key="aktivitas-{{ $aktivitas->id }}">
                            <span class="rounded-circle d-inline-block flex-shrink-0 lingkar-titik bg-{{ $aktivitas->jenis->warna() }}" aria-hidden="true"></span>
                            <span class="flex-grow-1">{{ $aktivitas->kalimat() }} <small class="text-body-secondary">{{ $aktivitas->konteks() }}</small></span>
                            <small class="text-body-secondary" title="{{ $aktivitas->created_at->translatedFormat('j F Y, H:i') }}">{{ $aktivitas->created_at->diffForHumans() }}</small>
                        </li>
                    @endforeach
                </ul>
            @else
                <p class="text-body-secondary m-3">Belum ada aktivitas. Data yang ditambah, diubah, atau dihapus akan muncul di sini.</p>
            @endif
        
</div>
</section>
</div>
