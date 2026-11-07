@props(['id', 'judul', 'aksi', 'tombol' => 'Ya, lanjutkan', 'warna' => 'primary', 'memuat' => null])

{{-- Modal konfirmasi Basalt (basalt-confirm) sebelum mengubah atau menghapus data.
     Dibuka tombol ber-data-bs-target="#id"; tombol setuju menjalankan aksi Livewire lalu menutup modal.
     "memuat" adalah aksi yang menyiapkan isi modal: selama aksi itu berjalan isi diganti spinner dan tombol setuju dimatikan. --}}
<div class="modal fade" id="{{ $id }}" tabindex="-1" role="dialog" aria-labelledby="{{ $id }}-judul" aria-hidden="true" wire:ignore.self>
    <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
        <div class="modal-content">
            @isset($memuat)
                <div class="text-center py-4" wire:loading wire:target="{{ $memuat }}" role="status">
                    <x-pemintal />
                    <span class="visually-hidden">Memuat</span>
                </div>
            @endisset

            <div @class(['basalt-confirm', 'basalt-confirm-warning' => $warna !== 'danger' && $warna !== 'primary', 'basalt-confirm-primary' => $warna === 'primary']) @isset($memuat) wire:loading.remove wire:target="{{ $memuat }}" @endisset>
                <span class="basalt-confirm-icon"><i class="bi {{ $warna === 'danger' ? 'bi-trash3' : 'bi-question-circle' }}" aria-hidden="true"></i></span>
                <p class="basalt-confirm-title" id="{{ $id }}-judul">{{ $judul }}</p>
                <p class="basalt-confirm-text">{{ $slot }}</p>
                <div class="basalt-confirm-actions">
                    <button
                        type="button"
                        class="btn btn-{{ $warna }}"
                        data-bs-dismiss="modal"
                        wire:click="{{ $aksi }}"
                        @isset($memuat) wire:loading.attr="disabled" wire:target="{{ $memuat }}" @endisset
                    >{{ $tombol }}</button>
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Batal</button>
                </div>
            </div>
        </div>
    </div>
</div>
