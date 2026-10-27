@props(['anggota', 'batas' => 8])

{{-- Deret avatar anggota project (HexaDash: user-group-people__parent, rounded-circle wh-34 bg-opacity-secondary).
     Karyawan belum punya foto, jadi avatar berisi inisial; sisa anggota di atas batas diringkas jadi "+n". --}}
<ul {{ $attributes->class(['d-flex flex-wrap user-group-people__parent']) }}>
    @foreach ($anggota->take($batas) as $orang)
        <li wire:key="avatar-{{ $orang->pivot?->project_id }}-{{ $orang->id }}">
            <span class="rounded-circle wh-34 bg-opacity-secondary color-secondary fs-12 fw-500 content-center" title="{{ $orang->nama }}" aria-label="{{ $orang->nama }}">{{ $orang->inisial() }}</span>
        </li>
    @endforeach
    @if ($anggota->count() > $batas)
        <li><span class="rounded-circle wh-34 bg-normal color-gray fs-12 fw-500 content-center" aria-label="{{ $anggota->count() - $batas }} anggota lainnya">+{{ $anggota->count() - $batas }}</span></li>
    @endif
</ul>
