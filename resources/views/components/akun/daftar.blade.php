@props(['daftar'])

{{-- Daftar akun pengguna (HexaDash: Users, Data Table). Status dan aktif terakhir dihitung dari sesi yang belum
     kedaluwarsa; masuk terakhir disimpan di akun karena sesinya terhapus saat pengguna keluar.
     Akun yang sedang dipakai tidak punya ikon hapus. Ikon aksi membuka modal ubah (#modal-akun) dan
     konfirmasi hapus (#konfirmasi-hapus-akun) di halaman Akun pengguna. --}}
<div class="col-12 mb-25">
    <x-kartu judul="Daftar akun" badan="p-0">
        <x-slot:ekstra class="fs-14 color-light tanpa-kapital">@angka(count($daftar)) akun</x-slot:ekstra>

        <div class="table4 p-25">
            <div class="table-responsive">
                <table class="table mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">Akun</span></th>
                            <th><span class="userDatatable-title">Status</span></th>
                            <th class="text-end d-none d-md-table-cell"><span class="userDatatable-title">Perangkat</span></th>
                            <th><span class="userDatatable-title">Aktif terakhir</span></th>
                            <th class="d-none d-lg-table-cell"><span class="userDatatable-title">Masuk terakhir</span></th>
                            <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($daftar as $baris)
                            <tr wire:key="akun-{{ $baris['akun']->id }}">
                                <td>
                                    <div class="d-flex align-items-center">
                                        <x-akun.avatar :akun="$baris['akun']" :status="$baris['status']" />
                                        <div class="userDatatable-inline-title">
                                            <h6 class="mb-0">
                                                {{ $baris['akun']->name }}
                                                @if ($baris['diri_sendiri'])
                                                    <span class="dm-tag tag-primary tag-transparented ms-1">Anda</span>
                                                @endif
                                            </h6>
                                            <p class="d-block mb-0">{{ $baris['akun']->email }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="userDatatable-content d-inline-block">
                                        <span class="{{ $baris['status']->kelasLencana() }} rounded-pill userDatatable-content-status active">{{ $baris['status']->label() }}</span>
                                    </div>
                                </td>
                                <td class="text-end d-none d-md-table-cell"><div class="userDatatable-content">@angka($baris['sesi']->count())</div></td>
                                <td>
                                    <div class="userDatatable-content">
                                        @isset($baris['terakhir_aktif'])
                                            <span title="{{ $baris['terakhir_aktif']->translatedFormat('j F Y, H:i') }}">{{ $baris['terakhir_aktif']->diffForHumans() }}</span>
                                        @else
                                            -
                                        @endisset
                                    </div>
                                </td>
                                <td class="d-none d-lg-table-cell">
                                    <div class="userDatatable-content">{{ $baris['akun']->terakhir_masuk_at?->translatedFormat('j F Y, H:i') ?? 'Belum pernah' }}</div>
                                </td>
                                <td>
                                    @if ($baris['diri_sendiri'])
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah akun '.$baris['akun']->name, 'click' => 'ubah('.$baris['akun']->id.')', 'modal' => '#modal-akun'],
                                        ]" />
                                    @else
                                        <x-aksi.ikon :aksi="[
                                            ['kelas' => 'edit', 'label' => 'Ubah akun '.$baris['akun']->name, 'click' => 'ubah('.$baris['akun']->id.')', 'modal' => '#modal-akun'],
                                            ['kelas' => 'remove', 'label' => 'Hapus akun '.$baris['akun']->name, 'click' => 'mintaHapus('.$baris['akun']->id.')', 'modal' => '#konfirmasi-hapus-akun'],
                                        ]" />
                                    @endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <p class="fs-13 color-light mt-15 mb-0">
                Online berarti membuka ERP dalam {{ \App\Models\Sesi::MENIT_ONLINE }} menit terakhir. Daftar ini diperbarui otomatis setiap menit.
            </p>
        </div>
    </x-kartu>
</div>
