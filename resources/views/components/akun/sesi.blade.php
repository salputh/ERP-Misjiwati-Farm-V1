@props(['sesi', 'sesiIni'])

{{-- Siapa yang sedang masuk: satu baris per perangkat yang belum keluar, terbaru dulu (HexaDash: Basic Table, Basic Usage).
     Satu akun bisa muncul lebih dari sekali bila masuk dari beberapa perangkat. --}}
<div class="col-12 mb-25">
    <x-kartu judul="Sedang masuk" subjudul="Perangkat yang belum keluar dari ERP" badan="p-0">
        <x-slot:ekstra class="fs-14 color-light tanpa-kapital">@angka($sesi->count()) perangkat</x-slot:ekstra>

        <div class="table4 p-25">
            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Pengguna</span></th>
                            <th><span class="userDatatable-title">Perangkat</span></th>
                            <th class="d-none d-md-table-cell"><span class="userDatatable-title">Alamat IP</span></th>
                            <th><span class="userDatatable-title">Aktif terakhir</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($sesi as $satu)
                            <tr wire:key="sesi-{{ $loop->index }}-{{ $satu->user_id }}">
                                <td>
                                    <div class="d-flex align-items-center">
                                        <x-akun.avatar :akun="$satu->user" :status="$satu->status()" />
                                        <div class="userDatatable-inline-title">
                                            <h6 class="mb-0">{{ $satu->user->name }}</h6>
                                            <p class="d-block mb-0">{{ $satu->user->email }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="userDatatable-content d-flex align-items-center">
                                        <i class="uil {{ $satu->ikon() }} fs-18 color-light me-10" aria-hidden="true"></i>
                                        {{ $satu->perangkat() }}
                                        @if ($satu->id === $sesiIni)
                                            <span class="dm-tag tag-primary tag-transparented ms-10">Perangkat ini</span>
                                        @endif
                                    </div>
                                </td>
                                <td class="d-none d-md-table-cell"><div class="userDatatable-content">{{ $satu->ip_address ?? '-' }}</div></td>
                                <td>
                                    <div class="userDatatable-content">
                                        <span title="{{ $satu->last_activity->translatedFormat('j F Y, H:i') }}">{{ $satu->last_activity->diffForHumans() }}</span>
                                    </div>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>
    </x-kartu>
</div>
