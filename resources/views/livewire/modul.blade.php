<div class="container-fluid">
    <div class="row">
        <x-breadcrumb :judul="$item['label']" :jejak="[$kelompok['label'], $item['label']]" />

        <x-kosong judul="Modul ini belum dibuat">
            @if ($item['isi'])
                Menurut model data, isinya: {{ $item['isi'] }}.
            @else
                Isi halaman ini belum ditentukan.
            @endif
            @if ($kelompok['fase'])
                Dijadwalkan di {{ $kelompok['fase'] }}.
            @endif

            <x-slot:aksi>
                <a href="{{ route('dashboard') }}" class="btn btn-primary btn-sm btn-squared">Kembali ke ringkasan</a>
            </x-slot:aksi>
        </x-kosong>
    </div>
</div>
