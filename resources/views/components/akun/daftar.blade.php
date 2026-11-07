@props(['daftar'])

{{-- Daftar akun pengguna . Status dan aktif terakhir dihitung dari sesi yang belum
     kedaluwarsa; masuk terakhir disimpan di akun karena sesinya terhapus saat pengguna keluar.
     Akun yang sedang dipakai tidak punya ikon hapus. Ikon aksi membuka modal ubah (#modal-akun) dan
     konfirmasi hapus (#konfirmasi-hapus-akun) di halaman Akun pengguna. --}}
<div class="col-12 mb-4">
    <x-kartu judul="Daftar akun" badan="p-0">
        <x-slot:ekstra class="text-body-secondary tanpa-kapital">@angka(count($daftar)) akun</x-slot:ekstra>

        <div class="tabel-data">
            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Akun</th>
                            <th>Status</th>
                            <th class="text-end d-none d-md-table-cell">Perangkat</th>
                            <th>Aktif terakhir</th>
                            <th class="d-none d-lg-table-cell">Masuk terakhir</th>
                            <th class="text-end">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($daftar as $baris)
                            <tr wire:key="akun-{{ $baris['akun']->id }}">
                                <td>
                                    <div class="d-flex align-items-center">
                                        <x-akun.avatar :akun="$baris['akun']" :status="$baris['status']" />
                                        <div>
                                            <h6 class="mb-0">
                                                {{ $baris['akun']->name }}
                                                @if ($baris['diri_sendiri'])
                                                    <span class="badge bg-primary-subtle text-primary ms-1">Anda</span>
                                                @endif
                                            </h6>
                                            <p class="d-block mb-0">{{ $baris['akun']->email }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="d-inline-block">
                                        <span class="badge {{ $baris['status']->kelasLencana() }} rounded-pill">{{ $baris['status']->label() }}</span>
                                    </div>
                                </td>
                                <td class="text-end d-none d-md-table-cell">@angka($baris['sesi']->count())</td>
                                <td>
                                    <div>
                                        @isset($baris['terakhir_aktif'])
                                            <span title="{{ $baris['terakhir_aktif']->translatedFormat('j F Y, H:i') }}">{{ $baris['terakhir_aktif']->diffForHumans() }}</span>
                                        @else
                                            -
                                        @endisset
                                    </div>
                                </td>
                                <td class="d-none d-lg-table-cell">
                                    <div>{{ $baris['akun']->terakhir_masuk_at?->translatedFormat('j F Y, H:i') ?? 'Belum pernah' }}</div>
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

            <p class="small text-body-secondary mt-3 mb-0">
                Online berarti membuka ERP dalam {{ \App\Models\Sesi::MENIT_ONLINE }} menit terakhir. Daftar ini diperbarui otomatis setiap menit.
            </p>
        </div>
    </x-kartu>
</div>
