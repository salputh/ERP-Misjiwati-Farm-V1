@props(['tersaring', 'saringan', 'pilihan', 'ringkasan'])

{{-- Buku kas berurutan tanggal dengan subtotal per bulan. Dropdown menyaring satu kategori;
     nomor dan saldo tiap baris tetap dari buku kas utuh. --}}
<div class="col-lg-12 mb-25">
    <div class="card border-0 px-25">
        <div class="card-header px-0 border-0">
            <h6>Buku kas</h6>
            <div class="card-extra tanpa-kapital">
                <x-pilih class="pilih--kanan" :label="$saringan?->label() ?? 'Semua kategori'" nama="Saring kategori">
                    <button type="button" wire:click="pilihKategori('')" wire:key="saring-semua" @class(['dropdown-item', 'active' => ! $saringan])>Semua kategori</button>
                    @foreach ($pilihan as $kategori)
                        <button type="button" wire:click="pilihKategori('{{ $kategori->value }}')" wire:key="saring-{{ $kategori->value }}" @class(['dropdown-item', 'active' => $kategori === $saringan])>{{ $kategori->label() }}</button>
                    @endforeach
                </x-pilih>
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless tabel-laporan tabel-panen tabel-kas mb-0">
                        <thead>
                            <tr class="userDatatable-header">
                                <th class="text-start"><span class="userDatatable-title">No.</span></th>
                                <th class="text-start"><span class="userDatatable-title">Tanggal</span></th>
                                <th class="text-start"><span class="userDatatable-title">Kategori</span></th>
                                <th class="text-start"><span class="userDatatable-title">Uraian</span></th>
                                <th class="text-end"><span class="userDatatable-title">Masuk (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Keluar (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Saldo (Rp)</span></th>
                                <th class="text-end"><span class="userDatatable-title">Aksi</span></th>
                            </tr>
                        </thead>
                        @foreach ($tersaring['bulan'] as $sebulan)
                            <tbody wire:key="kas-{{ $sebulan['bulan']->format('Y-m') }}">
                                <tr class="panen-hari">
                                    <th colspan="8" scope="colgroup" class="text-start">
                                        {{ $sebulan['bulan']->translatedFormat('F Y') }}
                                        <span>@angka(count($sebulan['baris'])) transaksi</span>
                                    </th>
                                </tr>
                                @foreach ($sebulan['baris'] as $baris)
                                    <tr wire:key="kas-{{ $baris['nomor'] }}">
                                        <td class="text-start">{{ $baris['nomor'] }}</td>
                                        <td class="text-start">{{ $baris['tanggal']->translatedFormat('j M Y') }}</td>
                                        <td class="text-start"><span class="dm-tag tag-transparented m-0 {{ $baris['kategori']->kelasTag() }}">{{ $baris['kategori']->label() }}</span></td>
                                        <td class="text-start tabel-kas__uraian">{{ $baris['uraian'] }}</td>
                                        <td class="text-end color-success fw-500">@kurung($baris['masuk'])</td>
                                        <td class="text-end">@kurung($baris['keluar'])</td>
                                        <td @class(['text-end', 'color-danger' => $baris['saldo'] < 0])>@kurung($baris['saldo'])</td>
                                        <td class="text-end">
                                            @unless ($this->periode->tertutup())
                                                <x-aksi.ikon :aksi="[
                                                    ['kelas' => 'edit', 'label' => 'Ubah transaksi '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'ubah('.$baris['id'].')', 'modal' => '#modal-form-kas'],
                                                    ['kelas' => 'remove', 'label' => 'Hapus transaksi '.$baris['tanggal']->translatedFormat('j F Y'), 'click' => 'mintaHapus('.$baris['id'].')', 'modal' => '#konfirmasi-hapus-transaksi-kas'],
                                                ]" />
                                            @endunless
                                        </td>
                                    </tr>
                                @endforeach
                                <tr class="panen-subtotal">
                                    <td colspan="4" class="text-start">Subtotal {{ $sebulan['bulan']->translatedFormat('F Y') }}</td>
                                    <td class="text-end">@kurung($sebulan['masuk'] ?: null)</td>
                                    <td class="text-end">@kurung($sebulan['keluar'] ?: null)</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        @endforeach
                        <tfoot>
                            <tr>
                                <th colspan="4" class="text-start">
                                    @if ($saringan)
                                        Total {{ $saringan->label() }}, @angka($tersaring['jumlah']) transaksi
                                    @else
                                        Total seluruh transaksi
                                    @endif
                                </th>
                                <th class="text-end">@kurung($tersaring['masuk'] ?: null)</th>
                                <th class="text-end">@kurung($tersaring['keluar'] ?: null)</th>
                                <th @class(['text-end', 'color-danger' => ! $saringan && $ringkasan['selisih'] < 0])>
                                    @unless ($saringan)
                                        @kurung($ringkasan['selisih'])
                                    @endunless
                                </th>
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Transaksi diurutkan menurut tanggal. Saldo adalah sisa kas setelah transaksi itu; angka dalam kurung berarti pengeluaran sudah melebihi dana yang masuk.
                @if ($saringan)
                    Nomor dan saldo tetap mengikuti buku kas utuh, bukan hanya kategori ini.
                @endif
            </p>
        </div>
    </div>
</div>
