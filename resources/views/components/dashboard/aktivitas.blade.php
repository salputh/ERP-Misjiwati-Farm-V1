@props(['daftar'])

{{-- Aktivitas terbaru (HexaDash demo five: timeline). Warna titik mengikuti jenis aksi. --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 card-timeline aktivitas-terbaru h-100">
        <div class="card-header border-0">
            <h6>Aktivitas terbaru</h6>
            <div class="card-extra tanpa-kapital">
                <a class="color-primary fs-13 fw-500" href="{{ route('aktivitas') }}">Lihat semua</a>
            </div>
        </div>
        <div class="card-body pb-15 pt-0">
            @if ($daftar->isNotEmpty())
                <div class="card-timeline-body">
                    <ul>
                        @foreach ($daftar as $aktivitas)
                            <li wire:key="aktivitas-{{ $aktivitas->id }}">
                                <div class="card-timeline-body__left">
                                    <div class="card-timeline-body__title">
                                        <span class="timeline-line"></span>
                                        <span class="badge-dot badge-dot--big dot-{{ $aktivitas->jenis->warna() }}"></span>
                                        <p>{{ $aktivitas->kalimat() }}<span>{{ $aktivitas->konteks() }}</span></p>
                                    </div>
                                </div>
                                <div class="card-timeline-body__right">
                                    <div class="card-timeline-body__time">
                                        <span title="{{ $aktivitas->created_at->translatedFormat('j F Y, H:i') }}">{{ $aktivitas->created_at->diffForHumans() }}</span>
                                    </div>
                                </div>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @else
                <p class="color-gray mt-15 mb-10">Belum ada aktivitas. Data yang ditambah, diubah, atau dihapus akan muncul di sini.</p>
            @endif
        </div>
    </div>
</div>
