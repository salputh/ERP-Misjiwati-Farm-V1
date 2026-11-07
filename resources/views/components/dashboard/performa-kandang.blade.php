@props(['kandang'])

{{-- Tabel performa tiap kandang --}}
<div class="col-xxl-8 mb-4" x-data="saringKandang(@js(array_column($kandang, 'status')))">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body db-card-body-table">
<header class="db-card-head">
<div><h2 class="db-card-title">Performa kandang</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <ul class="nav nav-pills nav-sm" role="tablist">
                    @foreach (['semua' => 'Semua', 'perlu' => 'Perlu dicek', 'sesuai' => 'Sesuai'] as $kunci => $teks)
                    <li>
                        <a href="#" role="tab" @class(['nav-link', 'active'=> $loop->first]) :class="saring === '{{ $kunci }}' && 'active'" :aria-selected="saring === '{{ $kunci }}'" @click.prevent="saring = '{{ $kunci }}'">{{ $teks }}</a>
                    </li>
                    @endforeach
                </ul>
            </div>
</header>
            <div class="selling-table-wrap">
                <div class="table-responsive">
                    <table class="table db-table">
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
                                <td><span class="badge {{ $baris['status']->kelasLencana() }} rounded-pill">{{ $baris['status']->label() }}</span></td>
                            </tr>
                            @endforeach
                            <tr x-show="kosong" x-cloak>
                                <td colspan="7" class="text-body-secondary">Tidak ada kandang di kategori ini.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <p class="db-card-foot">Jumlah per kandang belum dikurangi panen karena nota panen gabungan tidak mencatat kandang asal. Angka ayam hidup pada ringkasan sudah dikurangi dari total ekor panen.</p>
        
</div>
</section>
</div>