@props(['kandang', 'sesi' => null, 'ekor' => [], 'hasil' => [], 'pakan' => [], 'lembar' => null])

{{-- Modal hasil satu sesi riwayat: sampel tersimpan dan ringkasannya, hanya untuk dibaca. Dibuka tombol "Buka" di riwayat.
     Tombol di kaki menggambar ulang hasil dari data-lembar menjadi PNG (Alpine eksporSampling). --}}
<div class="modal-basic modal fade" id="modal-riwayat-sampling" tabindex="-1" aria-labelledby="judul-riwayat-sampling" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content modal-bg-white">
            <div class="modal-header">
                <h6 class="modal-title" id="judul-riwayat-sampling">Hasil sampling {{ $kandang }}</h6>
                <button type="button" class="close" data-bs-dismiss="modal" aria-label="Tutup">
                    <i class="uil uil-times"></i>
                </button>
            </div>

            <div class="modal-body">
                <div class="text-center py-4" wire:loading wire:target="buka" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat hasil sampling</span>
                </div>

                <div wire:loading.remove wire:target="buka">
                    @if ($sesi)
                        <div class="sampling-pengaturan mb-25">
                            <div>
                                <span>Tanggal</span>
                                <strong>{{ $sesi->tanggal->translatedFormat('j F Y') }}</strong>
                            </div>
                            <div>
                                <span>Usia</span>
                                <strong>{{ $sesi->umur }} hari</strong>
                            </div>
                            <div>
                                <span>Jenis sampling</span>
                                <strong>{{ $sesi->dengan_sexing ? 'Dengan sexing' : 'Tanpa sexing' }}</strong>
                            </div>
                            @foreach ($hasil['kelamin'] as $kelamin)
                                <div>
                                    <span>Ekor per sampel{{ $kelamin === 'campuran' ? '' : ' '.$kelamin }}</span>
                                    <strong>{{ $ekor[$kelamin] }}</strong>
                                </div>
                            @endforeach
                        </div>

                        <div class="row g-4 mb-25">
                            @foreach (config('sampling.lantai') as $lantai => $info)
                                <div @class(['col-lg-6' => ! $sesi->dengan_sexing, 'col-12' => $sesi->dengan_sexing]) wire:key="riwayat-lantai-{{ $sesi->id }}-{{ $lantai }}">
                                    <h6 class="mb-15">{{ $info['label'] }}</h6>
                                    <div class="row g-4">
                                        @foreach ($hasil['kelamin'] as $kelamin)
                                            <div @class(['col-xl-6' => $sesi->dengan_sexing, 'col-12' => ! $sesi->dengan_sexing])>
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
                            @endforeach
                        </div>

                        <h6 class="mb-15">Ringkasan hasil</h6>
                        <x-sampling.ringkasan :hasil="$hasil" :pakan="$pakan" :dengan-sexing="$sesi->dengan_sexing" :umur="$sesi->umur" />
                    @endif
                </div>
            </div>

            <div class="modal-footer" x-data="eksporSampling" data-lembar="{{ json_encode($lembar) }}">
                @if ($sesi)
                    <button type="button" class="btn btn-outline-primary btn-sm" x-on:click="simpan" wire:loading.attr="disabled" wire:target="buka">
                        <i class="uil uil-image-download"></i> Simpan PNG
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" x-on:click="salin" wire:loading.attr="disabled" wire:target="buka">
                        <i class="uil uil-copy"></i> <span x-text="labelSalin" aria-live="polite">Salin PNG</span>
                    </button>
                @endif
                <button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Tutup</button>
            </div>
        </div>
    </div>
</div>
