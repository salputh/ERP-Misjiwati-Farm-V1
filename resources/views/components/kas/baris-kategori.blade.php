@props(['baris', 'warna' => 'primary'])

{{-- Satu kategori pengeluaran: jumlah transaksi, nilai, dan porsinya terhadap seluruh pengeluaran. --}}
<tr>
    <td>{{ $baris['kategori']->label() }}</td>
    <td class="text-end">@angka($baris['transaksi'])</td>
    <td class="text-end">@angka($baris['jumlah'])</td>
    <td class="tabel-laporan__batang">
        <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" role="progressbar" aria-label="Porsi {{ $baris['kategori']->label() }}" aria-valuenow="{{ round($baris['persen']) }}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar bg-{{ $warna }} share-{{ max(0, min(100, (int) round($baris['persen']))) }}"></div>
            </div>
            <span class="small text-body-secondary tabel-kas__persen">@angka($baris['persen'], 1)%</span>
        </div>
    </td>
</tr>
