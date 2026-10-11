@props(['grafik'])

{{-- Pakan dan kematian harian (HexaDash demo one: sales growth). Logika grafik: resources/js/app.js --}}
<div class="col-xxl-4 mb-25" wire:ignore x-data="grafikHarian(@js($grafik))">
    <div class="card border-0 px-25 h-100">
        <div class="card-header px-0 border-0">
            <h6>Harian</h6>
            <div class="card-extra">
                <ul class="card-tab-links nav-tabs nav" role="tablist">
                    <template x-for="(isi, kunci) in seri" :key="kunci">
                        <li>
                            <a href="#" role="tab" :class="pilih === kunci && 'active'" :aria-selected="pilih === kunci" @click.prevent="ganti(kunci)" x-text="isi.label"></a>
                        </li>
                    </template>
                </ul>
            </div>
        </div>
        <div class="card-body p-0 pb-25">
            <div class="label-detailed label-detailed--two">
                <div class="label-detailed__single">
                    <strong class="label-detailed__total" x-text="fmt(jumlah) + ' ' + seri[pilih].satuan"></strong>
                    <span class="label-detailed__status color-gray">total</span>
                </div>
                <div class="label-detailed__single">
                    <strong class="label-detailed__total" x-text="fmt(terakhir) + ' ' + seri[pilih].satuan"></strong>
                    <span class="label-detailed__status color-gray">hari terakhir</span>
                </div>
            </div>
            <div class="tinggi-grafik tinggi-grafik--pendek">
                <canvas x-ref="kanvas" role="img" aria-label="Grafik pakan dan kematian per hari"></canvas>
            </div>
        </div>
    </div>
</div>
