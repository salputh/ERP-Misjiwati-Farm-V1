@php
    $langkah = [
        [
            'judul' => 'Selamat datang di Misjiwati Farm',
            'ringkasan' => 'Panduan ini menuntun Anda dari persiapan awal sampai penutupan periode. Ikuti urutannya agar data produksi dan keuangan saling terhubung.',
            'poin' => [
                'Gunakan tombol Berikutnya untuk melanjutkan dan Sebelumnya untuk kembali.',
                'Tautan di setiap langkah membuka halaman terkait.',
                'Pilih Hentikan panduan kapan saja; Anda tetap dapat membukanya kembali lewat tombol Panduan sistem.',
            ],
            'tautan' => null,
            'label_tautan' => null,
        ],
        [
            'judul' => 'Siapkan data dasar',
            'ringkasan' => 'Pastikan data yang dipakai sepanjang siklus sudah tersedia sebelum memasukkan transaksi.',
            'poin' => [
                'Periksa jenis pakan dan berat per zak untuk perhitungan stok dan konversi kilogram.',
                'Periksa harga kontrak dan data pemodal.',
                'Lengkapi data karyawan, controller, dan pemanen yang akan dipakai pada periode.',
            ],
            'tautan' => route('master-data'),
            'label_tautan' => 'Buka master data',
        ],
        [
            'judul' => 'Buat periode dan kandang',
            'ringkasan' => 'Periode adalah induk semua transaksi satu siklus. Data kandang dan DOC dicatat di dalam periode tersebut.',
            'poin' => [
                'Buat periode dengan nomor siklus, strain, tanggal chick-in, inti, PPL, dan status yang sesuai.',
                'Tambahkan kandang ke periode, lalu isi populasi, tanggal chick-in, berat dan harga DOC, serta bonus DOC per kandang.',
                'Pilih periode berjalan yang benar sebelum mulai mencatat transaksi.',
            ],
            'tautan' => route('periode.index'),
            'label_tautan' => 'Kelola periode dan kandang',
        ],
        [
            'judul' => 'Catat kegiatan harian',
            'ringkasan' => 'Laporan harian menjadi cara praktis memasukkan aktivitas pada satu tanggal; nilainya juga dipakai di halaman produksi lainnya.',
            'poin' => [
                'Isi pakan masuk per jenis serta kematian, afkir, ABW, pakan yang diberikan, dan catatan untuk setiap kandang.',
                'Gunakan tombol Tambah laporan untuk membuka formulir modal langsung dari halaman laporan.',
                'Periksa ringkasan ayam hidup, mortalitas, bobot, FCR, dan opname pakan setelah data disimpan.',
            ],
            'tautan' => route('laporan.harian'),
            'label_tautan' => 'Buka laporan harian',
        ],
        [
            'judul' => 'Pantau recording harian',
            'ringkasan' => 'Recording menyajikan data pemeliharaan per kandang dan umur ayam, termasuk nilai standar dan hasil aktual.',
            'poin' => [
                'Periksa mati, afkir, saldo ayam, pakan, ABW, pertambahan bobot, dan FCR.',
                'Input laporan harian memperbarui recording; hindari mencatat angka yang sama kembali di sumber lain.',
                'Gunakan ekspor bila perlu menyimpan atau membagikan lembar recording.',
            ],
            'tautan' => route('recording.harian'),
            'label_tautan' => 'Buka recording harian',
        ],
        [
            'judul' => 'Kelola pakan dan stok',
            'ringkasan' => 'Catat penerimaan pakan, lalu catat pemberiannya langsung pada kandang yang menerima.',
            'poin' => [
                'Pilih jenis pakan dan jumlah zak pada setiap penerimaan agar sisa stok per jenis dapat dihitung.',
                'Catat tanggal, kandang, jenis, dan jumlah zak untuk pemberian pakan.',
                'Sesuai alur kerja yang dipilih, pakan diberikan langsung per kandang; tidak ada langkah transfer gudang ke kandang.',
            ],
            'tautan' => route('pakan.log'),
            'label_tautan' => 'Buka pakan dan stok',
        ],
        [
            'judul' => 'Masukkan hasil sampling bobot',
            'ringkasan' => 'Sesi sampling menghitung ABW dari titik timbang dan menghubungkan hasilnya dengan performa kandang.',
            'poin' => [
                'Pilih periode, kandang, dan tanggal sampling.',
                'Isi sampel sesuai lantai, jenis kelamin, line, serta jumlah ekor per titik.',
                'Simpan dan periksa ABW hasil sampling pada sesi dan recording kandang.',
            ],
            'tautan' => route('sampling.bobot'),
            'label_tautan' => 'Buka sampling bobot',
        ],
        [
            'judul' => 'Catat panen',
            'ringkasan' => 'Setiap nota timbang mewakili satu perjalanan panen. Ringkasan periode dihitung dari nota yang tersimpan.',
            'poin' => [
                'Isi identitas nota, waktu timbang, jumlah krat, ekor, berat, netto, serta nama tukang tangkap.',
                'Periksa subtotal harian, total panen, bobot rata-rata, umur panen, FCR, dan IP pada rekap.',
                'Pastikan data nota benar sebelum dipakai dalam perhitungan hasil periode.',
            ],
            'tautan' => route('panen.rekap'),
            'label_tautan' => 'Buka rekap panen',
        ],
        [
            'judul' => 'Lanjutkan ke hasil dan keuangan',
            'ringkasan' => 'Setelah produksi dan panen tercatat, gunakan data periode untuk memeriksa hasil usaha dan menyelesaikan administrasi.',
            'poin' => [
                'Periksa atau lengkapi RHPP simulasi dan masukkan RHPP real saat dokumen resmi tersedia.',
                'Catat kas operasional per kandang, lalu periksa bagi hasil dan payroll ABK maupun pemanen.',
                'Tinjau kembali angka panen, biaya, pembagian, dan slip gaji sebelum periode ditutup.',
            ],
            'tautan' => route('rhpp'),
            'label_tautan' => 'Buka RHPP',
        ],
        [
            'judul' => 'Tinjau dan tutup periode',
            'ringkasan' => 'Penutupan adalah langkah akhir setelah administrasi dan dokumen hasil periode siap.',
            'poin' => [
                'Periksa data produksi, panen, RHPP, kas, bagi hasil, dan payroll.',
                'Periode hanya dapat ditutup RHPP setelah RHPP real tersedia.',
                'Periode yang sudah ditutup menjadi baca-saja sehingga transaksi historis tidak berubah tanpa sengaja.',
            ],
            'tautan' => route('periode.index'),
            'label_tautan' => 'Tinjau periode',
        ],
    ];
