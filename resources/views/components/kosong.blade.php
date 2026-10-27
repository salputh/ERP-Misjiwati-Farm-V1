@props(['judul', 'aksi' => null])

{{-- Keadaan kosong bergaya katalog template (HexaDash: Empty, Customize) di dalam kartu selebar halaman.
     Slot berisi penjelasan; slot "aksi" berisi tombol bila ada langkah berikutnya. --}}
<div {{ $attributes->class(['col-12 mb-25']) }}>
    <div class="card card-default card-md">
        <div class="card-body">
            <div class="dm-empty text-center">
                <div class="dm-empty__image">
                    <img src="{{ asset('assets/img/svg/1.png') }}" alt="">
                </div>
                <div class="dm-empty__text">
                    <h6 class="mb-10">{{ $judul }}</h6>
                    <p class="color-gray mx-auto mb-0">{{ $slot }}</p>
                    @isset($aksi)
                        <div class="dm-empty__action">{{ $aksi }}</div>
                    @endisset
                </div>
            </div>
        </div>
    </div>
</div>
