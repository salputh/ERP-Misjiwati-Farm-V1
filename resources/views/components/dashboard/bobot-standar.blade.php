@props(['grafik'])

{{-- Bobot aktual terhadap standar. Logika grafik: resources/js/app.js --}}
<div class="col-xxl-6 mb-4" wire:ignore x-data="grafikBobot(@js($grafik))">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Bobot terhadap standar</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <ul class="nav nav-pills nav-sm" role="tablist">
                    <template x-for="(isi, kode) in data.bobot" :key="kode">
                        <li>
                            <a href="#" role="tab" class="nav-link" :class="pilih === kode && 'active'" :aria-selected="pilih === kode" @click.prevent="ganti(kode)" x-text="isi.label"></a>
                        </li>
                    </template>
                </ul>
            </div>
</header>
            <div class="d-flex flex-wrap gap-4 mb-3">
                <div >
                    <span class="d-block small fw-medium text-primary">Aktual</span>
                    <strong class="d-block h5 mb-0" x-text="akhir < 0 ? '-' : fmt(seri.data[akhir]) + ' g'"></strong>
                    <template x-if="selisih !== null">
                        <span class="small" :class="selisih >= 0 ? 'text-success' : 'text-danger'">
                            <i class="bi" :class="selisih >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'"></i>
                            <strong x-text="fmt(Math.abs(selisih), 1) + '%'"></strong>
                        </span>
                    </template>
                </div>
                <div >
                    <span class="d-block small fw-medium text-info">Standar</span>
                    <strong class="d-block h5 mb-0" x-text="akhir < 0 ? '-' : fmt(data.standar[akhir]) + ' g'"></strong>
                </div>
                {{-- Timbang dengan sexing: ABW jantan dan betina terakhir, hanya bila kandang terpilih pernah sampling dengan sexing. --}}
                <template x-for="kelamin in ['jantan', 'betina']" :key="kelamin">
                    <div  x-show="sexingTerakhir(kelamin)">
                        <span class="d-block small fw-medium" :class="'label-detailed__type--' + kelamin" x-text="kelamin === 'jantan' ? 'Jantan' : 'Betina'"></span>
                        <strong class="d-block h5 mb-0" x-text="sexingTerakhir(kelamin) ? fmt(sexingTerakhir(kelamin).gram) + ' g' : '-'"></strong>
                        <span class="small text-body-secondary" x-text="sexingTerakhir(kelamin) ? 'hari ke-' + sexingTerakhir(kelamin).umur : ''"></span>
                    </div>
                </template>
            </div>
            <div class="tinggi-grafik">
                <canvas x-ref="kanvas" role="img" aria-label="Grafik bobot aktual, jantan, dan betina terhadap standar strain per hari"></canvas>
            </div>
        
</div>
</section>
</div>
