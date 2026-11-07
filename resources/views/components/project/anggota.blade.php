@props(['anggota', 'batas' => 8])

{{-- Deret avatar anggota project 
     Karyawan belum punya foto, jadi avatar berisi inisial; sisa anggota di atas batas diringkas jadi "+n". --}}
<ul {{ $attributes->class(['d-flex flex-wrap list-unstyled gap-1 p-0']) }}>
    @foreach ($anggota->take($batas) as $orang)
        <li wire:key="avatar-{{ $orang->pivot?->project_id }}-{{ $orang->id }}">
            <span class="rounded-circle lingkar-34 bg-secondary-subtle text-secondary small fw-medium d-flex align-items-center justify-content-center" title="{{ $orang->nama }}" aria-label="{{ $orang->nama }}">{{ $orang->inisial() }}</span>
        </li>
    @endforeach
    @if ($anggota->count() > $batas)
        <li><span class="rounded-circle lingkar-34 bg-body-secondary text-body-secondary small fw-medium d-flex align-items-center justify-content-center" aria-label="{{ $anggota->count() - $batas }} anggota lainnya">+{{ $anggota->count() - $batas }}</span></li>
    @endif
</ul>
