@props([
    'judul' => null,
    'subjudul' => null,
    'ekstra' => null,
    'badan' => null,
])

{{-- Kartu Basalt: kerangka kartu dashboard (card basalt-box db-card). Kepala berisi judul (db-card-title) dan keterangan
     (db-card-desc); aksi di kanan lewat slot "ekstra". "badan" menambah kelas pada db-card-body; "p-0" berarti tabel
     menempel ke tepi kartu (db-card-body-table), kepala tetap diberi bantalan sisi. --}}
@php
    $tabelPenuh = str_contains((string) $badan, 'p-0');
    $kelasBadan = trim(str_replace('p-0', '', (string) $badan));
@endphp
<section {{ $attributes->class(['card basalt-box db-card mb-4']) }}>
    <div @class(['db-card-body', 'db-card-body-table' => $tabelPenuh, $kelasBadan])>
        @if ($judul || $ekstra)
            <header class="db-card-head">
                <div>
                    @if ($judul)
                        <h2 class="db-card-title">{{ $judul }}</h2>
                    @endif
                    @if ($subjudul)
                        <p class="db-card-desc">{{ $subjudul }}</p>
                    @endif
                </div>
                @if ($ekstra)
                    <div {{ $ekstra->attributes->class(['d-flex flex-wrap align-items-center gap-2']) }}>
                        {{ $ekstra }}
                    </div>
                @endif
            </header>
        @endif

        {{ $slot }}
    </div>
</section>
