@props(['baris', 'warna' => 'primary'])

{{-- Satu kategori pengeluaran: jumlah transaksi, nilai, dan porsinya terhadap seluruh pengeluaran. --}}
<tr>
    <td class="text-start">{{ $baris['kategori']->label() }}</td>
    <td class="text-end">@angka($baris['transaksi'])</td>
    <td class="text-end">@angka($baris['jumlah'])</td>
    <td class="tabel-laporan__batang">
        <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" role="progressbar" aria-label="Porsi {{ $baris['kategori']->label() }}" aria-valuenow="{{ round($baris['persen']) }}" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-bar bg-{{ $warna }}" style="width: {{ $baris['persen'] }}%"></div>
            </div>
            <span class="fs-12 color-gray tabel-kas__persen">@angka($baris['persen'], 1)%</span>
        </div>
    </td>
</tr>
