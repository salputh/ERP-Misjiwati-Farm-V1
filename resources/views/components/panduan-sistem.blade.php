{{-- Panduan penggunaan pertama. Isinya dari App\Support\PanduanSistem; logika langkah di Alpine panduanSistem (resources/js/app.js).
     Tampilannya memakai bagian template: tombol rounded, kartu card-default, progress bar, dan tombol modal. --}}
<div class="panduan-sistem" x-data="panduanSistem(@js(\App\Support\PanduanSistem::langkah()))">
    <button
        type="button"
        class="panduan-sistem__pemicu btn btn-primary btn-default btn-rounded"
        x-show="!terbuka"
        x-cloak
        @click="buka"
        aria-label="Buka panduan penggunaan sistem">
        <i class="uil uil-question-circle" aria-hidden="true"></i>Panduan sistem
    </button>

    <div
        class="panduan-sistem__latar"
        x-show="terbuka"
        x-transition.opacity
        x-cloak
        @keydown.escape.window.prevent="hentikan">
        <section
            class="panduan-sistem__dialog card card-default card-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panduan-sistem-judul"
            tabindex="-1">
            <div class="card-header">
                <div>
                    <h6>Panduan penggunaan</h6>
                    <span class="d-block fs-13 color-light fw-400 tanpa-kapital" x-text="`Langkah ${indeks + 1} dari ${langkah.length}`"></span>
                </div>
                <div class="card-extra">
                    <button type="button" class="btn btn-light btn-outlined btn-sm" @click="hentikan">Hentikan panduan</button>
                </div>
            </div>

            <div class="progress rounded-0" role="progressbar" aria-label="Kemajuan panduan" :aria-valuenow="indeks + 1" aria-valuemin="1" :aria-valuemax="langkah.length">
                <div class="progress-bar bg-primary" :style="`width: ${((indeks + 1) / langkah.length) * 100}%`"></div>
            </div>

            <div class="card-body panduan-sistem__isi" aria-live="polite">
                <span class="dm-tag tag-primary tag-transparented ms-0" x-text="String(indeks + 1).padStart(2, '0')"></span>
                <h4 id="panduan-sistem-judul" class="mt-10 mb-15" x-text="langkah[indeks].judul"></h4>
                <p class="fs-15 color-gray mb-20" x-text="langkah[indeks].ringkasan"></p>
                <div class="list-box">
                    <ul>
                        <template x-for="(poin, nomor) in langkah[indeks].poin" :key="`${indeks}-${nomor}`">
                            <li class="list-box__item" x-text="poin"></li>
                        </template>
                    </ul>
                </div>
                <a
                    class="btn btn-outline-primary color-primary btn-sm btn-squared mt-20"
                    x-show="langkah[indeks].tautan"
                    :href="langkah[indeks].tautan"
                    @click="hentikan"
                    x-text="langkah[indeks].label_tautan"></a>
                <p class="fs-13 color-warning mt-15 mb-0" x-show="gagalMenyimpan" role="status">
                    Preferensi panduan tidak dapat disimpan di browser ini. Panduan mungkin muncul lagi setelah halaman dimuat ulang.
                </p>
            </div>

            <div class="modal-footer justify-content-between">
                <button type="button" class="btn btn-light btn-outlined btn-sm" @click="sebelumnya" x-show="indeks > 0">
                    <i class="uil uil-arrow-left" aria-hidden="true"></i>Sebelumnya
                </button>
                <span x-show="indeks === 0"></span>
                <button type="button" class="btn btn-primary btn-sm" @click="berikutnya">
                    <b class="fw-600" x-text="indeks === langkah.length - 1 ? 'Selesai' : 'Berikutnya'"></b>
                    <i class="uil ms-2 me-0" :class="indeks === langkah.length - 1 ? 'uil-check' : 'uil-arrow-right'" aria-hidden="true"></i>
                </button>
            </div>
        </section>
    </div>
</div>
