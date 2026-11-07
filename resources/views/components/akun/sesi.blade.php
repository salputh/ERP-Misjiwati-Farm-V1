@props(['sesi', 'sesiIni'])

{{-- Siapa yang sedang masuk: satu baris per perangkat yang belum keluar, terbaru dulu .
     Satu akun bisa muncul lebih dari sekali bila masuk dari beberapa perangkat. --}}
<div class="col-12 mb-4">
    <x-kartu judul="Sedang masuk" subjudul="Perangkat yang belum keluar dari ERP" badan="p-0">
        <x-slot:ekstra class="text-body-secondary tanpa-kapital">@angka($sesi->count()) perangkat</x-slot:ekstra>

        <div class="tabel-data">
            <div class="table-responsive">
                <table class="table mb-0 db-table">
                    <thead>
                        <tr>
                            <th>Pengguna</th>
                            <th>Perangkat</th>
                            <th class="d-none d-md-table-cell">Alamat IP</th>
                            <th>Aktif terakhir</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($sesi as $satu)
                            <tr wire:key="sesi-{{ $loop->index }}-{{ $satu->user_id }}">
                                <td>
                                    <div class="d-flex align-items-center">
                                        <x-akun.avatar :akun="$satu->user" :status="$satu->status()" />
                                        <div>
                                            <h6 class="mb-0">{{ $satu->user->name }}</h6>
                                            <p class="d-block mb-0">{{ $satu->user->email }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <i class="bi {{ $satu->ikon() }} fs-5 text-body-secondary me-2" aria-hidden="true"></i>
                                        {{ $satu->perangkat() }}
                                        @if ($satu->id === $sesiIni)
                                            <span class="badge bg-primary-subtle text-primary ms-2">Perangkat ini</span>
                                        @endif
                                    </div>
                                </td>
                                <td class="d-none d-md-table-cell">{{ $satu->ip_address ?? '-' }}</td>
                                <td>
                                    <div>
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
