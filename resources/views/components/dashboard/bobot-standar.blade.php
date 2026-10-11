@props(['grafik'])

{{-- Bobot aktual terhadap standar (HexaDash demo one: sales reports). Logika grafik: resources/js/app.js --}}
<div class="col-xxl-6 mb-25" wire:ignore x-data="grafikBobot(@js($grafik))">
    <div class="card border-0 h-100">
        <div class="card-header border-0 pb-md-0 pb-20">
            <h4>Bobot terhadap standar</h4>
            <div class="card-extra">
                <ul class="card-tab-links nav-tabs nav" role="tablist">
                    <template x-for="(isi, kode) in data.bobot" :key="kode">
                        <li>
                            <a href="#" role="tab" :class="pilih === kode && 'active'" :aria-selected="pilih === kode" @click.prevent="ganti(kode)" x-text="isi.label"></a>
                        </li>
                    </template>
                </ul>
            </div>
        </div>
        <div class="card-body pt-0 pb-25">
            <div class="label-detailed">
                <div class="label-detailed__single">
                    <span class="label-detailed__type label-detailed__type--primary">Aktual</span>
                    <strong class="label-detailed__total" x-text="akhir < 0 ? '-' : fmt(seri.data[akhir]) + ' g'"></strong>
                    <template x-if="selisih !== null">
                        <span class="label-detailed__status" :class="selisih >= 0 ? 'color-success' : 'color-danger'">
                            <i class="las" :class="selisih >= 0 ? 'la-arrow-up' : 'la-arrow-down'"></i>
                            <strong x-text="fmt(Math.abs(selisih), 1) + '%'"></strong>
                        </span>
                    </template>
                </div>
                <div class="label-detailed__single">
                    <span class="label-detailed__type label-detailed__type--info">Standar</span>
                    <strong class="label-detailed__total" x-text="akhir < 0 ? '-' : fmt(data.standar[akhir]) + ' g'"></strong>
                </div>
            </div>
            <div class="tinggi-grafik">
                <canvas x-ref="kanvas" role="img" aria-label="Grafik bobot aktual terhadap standar strain per hari"></canvas>
            </div>
        </div>
    </div>
</div>
