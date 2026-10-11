@extends('template.layout.app')
@section('title', 'Katalog')
@section('content')
<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Katalog template" :jejak="['Katalog template']" />

        <div class="col-lg-12 mb-25">
            <div class="card border-0">
                <div class="card-body p-30">
                    <p class="color-gray mb-0">
                        Halaman contoh HexaDash untuk ditiru saat membuat fitur. Sumbernya ada di <code>resources/views/template/pages</code>,
                        widget dashboard di <code>resources/views/template/components</code>. Katalog ini hanya muncul di lingkungan pengembangan.
                    </p>
                </div>
            </div>
        </div>

        @foreach ($kelompok as $nama => $daftar)
            <div class="col-xxl-3 col-lg-4 col-sm-6 mb-25">
                <div class="card border-0 h-100">
                    <div class="card-header border-0">
                        <h6>{{ Str::headline($nama) }}</h6>
                    </div>
                    <div class="card-body pt-0">
                        <ul class="mb-0">
                            @foreach ($daftar as $halaman)
                                <li class="mb-2">
                                    <a href="{{ route('template.halaman', $halaman) }}">{{ Str::headline(Str::after($halaman, '/')) }}</a>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                </div>
            </div>
        @endforeach
    </div>
</div>
@endsection
