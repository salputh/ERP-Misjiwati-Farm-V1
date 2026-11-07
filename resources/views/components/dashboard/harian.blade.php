@props(['grafik'])

{{-- Pakan dan kematian harian. Logika grafik: resources/js/app.js --}}
<div class="col-xxl-4 mb-4" wire:ignore x-data="grafikHarian(@js($grafik))">
    <section class="card basalt-box db-card h-100">
<div class="db-card-body">
<header class="db-card-head">
<div><h2 class="db-card-title">Harian</h2></div>
            <div class="d-flex flex-wrap align-items-center gap-2">
                <ul class="nav nav-pills nav-sm" role="tablist">
                    <template x-for="(isi, kunci) in seri" :key="kunci">
                        <li>
                            <a href="#" role="tab" class="nav-link" :class="pilih === kunci && 'active'" :aria-selected="pilih === kunci" @click.prevent="ganti(kunci)" x-text="isi.label"></a>
                        </li>
                    </template>
                </ul>
            </div>
</header>
            <div class="d-flex flex-wrap gap-4 mb-3">
                <div >
                    <strong class="d-block h5 mb-0" x-text="fmt(jumlah) + ' ' + seri[pilih].satuan"></strong>
                    <span class="small text-body-secondary">total</span>
                </div>
                <div >
                    <strong class="d-block h5 mb-0" x-text="fmt(terakhir) + ' ' + seri[pilih].satuan"></strong>
                    <span class="small text-body-secondary">hari terakhir</span>
                </div>
            </div>
            <div class="tinggi-grafik tinggi-grafik--pendek">
                <canvas x-ref="kanvas" role="img" aria-label="Grafik pakan dan kematian per hari"></canvas>
            </div>
        
</div>
</section>
</div>
