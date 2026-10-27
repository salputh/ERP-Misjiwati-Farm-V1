@props(['kandang', 'sesi' => null, 'ekor' => [], 'hasil' => [], 'pakan' => [], 'lembar' => null])

{{-- Modal hasil satu sesi riwayat: sampel tersimpan dan ringkasannya, hanya untuk dibaca. Dibuka ikon Lihat di riwayat atau ringkasan.
     Tombol di kaki menggambar ulang hasil dari data-lembar menjadi PNG (Alpine eksporSampling). --}}
<div class="modal-basic modal fade" id="modal-riwayat-sampling" tabindex="-1" aria-labelledby="judul-riwayat-sampling" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered" role="document">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <h6 class="modal-title" id="judul-riwayat-sampling">Hasil sampling {{ $kandang }}</h6>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <img src="{{ asset('assets/img/svg/x.svg') }}" alt="x" class="svg">
                </button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="buka, lihatTerakhir" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat hasil sampling</span>
                </div>

                <div wire:loading.remove wire:target="buka, lihatTerakhir">
                    @if ($sesi)
                        <x-info class="mb-25">
                            <x-info.butir label="Tanggal">{{ $sesi->tanggal->translatedFormat('j F Y') }}</x-info.butir>
                            <x-info.butir label="Usia">{{ $sesi->umur }} hari</x-info.butir>
                            <x-info.butir label="Jenis sampling">{{ $sesi->dengan_sexing ? 'Dengan sexing' : 'Tanpa sexing' }}</x-info.butir>
                            @foreach ($hasil['kelamin'] as $kelamin)
                                <x-info.butir :label="'Ekor per sampel'.($kelamin === 'campuran' ? '' : ' '.$kelamin)">{{ $ekor[$kelamin] }}</x-info.butir>
                            @endforeach
                        </x-info>

                        <div class="row g-4 mb-25">
                            @foreach (config('sampling.lantai') as $lantai => $info)
                                <div class="col-12" wire:key="riwayat-lantai-{{ $sesi->id }}-{{ $lantai }}">
                                    <div class="card card-default card-sm bg-transparent card-bordered">
                                    <div class="card-header"><h6>{{ $info['label'] }}</h6></div>
                                    <div class="card-body">
                                    <div class="row g-4">
                                        @foreach ($hasil['kelamin'] as $kelamin)
                                            <div class="col-12">
                                                @if ($sesi->dengan_sexing)
                                                    <x-sampling.kelamin :kelamin="$kelamin" />
                                                @endif
                                                <div class="table-responsive">
                                                    <x-sampling.tabel :lantai="$lantai" :kelamin="$kelamin" :kelompok="$hasil['lantai'][$lantai][$kelamin]" baca-saja />
                                                </div>
                                            </div>
                                        @endforeach
                                    </div>
                                    </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>

                        <div class="card card-default card-sm bg-transparent card-bordered">
                            <div class="card-header"><h6>Ringkasan hasil</h6></div>
                            <div class="card-body">
                                <x-sampling.ringkasan :hasil="$hasil" :pakan="$pakan" :dengan-sexing="$sesi->dengan_sexing" :umur="$sesi->umur" />
                            </div>
                        </div>
                    @endif
                </div>
            </div>

            <div class="modal-footer" x-data="eksporSampling" data-lembar="{{ json_encode($lembar) }}">
                <x-tombol.batal>Tutup</x-tombol.batal>
                @if ($sesi)
                    <x-tombol warna="light" variasi="outlined" ikon="uil-image-download" x-on:click="simpan" wire:loading.attr="disabled" wire:target="buka">Simpan PNG</x-tombol>
                    <x-tombol ikon="uil-copy" x-on:click="salin" wire:loading.attr="disabled" wire:target="buka"><b class="fw-600" x-text="labelSalin" aria-live="polite">Salin PNG</b></x-tombol>
                @endif
            </div>
        </div>
    </div>
</div>
