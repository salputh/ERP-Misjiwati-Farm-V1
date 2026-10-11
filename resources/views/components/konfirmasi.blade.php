@props(['id', 'judul', 'aksi', 'tombol' => 'Ya, lanjutkan', 'warna' => 'primary', 'memuat' => null])

{{-- Modal konfirmasi bergaya template (HexaDash: modal-info-confirmed) sebelum mengubah atau menghapus data.
     Dibuka tombol ber-data-bs-target="#id"; tombol setuju menjalankan aksi Livewire lalu menutup modal.
     "memuat" adalah aksi yang menyiapkan isi modal: selama aksi itu berjalan isi diganti spinner dan tombol setuju dimatikan. --}}
<div class="modal-info-confirmed modal fade" id="{{ $id }}" tabindex="-1" role="dialog" aria-labelledby="{{ $id }}-judul" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-sm modal-info modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-body">
                @isset($memuat)
                    <div class="text-center py-3" wire:loading wire:target="{{ $memuat }}" role="status">
                        <x-pemintal />
                        <span class="visually-hidden">Memuat</span>
                    </div>
                @endisset

                <div class="modal-info-body d-flex" @isset($memuat) wire:loading.remove wire:target="{{ $memuat }}" @endisset>
                    <div @class(['modal-info-icon', 'danger' => $warna === 'danger', 'warning' => $warna !== 'danger'])>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div class="modal-info-text">
                        <h6 id="{{ $id }}-judul">{{ $judul }}</h6>
                        <p class="mb-0">{{ $slot }}</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-light btn-outlined btn-sm" data-bs-dismiss="modal">Batal</button>
                <button
                    type="button"
                    class="btn btn-{{ $warna }} btn-sm"
                    data-bs-dismiss="modal"
                    wire:click="{{ $aksi }}"
                    @isset($memuat) wire:loading.attr="disabled" wire:target="{{ $memuat }}" @endisset
                >{{ $tombol }}</button>
            </div>
        </div>
    </div>
</div>
