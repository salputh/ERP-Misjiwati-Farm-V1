@props(['daftar', 'terpilih', 'farm'])

{{-- Daftar periode farm (HexaDash: List). Butir terpilih berlatar primary transparan. --}}
<x-kartu judul="Daftar periode" :subjudul="$farm?->nama.' · '.$daftar->count().' periode'" class="mb-25">
    @if ($daftar->isNotEmpty())
        <div class="list-box">
            <ul>
                @foreach ($daftar as $periode)
                    <li wire:key="periode-{{ $periode->id }}" @class(['list-box__item p-0', 'order-bg-opacity-primary' => $periode->is($terpilih)])>
                        <button
                            type="button"
                            class="w-100 text-start border-0 bg-transparent px-20 py-15"
                            wire:click="pilihPeriode({{ $periode->id }})"
                            wire:loading.attr="disabled"
                            wire:target="pilihPeriode"
                            @if ($periode->is($terpilih)) aria-current="true" @endif
                        >
                            <span class="d-flex align-items-center justify-content-between gap-2">
                                <span @class(['fw-500', 'color-primary' => $periode->is($terpilih), 'color-dark' => ! $periode->is($terpilih)])>{{ $periode->nama }}</span>
                                <span @class(['dm-tag tag-transparented m-0', 'tag-success' => $periode->berjalan(), 'tag-info' => ! $periode->berjalan()])>{{ $periode->labelStatus() }}</span>
                            </span>
                            <span class="d-block fs-13 color-light mt-1">Siklus {{ $periode->nomor_siklus ?? '-' }} · {{ $periode->kandang_periode_count }} kandang</span>
                            <span class="d-block fs-13 color-light">
                                DOC chick-in @angka($periode->docChickInTerjumlah()) ekor
                                @if ($periode->is($terpilih))
                                    · sedang dikerjakan
                                @endif
                            </span>
                        </button>
                    </li>
                @endforeach
            </ul>
        </div>
    @else
        <p class="color-light text-center mb-0">Belum ada periode.</p>
    @endif
</x-kartu>
