@props(['pemodal', 'sisaAkhir'])

{{-- Rincian bagi hasil keuntungan atau pengembalian modal: sisa akhir dibagi menurut porsi tiap pemodal. --}}
<div class="col-12 order-4 mb-25">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Bagi hasil pemodal</h6>
            <div class="card-extra fs-14 color-gray tanpa-kapital">keuntungan atau pengembalian modal</div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="table-responsive">
                <table class="table table--default table-borderless tabel-laporan tabel-laporan--garis tabel-laporan--rapat mb-0">
                    <thead>
                        <tr>
                            <th class="text-start">No.</th>
                            <th class="text-start">Pemodal</th>
                            <th class="text-end">Porsi</th>
                            <th class="text-end">Jumlah (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($pemodal['penerima'] as $satu)
                            <tr>
                                <td class="text-start">{{ $loop->iteration }}</td>
                                <td class="text-start">{{ $satu['nama'] }}</td>
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
                            <th colspan="2" class="text-start">Jumlah</th>
                            <th class="text-end">{{ \App\Support\Format::persen($pemodal['persen']) }}</th>
                            <th @class(['text-end', 'color-danger' => $pemodal['total'] < 0])>@kurung($pemodal['total'])</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p class="fs-12 color-gray mt-15 mb-0">
                Tiap pemodal menerima porsinya dari sisa akhir Rp @kurung($sisaAkhir), dibulatkan ke rupiah; pemodal terakhir menerima sisanya supaya jumlahnya tepat.
            </p>
        </div>
    </div>
</div>
