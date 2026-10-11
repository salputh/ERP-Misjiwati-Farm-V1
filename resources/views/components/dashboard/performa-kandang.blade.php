@props(['kandang'])

{{-- Tabel performa tiap kandang (HexaDash demo one: top selling products) --}}
<div class="col-xxl-8 mb-25" x-data="saringKandang(@js(array_column($kandang, 'status')))">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Performa kandang</h6>
            <div class="card-extra">
                <ul class="card-tab-links nav-tabs nav" role="tablist">
                    @foreach (['semua' => 'Semua', 'perlu' => 'Perlu dicek', 'sesuai' => 'Sesuai'] as $kunci => $teks)
                        <li>
                            <a href="#" role="tab" @class(['active' => $loop->first]) :class="saring === '{{ $kunci }}' && 'active'" :aria-selected="saring === '{{ $kunci }}'" @click.prevent="saring = '{{ $kunci }}'">{{ $teks }}</a>
                        </li>
                    @endforeach
                </ul>
            </div>
        </div>
        <div class="card-body p-0">
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table table--default table-borderless">
                        <thead>
                            <tr>
                                <th>Kandang</th>
                                <th>Ayam hidup</th>
                                <th>Bobot</th>
                                <th>Terhadap standar</th>
                                <th>Mortalitas</th>
                                <th>FCR</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($kandang as $baris)
                                <tr wire:key="kandang-{{ $baris['kode'] }}" x-show="tampil('{{ $baris['status']->value }}')">
                                    <td><strong>{{ $baris['nama'] }}</strong></td>
                                    <td>@angka($baris['sisa'])</td>
                                    <td>
                                        @isset($baris['abw'])
                                            @angka($baris['abw']) g
                                        @else
                                            -
                                        @endisset
                                    </td>
                                    <td>
                                        @isset($baris['abw_selisih'])
                                            <x-selisih :nilai="$baris['abw_selisih']" />
                                        @else
                                            -
                                        @endisset
                                    </td>
                                    <td>@angka($baris['mortalitas'], 2)%</td>
                                    <td>@angka($baris['fcr'], 2)</td>
                                    <td><span class="{{ $baris['status']->kelasLencana() }} rounded-pill userDatatable-content-status active">{{ $baris['status']->label() }}</span></td>
                                </tr>
                            @endforeach
                            <tr x-show="kosong" x-cloak>
                                <td colspan="7" class="color-gray">Tidak ada kandang di kategori ini.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>
