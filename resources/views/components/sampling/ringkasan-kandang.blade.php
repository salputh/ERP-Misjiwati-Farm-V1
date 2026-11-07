@props(['gabungan'])

{{-- Ringkasan sampling seluruh kandangs dalam periode, memakai sesi terbaru tiap kandangs:
     jumlah titik, ekor, ABW tertimbang, dan pakan standar terhadap aktual. --}}
<div class="table-responsive d-none d-md-block">
<table class="table mb-0 db-table">
    <thead>
        <tr>
            <th>Kandang</th>
            <th class="text-end">Sesi terakhir</th>
            <th class="text-end">Usia</th>
            <th class="text-end">Titik</th>
            <th class="text-end">Ekor</th>
            <th class="text-end">ABW</th>
            <th class="text-end">Standar (zak)</th>
            <th class="text-end">Aktual (zak)</th>
            <th></th>
        </tr>
    </thead>
    <tbody>
        @foreach ($gabungan['kandang'] as $baris)
            <tr wire:key="ringkasan-kandang-{{ $baris['periode_kandang_id'] }}">
                <td class="fw-medium text-body">
                    {{ $baris['kandang'] }}
                    @if ($baris['terpilih'])
                        <span class="badge bg-primary-subtle text-primary my-0 ms-1">dipilih</span>
                    @endif
                    @unless ($baris['ada_sesi'])
                        <span class="d-block small text-body-secondary">belum ada sampling</span>
                    @endunless
                </td>
                <td class="text-end">
                    @if ($baris['ada_sesi'])
                        {{ $baris['tanggal']->translatedFormat('j M Y') }}
                    @else
                        -
                    @endif
                </td>
                <td class="text-end">{{ $baris['umur'] }} hari</td>
                <td class="text-end">{{ $baris['titik'] }}</td>
                <td class="text-end">@angka($baris['ekor'])</td>
                <td class="text-end">@angka($baris['abw']) g</td>
                <td class="text-end">@angka($baris['zak_standar'])</td>
                <td class="text-end">@angka($baris['zak'])</td>
                <td class="text-end">
                    @if ($baris['ada_sesi'])
                        <x-aksi.ikon :aksi="[
                            ['kelas' => 'view', 'label' => 'Lihat sampling terakhir '.$baris['kandang'].' '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'lihatTerakhir('.$baris['periode_kandang_id'].')', 'modal' => '#modal-riwayat-sampling'],
                        ]" />
                    @endif
                </td>
            </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <th colspan="3">Gabungan</th>
            <th class="text-end">{{ $gabungan['total']['titik'] }}</th>
            <th class="text-end">@angka($gabungan['total']['ekor'])</th>
            <th class="text-end">@angka($gabungan['total']['abw']) g</th>
            <th colspan="3"></th>
        </tr>
    </tfoot>
</table>
</div>

{{-- Ponsel: tiap kandang ditumpuk sebagai daftar ringkas tanpa scroll horizontal, dipisah garis tipis. --}}
<div class="d-md-none">
    @foreach ($gabungan['kandang'] as $baris)
        <div wire:key="ringkasan-kandang-ponsel-{{ $baris['periode_kandang_id'] }}" class="px-3 py-3 border-bottom">
            <div class="d-flex align-items-start justify-content-between gap-2">
                <div class="flex-grow-1" style="min-width:0">
                    <span class="fw-semibold text-body">{{ $baris['kandang'] }}</span>
                    @if ($baris['terpilih'])
                        <span class="badge bg-primary-subtle text-primary my-0 ms-1">dipilih</span>
                    @endif
                    <div class="small text-body-secondary">
                        @if ($baris['ada_sesi'])
                            {{ $baris['tanggal']->translatedFormat('j M Y') }} · usia {{ $baris['umur'] }} hari
                        @else
                            Belum ada sampling · usia {{ $baris['umur'] }} hari
                        @endif
                    </div>
                </div>
                @if ($baris['ada_sesi'])
                    <x-aksi.ikon :aksi="[
                        ['kelas' => 'view', 'label' => 'Lihat sampling terakhir '.$baris['kandang'].' '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'lihatTerakhir('.$baris['periode_kandang_id'].')', 'modal' => '#modal-riwayat-sampling'],
                    ]" />
                @endif
            </div>
            <dl class="row row-cols-3 g-2 small mb-0 mt-2 text-center">
                <div class="col"><dt class="fw-normal text-body-secondary">Titik</dt><dd class="mb-0 fw-medium text-body">{{ $baris['titik'] }}</dd></div>
                <div class="col"><dt class="fw-normal text-body-secondary">Ekor</dt><dd class="mb-0 fw-medium text-body">@angka($baris['ekor'])</dd></div>
                <div class="col"><dt class="fw-normal text-body-secondary">ABW</dt><dd class="mb-0 fw-medium text-body">@angka($baris['abw']) g</dd></div>
            </dl>
            <hr class="my-2 opacity-25">
            <dl class="row row-cols-2 g-2 small mb-0 text-center">
                <div class="col"><dt class="fw-normal text-body-secondary">Standar (zak)</dt><dd class="mb-0 fw-medium text-body">@angka($baris['zak_standar'])</dd></div>
                <div class="col"><dt class="fw-normal text-body-secondary">Aktual (zak)</dt><dd class="mb-0 fw-medium text-body">@angka($baris['zak'])</dd></div>
            </dl>
        </div>
    @endforeach
    <div class="px-3 py-3">
        <div class="fw-semibold text-body mb-1">Gabungan</div>
        <dl class="row row-cols-3 g-2 small mb-0 text-center">
            <div class="col"><dt class="fw-normal text-body-secondary">Titik</dt><dd class="mb-0 fw-semibold text-body">{{ $gabungan['total']['titik'] }}</dd></div>
            <div class="col"><dt class="fw-normal text-body-secondary">Ekor</dt><dd class="mb-0 fw-semibold text-body">@angka($gabungan['total']['ekor'])</dd></div>
            <div class="col"><dt class="fw-normal text-body-secondary">ABW</dt><dd class="mb-0 fw-semibold text-body">@angka($gabungan['total']['abw']) g</dd></div>
        </dl>
    </div>
</div>
