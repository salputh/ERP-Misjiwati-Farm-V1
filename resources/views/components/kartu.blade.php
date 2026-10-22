@props([
    'judul' => null,
    'subjudul' => null,
    'ukuran' => 'md', // sm, md, lg
    'bergaris' => false,
    'bg' => 'white', // white, transparent, normal
    'tanpaHeader' => false,
    'ekstra' => null,
])

@php
    $classes = ['card', 'card-default'];
    $classes[] = 'card-' . $ukuran;
    
    if ($bg !== 'white') {
        $classes[] = 'bg-' . $bg;
    }
    
    if ($bergaris) {
        $classes[] = 'card-bordered';
    }
@endphp

<div {{ $attributes->merge(['class' => implode(' ', $classes)]) }}>
    @if (!$tanpaHeader && ($judul || $subjudul || $ekstra))
        <div class="card-header">
            <div>
                @if ($judul)
                    <h6>{{ $judul }}</h6>
                @endif
                @if ($subjudul)
                    <span class="fs-12 color-gray">{{ $subjudul }}</span>
                @endif
            </div>
            @if ($ekstra)
                <div class="card-extra">
                    {{ $ekstra }}
                </div>
            @endif
        </div>
    @endif

    <div class="card-body">
        {{ $slot }}
    </div>
</div>
