@props(['ringkasan'])

{{-- Empat kartu ringkasan: pakan masuk, terpakai, sisa di gudang, dan hari pemberian. --}}
<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::ringkasKurung($ringkasan['masuk']).' zak'" label="Pakan masuk" ikon="bi-box-arrow-in-down" warna="primary">
    <small>{{ \App\Support\Format::ringkasKurung($ringkasan['masuk_kg']) }} kg</small>
</x-dashboard.kartu>
<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::ringkasKurung($ringkasan['terpakai']).' zak'" label="Terpakai" ikon="bi-box-arrow-up" warna="info">
    <small>{{ \App\Support\Format::ringkasKurung($ringkasan['terpakai_kg']) }} kg</small>
</x-dashboard.kartu>
<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="isset($ringkasan['sisa']) ? \App\Support\Format::ringkasKurung($ringkasan['sisa']).' zak' : '-'" label="Sisa di gudang" ikon="bi-box-seam" :warna="($ringkasan['sisa'] ?? 0) < 0 ? 'danger' : 'success'">
    @isset($ringkasan['sisa_kg'])
        <small>{{ \App\Support\Format::ringkasKurung($ringkasan['sisa_kg']) }} kg</small>
    @else
        <small>Belum bisa dihitung: jenis pakannya belum dicatat</small>
    @endisset
</x-dashboard.kartu>
<x-dashboard.kartu lebar="col-xxl-3 col-sm-6" :nilai="\App\Support\Format::ringkasKurung($ringkasan['hari']).' hari'" label="Pemberian" ikon="bi-calendar3" warna="warning">
    <small>{{ \App\Support\Format::ringkasKurung($ringkasan['catatan']) }} catatan pemberian</small>
</x-dashboard.kartu>
