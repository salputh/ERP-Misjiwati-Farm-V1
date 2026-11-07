{{-- Panduan penggunaan pertama. Isinya dari App\Support\PanduanSistem; logika langkah di Alpine panduanSistem (resources/js/app.js).
     Tampilannya memakai bagian template: tombol rounded, kartu , progress bar, dan tombol modal. --}}
<div class="panduan-sistem" x-data="panduanSistem(@js(\App\Support\PanduanSistem::langkah()))">
    <button
        type="button"
        class="panduan-sistem__pemicu btn btn-primary"
        x-show="!terbuka"
        x-cloak
        @click="buka"
        aria-label="Buka panduan penggunaan sistem">
        <i class="bi bi-question-circle me-2" aria-hidden="true"></i>Panduan sistem
    </button>

    <div
        class="panduan-sistem__latar"
        x-show="terbuka"
        x-transition.opacity
        x-cloak
        @keydown.escape.window.prevent="hentikan">
        <section
            class="panduan-sistem__dialog card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panduan-sistem-judul"
            tabindex="-1">
            <div class="card-header">
                <div>
                    <h6>Panduan penggunaan</h6>
                    <span class="d-block small text-body-secondary fw-normal tanpa-kapital" x-text="`Langkah ${indeks + 1} dari ${langkah.length}`"></span>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-2">
                    <button type="button" class="btn btn-light btn-sm" @click="hentikan">Hentikan panduan</button>
                </div>
            </div>

            <div class="progress rounded-0" role="progressbar" aria-label="Kemajuan panduan" :aria-valuenow="indeks + 1" aria-valuemin="1" :aria-valuemax="langkah.length">
                <div class="progress-bar bg-primary share-dinamis" :style="{ '--share': (((indeks + 1) / langkah.length) * 100) + '%' }"></div>
            </div>

            <div class="card-body panduan-sistem__isi" aria-live="polite">
                <span class="badge bg-primary-subtle text-primary ms-0" x-text="String(indeks + 1).padStart(2, '0')"></span>
                <h4 id="panduan-sistem-judul" class="mt-2 mb-3" x-text="langkah[indeks].judul"></h4>
                <p class="text-body-secondary mb-3" x-text="langkah[indeks].ringkasan"></p>
                <ul class="list-group list-group-flush">
                        <template x-for="(poin, nomor) in langkah[indeks].poin" :key="`${indeks}-${nomor}`">
                            <li class="list-group-item" x-text="poin"></li>
                        </template>
                    </ul>
                <a
                    class="btn btn-outline-primary text-primary btn-sm mt-3"
                    x-show="langkah[indeks].tautan"
                    :href="langkah[indeks].tautan"
                    @click="hentikan"
                    x-text="langkah[indeks].label_tautan"></a>
                <p class="small text-warning mt-3 mb-0" x-show="gagalMenyimpan" role="status">
                    Preferensi panduan tidak dapat disimpan di browser ini. Panduan mungkin muncul lagi setelah halaman dimuat ulang.
                </p>
            </div>

            <div class="modal-footer justify-content-between">
                <button type="button" class="btn btn-light btn-sm" @click="sebelumnya" x-show="indeks > 0">
                    <i class="bi bi-arrow-left me-2" aria-hidden="true"></i>Sebelumnya
                </button>
                <span x-show="indeks === 0"></span>
                <button type="button" class="btn btn-primary btn-sm" @click="berikutnya">
                    <b class="fw-semibold" x-text="indeks === langkah.length - 1 ? 'Selesai' : 'Berikutnya'"></b>
                    <i class="bi ms-2 me-0" :class="indeks === langkah.length - 1 ? 'bi-check-lg' : 'bi-arrow-right'" aria-hidden="true"></i>
                </button>
            </div>
        </section>
    </div>
</div>
