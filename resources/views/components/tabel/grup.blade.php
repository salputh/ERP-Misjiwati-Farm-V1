@props(['kolom', 'judul', 'keterangan' => null])

{{-- Baris judul kelompok di dalam tabel template (mis. nama kandang atau hari), berlatar primary transparan seperti tag template.
     Latar dipasang pada isi sel karena Bootstrap mewarnai ulang setiap sel tabel. --}}
<tr {{ $attributes }}>
    <td colspan="{{ $kolom }}" class="p-0">
        <div class="bg-primary-subtle px-3 py-2 fw-medium text-primary">
            {{ $judul }}
            @if ($keterangan)
                <span class="ms-2 fw-normal text-body-secondary">{{ $keterangan }}</span>
            @endif
        </div>
    </td>
</tr>
