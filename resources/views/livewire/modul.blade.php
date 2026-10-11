<div class="container-fluid">
    <div class="row">
        <x-breadcrumb :judul="$item['label']" :jejak="[$kelompok['label'], $item['label']]" />

        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <h5 class="mb-10">Modul ini belum dibuat</h5>
                    <p class="color-gray mb-20">
                        @if ($item['isi'])
                            Menurut model data, isinya: {{ $item['isi'] }}.
                        @else
                            Isi halaman ini belum ditentukan.
                        @endif
                        @if ($kelompok['fase'])
                            Dijadwalkan di {{ $kelompok['fase'] }}.
                        @endif
                    </p>
                    <a href="{{ route('dashboard') }}" class="btn btn-primary btn-default btn-squared">Kembali ke ringkasan</a>
                </div>
            </div>
        </div>
    </div>
</div>
