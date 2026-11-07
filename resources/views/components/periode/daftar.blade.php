@props(['daftar', 'terpilih', 'farm'])

{{-- Daftar periode farm . Butir terpilih berlatar primary transparan. --}}
<x-kartu judul="Daftar periode" :subjudul="$farm?->nama.' · '.$daftar->count().' periode'" class="mb-4">
    @if ($daftar->isNotEmpty())
        <ul class="list-group list-group-flush">
                @foreach ($daftar as $periode)
                    <li wire:key="periode-{{ $periode->id }}" @class(['list-group-item p-0', 'bg-primary-subtle' => $periode->is($terpilih)])>
                        <button
                            type="button"
                            class="w-100 text-start border-0 bg-transparent px-3 py-3"
                            wire:click="pilihPeriode({{ $periode->id }})"
                            wire:loading.attr="disabled"
                            wire:target="pilihPeriode"
                            @if ($periode->is($terpilih)) aria-current="true" @endif
                        >
                            <span class="d-flex align-items-center justify-content-between gap-2">
                                <span @class(['fw-medium', 'text-primary' => $periode->is($terpilih), 'text-body' => ! $periode->is($terpilih)])>{{ $periode->nama }}</span>
                                <span @class(['badge  m-0', 'bg-success-subtle text-success' => $periode->berjalan(), 'bg-info-subtle text-info' => ! $periode->berjalan()])>{{ $periode->labelStatus() }}</span>
                            </span>
                            <span class="d-block small text-body-secondary mt-1">Siklus {{ $periode->labelSiklus() }} · {{ $periode->kandang_periode_count }} kandang</span>
                            <span class="d-block small text-body-secondary">
                                DOC chick-in @angka($periode->docChickInTerjumlah()) ekor
                                @if ($periode->is($terpilih))
                                    · sedang dikerjakan
                                @endif
                            </span>
                        </button>
                    </li>
                @endforeach
            </ul>
    @else
        <p class="text-body-secondary text-center mb-0">Belum ada periode.</p>
    @endif
</x-kartu>
