<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Payroll pemanen" :jejak="['Keuangan', 'Payroll pemanen']">
            <x-pilih-periode :daftar="$this->daftarPeriode" :terpilih="$this->periode" rute="payroll.pemanen" />
        </x-breadcrumb>

        @if ($this->periode && $this->lembar)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body">
                        <dl class="recording-info mb-0">
                            <div><dt>Periode</dt><dd>{{ $this->periode->nama }}</dd></div>
                            <div><dt>Nota panen</dt><dd>@angka($this->lembar['jumlah_nota'])</dd></div>
                            <div><dt>Total berat panen</dt><dd>@angka($this->lembar['berat_total'], 2) kg</dd></div>
                            <div><dt>Total payroll</dt><dd>Rp @angka($this->lembar['total_upah'])</dd></div>
                        </dl>
                    </div>
                </div>
            </div>

            @if ($this->lembar['nama_belum_terdaftar'] !== [])
                <div class="col-lg-12 mb-25">
                    <div class="alert alert-warning" role="alert">
                        <div class="alert-content">
                            <p>Nama berikut belum terdaftar di Master Data. Tonase notanya belum masuk ke total payroll:</p>
                            <ul class="mb-0">
                                @foreach ($this->lembar['nama_belum_terdaftar'] as $orang)
                                    <li>{{ $orang['nama'] }} — @angka($orang['berat_kg'], 2) kg</li>
                                @endforeach
                            </ul>
                        </div>
                    </div>
                </div>
            @endif

            @if ($this->lembar['berat_tanpa_nama'] > 0)
                <div class="col-lg-12 mb-25">
                    <div class="alert alert-warning" role="alert">
                        <div class="alert-content">
                            <p class="mb-0">@angka($this->lembar['berat_tanpa_nama'], 2) kg belum memiliki nama tukang tangkap, sehingga belum masuk ke payroll. Lengkapi nama di data panen agar dapat dihitung.</p>
                        </div>
                    </div>
                </div>
            @endif

            <div class="col-lg-12 mb-25">
                <div class="card border-0 px-25">
                    <div class="card-header px-0 border-0">
                        <div>
                            <h6>Rincian payroll pemanen</h6>
                            <span class="fs-12 color-gray">Setiap nama pemanen yang tercatat menerima perhitungan dari seluruh tonase nota tersebut. Tarif mengikuti Master Data.</span>
                        </div>
                    </div>
                    <div class="card-body px-0">
                        <div class="table-responsive">
                            <table class="table mb-0">
                                <thead>
                                    <tr class="userDatatable-header">
                                        <th><span class="userDatatable-title">No.</span></th>
                                        <th><span class="userDatatable-title">Nama pemanen</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Jumlah nota</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Tonase untuk upah</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Upah/kg</span></th>
                                        <th class="text-end"><span class="userDatatable-title">Total upah</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse ($this->lembar['pemanen'] as $orang)
                                        <tr wire:key="payroll-pemanen-{{ $orang['nama'] }}">
                                            <td><div class="userDatatable-content">{{ $loop->iteration }}</div></td>
                                            <td><div class="userDatatable-content fw-600">{{ $orang['nama'] }}</div></td>
                                            <td class="text-end"><div class="userDatatable-content">@angka($orang['jumlah_nota'])</div></td>
                                            <td class="text-end"><div class="userDatatable-content">@angka($orang['berat_kg'], 2) kg</div></td>
                                            <td class="text-end"><div class="userDatatable-content">Rp @angka($orang['upah_per_kg'])</div></td>
                                            <td class="text-end"><div class="userDatatable-content fw-600">Rp @angka($orang['total_upah'])</div></td>
                                        </tr>
                                    @empty
                                        <tr>
                                            <td colspan="6" class="text-center py-30 color-gray">Belum ada berat panen yang dapat dihitung untuk pemanen terdaftar.</td>
                                        </tr>
                                    @endforelse
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colspan="3">Akumulasi tonase per pemanen</th>
                                        <th class="text-end">@angka($this->lembar['berat_teralokasi'], 2) kg</th>
                                        <th></th>
                                        <th class="text-end">Rp @angka($this->lembar['total_upah'])</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-12 mb-25">
                <p class="fs-12 color-gray mb-0">Upah setiap pemanen dihitung dari seluruh berat bruto nota yang mencantumkan namanya dikalikan tarif pemanen yang berlaku saat ini. Jika beberapa pemanen tercatat pada satu nota, masing-masing menerima perhitungan atas seluruh berat nota. Perubahan nama atau tarif tukang tangkap dapat dilakukan di halaman Panen dan Master Data.</p>
            </div>
        @elseif ($this->periode)
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada panen di periode ini</h5>
                        <p class="color-gray mb-0">Payroll pemanen akan muncul setelah nota panen dicatat.</p>
                    </div>
                </div>
            </div>
        @else
            <div class="col-lg-12 mb-25">
                <div class="card border-0">
                    <div class="card-body p-30">
                        <h5 class="mb-10">Belum ada periode</h5>
                        <p class="color-gray mb-0">Buat periode dan catat panen untuk menghitung payroll pemanen.</p>
                    </div>
                </div>
            </div>
        @endif
    </div>
</div>
