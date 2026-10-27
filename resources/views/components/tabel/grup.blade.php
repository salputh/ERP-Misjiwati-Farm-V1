@props(['kolom', 'judul', 'keterangan' => null])

{{-- Baris judul kelompok di dalam tabel template (mis. nama kandang atau hari), berlatar primary transparan seperti tag template.
     Latar dipasang pada isi sel karena Bootstrap mewarnai ulang setiap sel tabel. --}}
<tr {{ $attributes }}>
    <td colspan="{{ $kolom }}" class="p-0">
        <div class="order-bg-opacity-primary px-20 py-10 fs-14 fw-500 color-primary">
            {{ $judul }}
            @if ($keterangan)
                <span class="ms-2 fw-400 color-gray">{{ $keterangan }}</span>
            @endif
        </div>
    </td>
</tr>
