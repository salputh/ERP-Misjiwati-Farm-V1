@props(['periode'])

{{-- Kandang pada periode: tiap kandang satu kartu bergaris di dalam kartu ,
     berisi identitas kandang dan jumlah catatan tiap modul . --}}
<x-kartu judul="Kandang pada periode" subjudul="Populasi awal tidak boleh melebihi kapasitas kandang." class="mb-4" id="daftar-kandang">
    @unless ($periode->tertutup())
        <x-slot:ekstra>
            <x-tombol wire:click="tambahKandang" data-bs-toggle="modal" data-bs-target="#modal-kandang-periode" wire:loading.attr="disabled" wire:target="tambahKandang, simpanKandang">Tambah kandang</x-tombol>
        </x-slot:ekstra>
    @endunless

    @forelse ($periode->kandangPeriode->sortBy('kandang.nama') as $periodeKandang)
        <section class="card basalt-box db-card bg-transparent mb-4" wire:key="periode-kandang-{{ $periodeKandang->id }}">
<div class="db-card-body">
            <header class="db-card-head">
<div><h2 class="db-card-title">{{ $periodeKandang->kandang->nama }}</h2></div>
                <div class="d-flex flex-wrap align-items-center gap-2 d-flex align-items-center flex-wrap gap-2">
                    @if ($periodeKandang->bagiHasil?->terkunci())
                        <x-tombol ukuran="xs" variasi="outlined" wire:click="bukaModalBukaKunciBagiHasil({{ $periodeKandang->id }})" data-bs-toggle="modal" data-bs-target="#modal-buka-kunci-bagi-hasil" wire:loading.attr="disabled" wire:target="bukaModalBukaKunciBagiHasil, bukaKunciBagiHasil">Buka kunci bagi hasil</x-tombol>
                    @endif
                    @unless ($periode->tertutup())
                        <x-aksi.ikon :aksi="[
                            ['kelas' => 'edit', 'label' => 'Ubah kandang '.$periodeKandang->kandang->nama.' di periode ini', 'click' => 'ubahKandang('.$periodeKandang->id.')', 'modal' => '#modal-kandang-periode'],
                            ['kelas' => 'remove', 'label' => 'Lepas kandang '.$periodeKandang->kandang->nama.' dari periode ini', 'click' => 'mintaHapusKandang('.$periodeKandang->id.')', 'modal' => '#konfirmasi-hapus-kandang-periode'],
                        ]" />
                    @endunless
                </div>
</header>
            <div>
                <div class="row">
                    <div class="col-xl-6 mb-3 mb-xl-0">
                        <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <span>Populasi</span>
                                    <span class="fw-medium text-body text-end">
                                        @angka($periodeKandang->populasi_awal)
                                        @if ($periodeKandang->bonus_doc_ekor)
                                            + bonus DOC @angka($periodeKandang->bonus_doc_ekor)
                                        @endif
                                        = @angka($periodeKandang->populasiAktual()) / kapasitas @angka($periodeKandang->kandang->kapasitas) ekor
                                    </span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <span>Chick-in</span>
                                    <span class="fw-medium text-body text-end">{{ $periodeKandang->tanggalChickInEfektif()->translatedFormat('j M Y') }} · DOC {{ $periodeKandang->beratDocGramEfektif() }} gram</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <span>Harga DOC</span>
                                    <span class="fw-medium text-body text-end">
                                        @isset($periodeKandang->harga_doc_per_ekor)
                                            Rp @angka($periodeKandang->harga_doc_per_ekor)/ekor
                                        @else
                                            belum dicatat
                                        @endisset
                                    </span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <span>Controller</span>
                                    <span class="fw-medium text-body text-end">
                                        {{ $periodeKandang->bagiHasil?->controller ?: 'belum ditetapkan' }}
                                        @if ($periodeKandang->bagiHasil?->terkunci())
                                            · <span class="text-warning">lembar bagi hasil terkunci</span>
                                        @endif
                                    </span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <span>Karyawan</span>
                                    <span class="fw-medium text-body text-end">
                                        {{ $periodeKandang->kandang->daftarKaryawanTeks() ?: 'belum ditetapkan' }}
                                        <a href="{{ route('karyawan') }}" class="d-block fw-normal">Kelola karyawan</a>
                                    </span>
                                </li>
                            </ul>
                    </div>
                    <div class="col-xl-6">
                        <ul class="list-group list-group-flush">
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('recording.harian', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">Recording harian</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->recordings->count() }} hari</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('pakan.log', ['periode' => $periode->id]) }}">Pakan dan stok</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->pemberianPakan->count() }} pemberian</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('sampling.bobot', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">Sampling bobot</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->sesiSampling->count() }} sesi</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('panen.rekap', ['periode' => $periode->id]) }}">Panen</a>
                                    <span class="fw-medium text-body">{{ $periode->notaPanen->count() }} nota</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('kas.operasional', ['kandang' => $periodeKandang->kandang_id, 'periode' => $periode->id]) }}">Kas operasional</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->transaksiKas->count() }} transaksi</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('bagi.hasil', ['kandang' => $periodeKandang->kandang_id, 'periode' => $periode->id]) }}">Bagi hasil</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->bagiHasil ? 'sudah diatur' : 'belum diatur' }}</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between gap-3">
                                    <a href="{{ route('payroll.abk', ['periode' => $periode->id, 'kandang' => $periodeKandang->id]) }}">Payroll ABK</a>
                                    <span class="fw-medium text-body">{{ $periodeKandang->slipGaji->count() }} slip</span>
                                </li>
                            </ul>
                    </div>
                </div>
            </div>
        </div>
</section>
    @empty
        <p class="text-body-secondary text-center mb-4">Belum ada kandang untuk periode ini. Tambahkan kandang agar pencatatan produksi dan keuangan bisa dimulai.</p>
    @endforelse

    @if ($periode->kandangPeriode->isNotEmpty())
        <ul class="list-group list-group-flush">
                <li class="list-group-item d-flex justify-content-between gap-3 bg-primary-subtle">
                    <span class="text-body">Total DOC chick-in periode ini</span>
                    <span class="fw-semibold text-primary">@angka($periode->totalDocChickIn()) ekor</span>
                </li>
            </ul>
    @endif
</x-kartu>
