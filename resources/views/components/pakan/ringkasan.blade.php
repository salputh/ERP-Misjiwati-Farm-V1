@props(['ringkasan'])

@php
    use App\Support\Format;
@endphp

{{-- Empat kartu angka ringkas: apa yang masuk, terpakai, tersisa, dan berapa hari pemberian. --}}
<div class="row g-3 mb-25">
    <div class="col-6 col-xl-3">
        <div class="pakan-angka">
            <span class="pakan-angka__label">Pakan masuk</span>
            <strong class="pakan-angka__nilai">{{ Format::ringkasKurung($ringkasan['masuk']) }} <small>zak</small></strong>
            <span class="pakan-angka__keterangan">{{ Format::ringkasKurung($ringkasan['masuk_kg']) }} kg</span>
        </div>
    </div>
    <div class="col-6 col-xl-3">
        <div class="pakan-angka">
            <span class="pakan-angka__label">Terpakai</span>
            <strong class="pakan-angka__nilai">{{ Format::ringkasKurung($ringkasan['terpakai']) }} <small>zak</small></strong>
            <span class="pakan-angka__keterangan">{{ Format::ringkasKurung($ringkasan['terpakai_kg']) }} kg</span>
        </div>
    </div>
    <div class="col-6 col-xl-3">
        <div @class(['pakan-angka', 'pakan-angka--sisa', 'pakan-angka--minus' => $ringkasan['sisa'] !== null && $ringkasan['sisa'] < 0])>
            <span class="pakan-angka__label">Sisa di gudang</span>
            <strong class="pakan-angka__nilai">
                @isset($ringkasan['sisa'])
                    {{ Format::ringkasKurung($ringkasan['sisa']) }} <small>zak</small>
                @else
                    - <small>belum bisa dihitung</small>
                @endisset
            </strong>
            <span class="pakan-angka__keterangan">
                @isset($ringkasan['sisa_kg'])
                    {{ Format::ringkasKurung($ringkasan['sisa_kg']) }} kg
                @else
                    jenis pakannya belum dicatat
                @endisset
            </span>
        </div>
    </div>
    <div class="col-6 col-xl-3">
        <div class="pakan-angka">
            <span class="pakan-angka__label">Pemberian</span>
            <strong class="pakan-angka__nilai">{{ Format::ringkasKurung($ringkasan['hari']) }} <small>hari</small></strong>
            <span class="pakan-angka__keterangan">{{ Format::ringkasKurung($ringkasan['catatan']) }} catatan pemberian</span>
        </div>
    </div>
</div>
