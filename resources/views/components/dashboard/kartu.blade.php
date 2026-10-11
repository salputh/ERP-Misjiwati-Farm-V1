@props(['nilai', 'label', 'ikon', 'warna' => 'primary', 'lebar' => 'col-xxl-6 col-sm-6'])

{{-- Kartu ringkasan (HexaDash demo one: overview card). Slot berisi keterangan di bawah angka. --}}
<div class="{{ $lebar }} mb-25">
    <div class="ap-po-details ap-po-details--2 p-25 radius-xl d-flex justify-content-between h-100">
        <div class="overview-content w-100 d-flex flex-column justify-content-between">
            <div class="ap-po-details-content d-flex flex-wrap justify-content-between">
                <div class="ap-po-details__titlebar">
                    <h1>{{ $nilai }}</h1>
                    <p>{{ $label }}</p>
                </div>
                <div class="ap-po-details__icon-area">
                    <div class="svg-icon order-bg-opacity-{{ $warna }} color-{{ $warna }}"><i class="uil {{ $ikon }}"></i></div>
                </div>
            </div>
            <div class="ap-po-details-time">
                {{ $slot }}
            </div>
        </div>
    </div>
</div>
