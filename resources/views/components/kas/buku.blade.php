@props(['tersaring', 'saringan', 'pilihan', 'ringkasan', 'tombolTambah' => false, 'periodeTertutup' => false])

<div class="col-12 mb-4">
    <section class="card basalt-box db-card">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Buku kas</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2 d-flex flex-wrap align-items-center gap-2 tanpa-kapital">
                <x-pilih class="pilih--kanan" :label="$saringan?->label() ?? 'Semua kategori'" nama="Saring kategori">
                    <button type="button" wire:click="pilihKategori('')" wire:key="saring-semua" @class(['dropdown-item', 'active' => ! $saringan])>Semua kategori</button>
                    @foreach ($pilihan as $kategori)
                        <button type="button" wire:click="pilihKategori(@js($kategori->value))" wire:key="saring-{{ $kategori->value }}" @class(['dropdown-item', 'active' => $kategori->value === $saringan?->value])>{{ $kategori->label() }}</button>
                    @endforeach
                </x-pilih>
                @if ($tombolTambah)
                    <x-tombol ikon="bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-form-kas" :disabled="$periodeTertutup" wire:loading.attr="disabled" wire:target="tambah">Tambah transaksi</x-tombol>
                @endif
            </div>
</header>
            <div class="tabel-data table-responsive">
                    <table class="table tabel-laporan tabel-kas mb-0 db-table">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Tanggal</th>
                                <th>Kategori</th>
                                <th>Uraian</th>
                                <th class="text-end">Masuk (Rp)</th>
                                <th class="text-end">Keluar (Rp)</th>
                                <th class="text-end">Saldo (Rp)</th>
                                <th class="text-end">Aksi</th>
                            </tr>
                        </thead>
                        @foreach ($tersaring['bulan'] as $sebulan)
                            <tbody wire:key="kas-{{ $sebulan['bulan']->format('Y-m') }}">
                                <x-tabel.grup kolom="8" :judul="$sebulan['bulan']->translatedFormat('F Y')" :keterangan="\App\Support\Format::angka(count($sebulan['baris'])).' transaksi'" />
                                @foreach ($sebulan['baris'] as $baris)
                                    <tr wire:key="kas-{{ $baris['nomor'] }}">
                                        <td>{{ $baris['nomor'] }}</td>
                                        <td>{{ $baris['tanggal']->translatedFormat('j M Y') }}</td>
                                        <td><span class="badge m-0 {{ $baris['kategori']->kelasTag() }}">{{ $baris['kategori']->label() }}</span></td>
                                        <td class="text-start tabel-kas__uraian">{{ $baris['uraian'] }}</td>
                                        <td class="text-end text-success fw-medium">@kurung($baris['masuk'])</td>
                                        <td class="text-end">@kurung($baris['keluar'])</td>
                                        <td @class(['text-end', 'text-danger' => $baris['saldo'] < 0])>@kurung($baris['saldo'])</td>
                                        <td class="text-end">
                                            @if (in_array($baris['id'], $this->transaksiKasbon, true))
                                                <a href="{{ route('kasbon.abk', ['periode' => $this->periode->id]) }}" class="badge bg-warning-subtle text-warning m-0" title="Transaksi ini diubah dari halaman Kasbon ABK">Kasbon</a>
                                            @elseif (! $this->periode->tertutup())
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'edit', 'label' => 'Ubah transaksi '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'ubah('.$baris['id'].')', 'modal' => '#modal-form-kas'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus transaksi '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'mintaHapus('.$baris['id'].')', 'modal' => '#konfirmasi-hapus-transaksi-kas'],
                                                ]" />
                                            @endif
                                        </td>
                                    </tr>
                                @endforeach
                                <tr class="fw-medium text-body">
                                    <td colspan="4">Subtotal {{ $sebulan['bulan']->translatedFormat('F Y') }}</td>
                                    <td class="text-end">@kurung($sebulan['masuk'] ?: null)</td>
                                    <td class="text-end">@kurung($sebulan['keluar'] ?: null)</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        @endforeach
                        <tfoot>
                            <tr>
                                <th colspan="4">
                                    @if ($saringan)
                                        Total {{ $saringan->label() }}, @angka($tersaring['jumlah']) transaksi
                                    @else
                                        Total seluruh transaksi
                                    @endif
                                </th>
                                <th class="text-end">@kurung($tersaring['masuk'] ?: null)</th>
                                <th class="text-end">@kurung($tersaring['keluar'] ?: null)</th>
                                <th @class(['text-end', 'text-danger' => ! $saringan && $ringkasan['selisih'] < 0])>
                                    @unless ($saringan)
                                        @kurung($ringkasan['selisih'])
                                    @endunless
                                </th>
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
            </div>
            <p class="small text-body-secondary mt-3 mb-0">
                Transaksi diurutkan menurut tanggal. Saldo adalah sisa kas setelah transaksi itu; angka dalam kurung berarti pengeluaran sudah melebihi dana yang masuk.
                @if ($saringan)
                    Nomor dan saldo tetap mengikuti buku kas utuh, bukan hanya kategori ini.
                @endif
            </p>
        
</div>
</section>
</div>