@endphp

<div class="panduan-sistem" x-data="panduanSistem(@js($langkah))">
    <button
        type="button"
        class="panduan-sistem__pemicu"
        x-show="!terbuka"
        x-cloak
        @click="buka"
        aria-label="Buka panduan penggunaan sistem">
        <i class="uil uil-question-circle" aria-hidden="true"></i>
        <span>Panduan sistem</span>
    </button>

    <div
        class="panduan-sistem__latar"
        x-show="terbuka"
        x-transition.opacity
        x-cloak
        @keydown.escape.window.prevent="hentikan">
        <section
            class="panduan-sistem__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panduan-sistem-judul"
            tabindex="-1">
            <header class="panduan-sistem__kepala">
                <div>
                    <span class="panduan-sistem__eyebrow">PANDUAN PENGGUNAAN</span>
                    <p class="panduan-sistem__progres" x-text="`Langkah ${indeks + 1} dari ${langkah.length}`"></p>
                </div>
                <button type="button" class="panduan-sistem__hentikan" @click="hentikan">
                    Hentikan panduan
                </button>
            </header>

            <div class="panduan-sistem__batang" aria-hidden="true">
                <span :style="`width: ${((indeks + 1) / langkah.length) * 100}%`"></span>
            </div>

            <main class="panduan-sistem__isi" aria-live="polite">
                <span class="panduan-sistem__nomor" x-text="String(indeks + 1).padStart(2, '0')"></span>
                <h2 id="panduan-sistem-judul" x-text="langkah[indeks].judul"></h2>
                <p class="panduan-sistem__ringkasan" x-text="langkah[indeks].ringkasan"></p>
                <ul>
                    <template x-for="(poin, nomor) in langkah[indeks].poin" :key="`${indeks}-${nomor}`">
                        <li x-text="poin"></li>
                    </template>
                </ul>
                <a
                    class="panduan-sistem__tautan"
                    x-show="langkah[indeks].tautan"
                    :href="langkah[indeks].tautan"
                    @click="hentikan"
                    x-text="langkah[indeks].label_tautan"></a>
                <p class="panduan-sistem__peringatan" x-show="gagalMenyimpan" role="status">
                    Preferensi panduan tidak dapat disimpan di browser ini. Panduan mungkin muncul lagi setelah halaman dimuat ulang.
                </p>
            </main>

            <footer class="panduan-sistem__kaki">
                <button type="button" class="panduan-sistem__sebelumnya" @click="sebelumnya" x-show="indeks > 0">
                    <i class="uil uil-arrow-left" aria-hidden="true"></i>
                    Sebelumnya
                </button>
                <span class="panduan-sistem__spacer" x-show="indeks === 0"></span>
                <button type="button" class="panduan-sistem__berikutnya" @click="berikutnya">
                    <span x-text="indeks === langkah.length - 1 ? 'Selesai' : 'Berikutnya'"></span>
                    <i class="uil" :class="indeks === langkah.length - 1 ? 'uil-check' : 'uil-arrow-right'" aria-hidden="true"></i>
                </button>
            </footer>
        </section>
    </div>
</div>
