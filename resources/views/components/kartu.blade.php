@props([
    'judul' => null,
    'subjudul' => null,
    'ekstra' => null,
    'badan' => null,
])

{{-- Kartu bergaya katalog template (HexaDash: card card-default card-md).
     Kepala berisi judul h6 dan subjudul seperti halaman Settings template; aksi di kanan lewat slot "ekstra".
     "badan" menambah kelas pada card-body, misalnya "p-0" untuk tabel yang menempel ke tepi kartu. --}}
<div {{ $attributes->class(['card card-default card-md']) }}>
    @if ($judul || $ekstra)
        <div class="card-header">
            <div>
                @if ($judul)
                    <h6>{{ $judul }}</h6>
                @endif
                @if ($subjudul)
                    <span class="d-block fs-13 color-light fw-400 tanpa-kapital">{{ $subjudul }}</span>
                @endif
            </div>
            @if ($ekstra)
                <div {{ $ekstra->attributes->class(['card-extra']) }}>
                    {{ $ekstra }}
                </div>
            @endif
        </div>
    @endif

    <div @class(['card-body', $badan])>
        {{ $slot }}
    </div>
</div>
