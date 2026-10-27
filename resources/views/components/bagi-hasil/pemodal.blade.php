@props(['pemodal', 'sisaAkhir'])

{{-- Rincian bagi hasil keuntungan atau pengembalian modal: sisa akhir dibagi menurut porsi tiap pemodal. --}}
<div class="col-12 order-4 mb-25">
    <div class="card card-default card-md h-100">
        <div class="card-header">
            <h6>Bagi hasil pemodal</h6>
            <div class="card-extra fs-13 color-light tanpa-kapital">keuntungan atau pengembalian modal</div>
        </div>
        <div class="card-body">
            <div class="table4 table-responsive">
                <table class="table tabel-laporan text-nowrap mb-0">
                    <thead>
                        <tr class="userDatatable-header">
                            <th><span class="userDatatable-title">No.</span></th>
                            <th><span class="userDatatable-title">Pemodal</span></th>
                            <th class="text-end"><span class="userDatatable-title">Porsi</span></th>
                            <th class="text-end"><span class="userDatatable-title">Jumlah (Rp)</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($pemodal['penerima'] as $satu)
                            <tr>
                                <td>{{ $loop->iteration }}</td>
                                <td>{{ $satu['nama'] }}</td>
                                <td class="text-end recording-masukan">{{ \App\Support\Format::persen($satu['persen']) }}</td>
                                <td @class(['text-end', 'color-danger' => $satu['jumlah'] < 0])>@kurung($satu['jumlah'])</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="4" class="color-gray">Porsi pemodal kandang ini belum diisi.</td>
                            </tr>
                        @endforelse
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="2">Jumlah</th>
                            <th class="text-end">{{ \App\Support\Format::persen($pemodal['persen']) }}</th>
                            <th @class(['text-end', 'color-danger' => $pemodal['total'] < 0])>@kurung($pemodal['total'])</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p class="fs-13 color-light mt-15 mb-0">
                Tiap pemodal menerima porsinya dari sisa akhir Rp @kurung($sisaAkhir), dibulatkan ke rupiah; pemodal terakhir menerima sisanya supaya jumlahnya tepat.
            </p>
        </div>
    </div>
</div>
