// Komponen Alpine untuk dashboard. Alpine dibawa Livewire; Chart.js dibawa template Basalt (assets/vendor/chart.js).

import { gambarLaporan } from './gambar-laporan';
import { gambarPayroll } from './gambar-payroll';
import { gambarPanen } from './gambar-panen';
import { gambarSampling } from './gambar-sampling';
import { animate, stagger } from 'motion';
import { berkasPng, muatHuruf } from './kanvas';
import { tangkapHalaman, unduhPdf, unduhPng } from './halaman';

// Warna grafik dibaca dari token palet Basalt, sehingga ikut berganti saat palet atau mode terang/gelap diubah (event basalt:appearance).
const warnaGrafik = () => ({
    utama: window.Basalt.token('--basalt-hue', '#6d3fe0'),
    info: window.Basalt.series(2, 0, '#2f8fd8'),
    bahaya: window.Basalt.token('--basalt-danger', '#d93a4a'),
    jantan: window.Basalt.series(4, 0, '#5840ff'),
    betina: window.Basalt.series(7, 0, '#fa8b0c'),
    teks: window.Basalt.token('--basalt-copy-muted', '#6e6790'),
    garis: window.Basalt.token('--basalt-edge', '#e7e4f0'),
});

const angka = (nilai, desimal = 0) =>
    Number(nilai).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });

// Spring kartu buka-tutup: kaku dan tegas, menetap dalam sekitar 0,25 detik dengan sedikit pantulan.
const PEGAS_KARTU = { type: 'spring', stiffness: 900, damping: 42, mass: 1 };

// Kartu muncul dari sedikit mengecil dan turun, lalu menetap dengan spring. Dilewati bila pengguna meminta gerak dikurangi.
const bukaKartu = (kartu) => {
    if (!kartu || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    animate(kartu, { transform: ['translateY(12px) scale(0.96)', 'translateY(0px) scale(1)'] }, PEGAS_KARTU);
};

// Semua modal Bootstrap: kartu dialognya dibuka dengan spring yang sama.
document.addEventListener('show.bs.modal', (event) => bukaKartu(event.target.querySelector('.modal-dialog')));

// Tinggi memakai kekakuan yang sama tetapi teredam penuh (damping 2·√(stiffness·mass)), agar tidak melampaui tinggi isi dan meninggalkan ruang kosong.
const PEGAS_TINGGI = { ...PEGAS_KARTU, damping: 60 };

const digit = (nilai) => String(nilai ?? '').replace(/\D/g, '');
// Angka bulat dengan pemisah ribuan: kosong tetap kosong.
const ribuan = (nilai, pemisah = '.') => digit(nilai).replace(/\B(?=(\d{3})+(?!\d))/g, pemisah);

// Angka dari server (1530.25, "1530.25", "125000") menjadi tampilan dengan pemisah ribuan: "1.530,25".
// Mode bulat (desimal 0) membuang pecahannya.
const tampilAngka = (nilai, pemisah = '.', desimal = 0) => {
    if (nilai === null || nilai === undefined || nilai === '') {
        return '';
    }

    const [bulat, pecahan = ''] = String(nilai).split('.');
    const tampil = ribuan(bulat, pemisah);

    return desimal > 0 && digit(pecahan) !== '' ? `${tampil || '0'},${digit(pecahan).slice(0, desimal)}` : tampil;
};

// Ketikan pengguna menjadi { tampil, mesin }: "1.530,5" menjadi tampil "1.530,5" dan mesin "1530.5".
// Koma adalah pemisah desimal; titik adalah pemisah ribuan. Hanya bila titikDesimal (titik baru saja diketik,
// karena keypad HP sering tidak punya koma), titik terakhir yang diikuti paling banyak `desimal` digit dibaca
// sebagai koma. Titik sisa pemisah ribuan, mis. "1.53" setelah satu angka dari "1.530" dihapus, tetap ribuan.
const bacaKetikan = (teks, pemisah = '.', desimal = 0, titikDesimal = false) => {
    const isi = String(teks ?? '');
    let posisiDesimal = -1;

    if (desimal > 0) {
        posisiDesimal = isi.lastIndexOf(',');
        if (posisiDesimal < 0 && titikDesimal) {
            const titikDiAkhir = isi.match(new RegExp(`\\.(\\d{0,${desimal}})$`));
            if (titikDiAkhir) {
                posisiDesimal = isi.length - titikDiAkhir[0].length;
            }
        }
    }

    const bulat = digit(posisiDesimal < 0 ? isi : isi.slice(0, posisiDesimal)).replace(/^0+(?=\d)/, '');
    const pecahan = posisiDesimal < 0 ? null : digit(isi.slice(posisiDesimal + 1)).slice(0, desimal);
    const tampilBulat = ribuan(bulat, pemisah);

    return {
        tampil: pecahan === null ? tampilBulat : `${tampilBulat || '0'},${pecahan}`,
        mesin: bulat === '' && !pecahan ? '' : `${bulat || '0'}${pecahan ? `.${pecahan}` : ''}`,
    };
};

// Dua nilai angka sama: keduanya kosong, atau nilainya sama walau ditulis beda ("1530.50" dan 1530.5).
const samaAngka = (a, b) => {
    const kosong = (nilai) => nilai === null || nilai === undefined || nilai === '';

    return kosong(a) || kosong(b) ? kosong(a) && kosong(b) : Number(a) === Number(b);
};

// Simpan satu lembar sebagai PNG atau salin ke clipboard untuk ditempel di chat; gambar(lembar) melukis kanvasnya.
// Data dibaca dari data-lembar saat tombol ditekan, karena Livewire menggantinya tiap lembar lain dibuka.
const eksporGambar = (gambar) => () => ({
    statusSalin: '',

    get labelSalin() {
        return { tersalin: 'Tersalin', gagal: 'Gagal menyalin' }[this.statusSalin] ?? 'Salin PNG';
    },

    init() {
        muatHuruf();
    },

    lembar() {
        return JSON.parse(this.$root.dataset.lembar);
    },

    unduh(berkas) {
        const tautan = document.createElement('a');
        tautan.href = URL.createObjectURL(berkas);
        tautan.download = berkas.name;
        tautan.click();
        setTimeout(() => URL.revokeObjectURL(tautan.href), 1000);
    },

    simpan() {
        const lembar = this.lembar();
        this.unduh(berkasPng(gambar(lembar), lembar.berkas));
    },

    async salin() {
        const lembar = this.lembar();
        const berkas = berkasPng(gambar(lembar), lembar.berkas);

        try {
            // Clipboard hanya tersedia di HTTPS atau localhost.
            await navigator.clipboard.write([new ClipboardItem({ [berkas.type]: berkas })]);
            this.statusSalin = 'tersalin';
        } catch {
            this.statusSalin = 'gagal';
        }
        setTimeout(() => (this.statusSalin = ''), 2500);
    },
});

document.addEventListener('alpine:init', () => {
    Alpine.data('panduanSistem', (langkah) => ({
        langkah,
        indeks: 0,
        terbuka: false,
        gagalMenyimpan: false,
        kunciPenyimpanan: 'misjiwati-farm-panduan-sistem-v1',

        init() {
            try {
                this.terbuka = window.localStorage.getItem(this.kunciPenyimpanan) !== 'selesai';
            } catch (error) {
                console.warn('Preferensi panduan sistem tidak dapat dibaca dari penyimpanan browser.', error);
                this.gagalMenyimpan = true;
                this.terbuka = true;
            }

            this.$watch('terbuka', (nilai) => nilai && this.$nextTick(() => bukaKartu(this.$el.querySelector('.panduan-sistem__dialog'))));
            if (this.terbuka) {
                this.$nextTick(() => bukaKartu(this.$el.querySelector('.panduan-sistem__dialog')));
            }
        },

        buka() {
            this.indeks = 0;
            this.terbuka = true;
        },

        sebelumnya() {
            this.indeks = Math.max(0, this.indeks - 1);
        },

        berikutnya() {
            if (this.indeks === this.langkah.length - 1) {
                this.hentikan();
                return;
            }

            this.indeks++;
        },

        hentikan() {
            this.terbuka = false;

            try {
                window.localStorage.setItem(this.kunciPenyimpanan, 'selesai');
                this.gagalMenyimpan = false;
            } catch (error) {
                console.warn('Preferensi panduan sistem tidak dapat disimpan di penyimpanan browser.', error);
                this.gagalMenyimpan = true;
            }
        },
    }));

    // Kartu yang bisa dilipat: isi membuka dan menutup dengan spring. Tombol pemicu memanggil alihkan().
    Alpine.data('kartuLipat', (terbukaAwal = true) => ({
        terbuka: terbukaAwal,
        bergerak: false,

        async alihkan() {
            if (this.bergerak) {
                return;
            }

            const isi = this.$refs.isi;
            const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.bergerak = true;

            if (this.terbuka) {
                if (!kurangiGerak) {
                    await animate(isi, { height: [`${isi.scrollHeight}px`, '0px'], opacity: [1, 0] }, PEGAS_TINGGI);
                }
                this.terbuka = false;
            } else {
                this.terbuka = true;
                await this.$nextTick();
                if (!kurangiGerak) {
                    await animate(isi, { height: ['0px', `${isi.scrollHeight}px`], opacity: [0, 1] }, PEGAS_TINGGI);
                }
            }

            isi.style.height = '';
            isi.style.opacity = '';
            this.bergerak = false;
        },
    }));

    // Kartu dashboard muncul berurutan, naik tipis sambil memudar. Hanya saat halaman dibuka, bukan tiap Livewire memperbarui.
    Alpine.data('masukBerurutan', () => ({
        init() {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            animate(
                this.$el.querySelectorAll(':scope > .row > [class*="col-"]'),
                { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0px)'] },
                { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: stagger(0.035) },
            );
        },
    }));

    // Bobot aktual terhadap standar strain, bisa dipilih per kandang.
    Alpine.data('grafikBobot', (data) => ({
        data,
        pilih: 'semua',
        fmt: angka,

        get seri() {
            return this.data.bobot[this.pilih];
        },
        get akhir() {
            return this.seri.data.length - 1;
        },
        get selisih() {
            if (this.akhir < 0) return null;
            const standar = this.data.standar[this.akhir];
            return ((this.seri.data[this.akhir] - standar) / standar) * 100;
        },
        // Timbang sexing terakhir satu kelamin pada kandang terpilih: { umur, gram } atau null.
        sexingTerakhir(kelamin) {
            const data = this.seri.sexing?.[kelamin] ?? [];
            const umur = data.findLastIndex((gram) => gram !== null);
            return umur < 0 ? null : { umur, gram: data[umur] };
        },

        init() {
            const WARNA = warnaGrafik();
            // Instance Chart disimpan di elemen, bukan di state Alpine, agar tidak dibungkus proxy.
            this.$refs.kanvas.grafik = new Chart(this.$refs.kanvas, {
                type: 'line',
                data: {
                    labels: this.data.hari,
                    datasets: [
                        { label: 'Aktual', data: this.seri.data, borderColor: WARNA.utama, backgroundColor: window.Basalt.shade(WARNA.utama, 0.85), fill: true, tension: 0.3, borderWidth: 3, pointRadius: 0, pointHoverRadius: 5 },
                        { label: 'Standar', data: this.data.standar, borderColor: WARNA.info, borderDash: [5, 5], borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
                        // Sexing hanya ada di hari sampling, jadi titiknya ditampilkan dan disambung melewati hari kosong.
                        this.dataSexing('Jantan', 'jantan', WARNA.jantan),
                        this.dataSexing('Betina', 'betina', WARNA.betina),
                    ],
                },
                options: {
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            // Hari tanpa timbang sexing tidak dimunculkan di tooltip.
                            filter: (item) => item.parsed.y !== null,
                            callbacks: {
                                title: (item) => 'Hari ke-' + item[0].label,
                                label: (item) => item.dataset.label + ': ' + angka(item.parsed.y) + ' g',
                            },
                        },
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: WARNA.teks, maxTicksLimit: 8, maxRotation: 0 }, title: { display: true, text: 'Umur (hari)', color: WARNA.teks } },
                        y: { beginAtZero: true, grid: { color: WARNA.garis }, ticks: { color: WARNA.teks, callback: (nilai) => angka(nilai) + ' g' } },
                    },
                },
            });
            document.addEventListener('basalt:appearance', () => this.warnai());
        },

        warnai() {
            const WARNA = warnaGrafik();
            const grafik = this.$refs.kanvas.grafik;
            const [aktual, standar, jantan, betina] = grafik.data.datasets;
            Object.assign(aktual, { borderColor: WARNA.utama, backgroundColor: window.Basalt.shade(WARNA.utama, 0.85) });
            standar.borderColor = WARNA.info;
            Object.assign(jantan, { borderColor: WARNA.jantan, backgroundColor: WARNA.jantan });
            Object.assign(betina, { borderColor: WARNA.betina, backgroundColor: WARNA.betina });
            grafik.options.scales.x.ticks.color = grafik.options.scales.x.title.color = grafik.options.scales.y.ticks.color = WARNA.teks;
            grafik.options.scales.y.grid.color = WARNA.garis;
            grafik.update();
        },

        dataSexing(label, kelamin, warna) {
            return { label, data: this.seri.sexing?.[kelamin] ?? [], borderColor: warna, backgroundColor: warna, borderWidth: 2, tension: 0.3, spanGaps: true, pointRadius: 3, pointHoverRadius: 5 };
        },

        ganti(kode) {
            this.pilih = kode;
            const grafik = this.$refs.kanvas.grafik;
            grafik.data.datasets[0].data = this.seri.data;
            grafik.data.datasets[2].data = this.seri.sexing?.jantan ?? [];
            grafik.data.datasets[3].data = this.seri.sexing?.betina ?? [];
            grafik.update();
        },
    }));

    // Pakan dan kematian per hari.
    Alpine.data('grafikHarian', (data) => ({
        data,
        pilih: 'pakan',
        seri: {
            pakan: { label: 'Pakan', satuan: 'kg', warna: '' },
            kematian: { label: 'Mati dan afkir', satuan: 'ekor', warna: '' },
        },
        fmt: (nilai) => angka(Math.round(nilai)),

        get jumlah() {
            return this.data[this.pilih].reduce((total, nilai) => total + nilai, 0);
        },
        get terakhir() {
            return this.data[this.pilih].at(-1) ?? 0;
        },

        init() {
            const WARNA = warnaGrafik();
            this.seri.pakan.warna = WARNA.utama;
            this.seri.kematian.warna = WARNA.bahaya;
            this.$refs.kanvas.grafik = new Chart(this.$refs.kanvas, {
                type: 'bar',
                data: {
                    labels: this.data.umur,
                    datasets: [{ data: this.data.pakan, backgroundColor: this.seri.pakan.warna, borderRadius: 3, maxBarThickness: 10 }],
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (item) => 'Hari ke-' + item[0].label,
                                label: (item) => angka(Math.round(item.parsed.y)) + ' ' + this.seri[this.pilih].satuan,
                            },
                        },
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: WARNA.teks, maxTicksLimit: 6, maxRotation: 0 } },
                        y: { beginAtZero: true, grid: { color: WARNA.garis }, ticks: { color: WARNA.teks, callback: (nilai) => angka(nilai) } },
                    },
                },
            });
            document.addEventListener('basalt:appearance', () => this.warnai());
        },

        warnai() {
            const WARNA = warnaGrafik();
            this.seri.pakan.warna = WARNA.utama;
            this.seri.kematian.warna = WARNA.bahaya;
            const grafik = this.$refs.kanvas.grafik;
            grafik.data.datasets[0].backgroundColor = this.seri[this.pilih].warna;
            grafik.options.scales.x.ticks.color = grafik.options.scales.y.ticks.color = WARNA.teks;
            grafik.options.scales.y.grid.color = WARNA.garis;
            grafik.update();
        },

        ganti(kunci) {
            this.pilih = kunci;
            const grafik = this.$refs.kanvas.grafik;
            grafik.data.datasets[0].data = this.data[kunci];
            grafik.data.datasets[0].backgroundColor = this.seri[kunci].warna;
            grafik.update();
        },
    }));

    // Saringan tabel performa kandang berdasarkan status bobot.
    Alpine.data('saringKandang', (daftarStatus) => ({
        saring: 'semua',

        tampil(status) {
            if (this.saring === 'semua') return true;
            if (this.saring === 'sesuai') return status === 'baik';
            return status === 'waspada' || status === 'buruk';
        },
        get kosong() {
            return !daftarStatus.some((status) => this.tampil(status));
        },
    }));

    // Saringan nota panen per hari panen; 0 berarti semua hari.
    Alpine.data('saringHari', () => ({
        hari: 0,
        statusSalin: '',
        menyalin: false,

        tampil(nomor) {
            return this.hari === 0 || this.hari === nomor;
        },

        async salinGambar(tabel) {
            this.menyalin = true;

            try {
                const gambar = gambarPanen(tabel);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': gambar })]);
                this.statusSalin = 'Gambar tersalin';
            } catch (error) {
                console.error('Gagal menyalin tabel nota panen sebagai gambar.', error);
                this.statusSalin = 'Gagal menyalin gambar';
            } finally {
                this.menyalin = false;
                setTimeout(() => (this.statusSalin = ''), 2500);
            }
        },
    }));

    // Pemilih tanggal Basalt (assets/basalt/js/components/datepicker.js). Tanggal Y-m-d dibaca dari data-nilai
    // dan dikirim lewat event tanggal-dipilih saat pengguna memilih atau mengetik tanggal baru.
    Alpine.data('pilihTanggal', () => ({
        init() {
            const nilai = this.$el.dataset.nilai || '';
            window.Basalt.datepicker.init(this.$el);
            window.Basalt.datepicker.set(this.$el, nilai);
            this.$el.addEventListener('change', (event) => {
                if (event.target !== this.$el || event.detail === undefined) return;
                const dipilih = event.detail.value || '';
                if (dipilih && dipilih !== nilai) this.$dispatch('tanggal-dipilih', dipilih);
            });
        },
    }));

    // Tombol dropdown isian form (x-pilih bentuk="isian"). Popper memakai posisi fixed supaya menu tidak terpotong
    // modal yang pendek atau bisa digulir; karena persentase tidak berlaku untuk elemen fixed, lebar menu disamakan
    // dengan tombol setiap kali dibuka.
    Alpine.data('pilihIsian', () => ({
        init() {
            window.bootstrap.Dropdown.getOrCreateInstance(this.$el, { popperConfig: { strategy: 'fixed' } });
            this.$el.addEventListener('show.bs.dropdown', () => {
                this.$el.nextElementSibling.style.minWidth = `${this.$el.offsetWidth}px`;
            });
        },

        destroy() {
            window.bootstrap.Dropdown.getInstance(this.$el)?.dispose();
        },
    }));

    // Pemilih tanggal dan jam (x-pilih-waktu): tanggal memakai datepicker Basalt dan jam memakai input type="time".
    // Nilai berformat Y-m-dTH:i; begitu tanggal dan jam terisi, nilai gabungannya dikirim lewat event "waktu-dipilih".
    Alpine.data('pilihWaktu', () => ({
        tanggal: '',
        jam: '',

        init() {
            const [tanggal = '', jam = ''] = (this.$el.dataset.nilai || '').split('T');
            this.tanggal = tanggal;
            this.jam = jam;

            window.Basalt.datepicker.init(this.$refs.tanggal);
            window.Basalt.datepicker.set(this.$refs.tanggal, tanggal);
            this.$refs.tanggal.addEventListener('change', (event) => {
                this.tanggal = event.detail?.value || '';
                this.kirim();
            });
            this.$refs.jam.addEventListener('change', () => {
                this.jam = this.$refs.jam.value;
                this.kirim();
            });
        },

        kirim() {
            const nilai = `${this.tanggal}T${this.jam}`;
            if (this.tanggal && this.jam && nilai !== this.$el.dataset.nilai) this.$dispatch('waktu-dipilih', nilai);
        },
    }));

    // Isian angka yang tampil dengan pemisah ribuan selagi diketik (x-masukan.ribuan). Pengganti wire:model.blur:
    // properti Livewire menerima angka mentahnya saat isian ditinggalkan atau Enter ditekan.
    // opsi.desimal: jumlah digit desimal yang boleh diketik (koma desimal gaya Indonesia, 1.530,25); 0 untuk bulat.
    // opsi.teks: kirim sebagai teks ('' bila kosong) untuk properti Livewire bertipe string; tanpanya dikirim
    // sebagai angka atau null.
    Alpine.data('isianRibuan', (properti, pemisah = '.', kursorDiAkhir = false, opsi = {}) => {
        const desimal = opsi.desimal ?? 0;
        const sebagaiTeks = opsi.teks ?? false;

        return {
            init() {
                this.$el.value = tampilAngka(this.$wire.$get(properti), pemisah, desimal);
                // Nilai yang diganti server (mis. data lain dimuat) ditampilkan ulang, kecuali isian sedang diketik
                // dan nilainya sama, supaya koma desimal yang baru diketik tidak hilang.
                this.$watch(() => this.$wire.$get(properti), (nilai) => {
                    if (document.activeElement === this.$el && samaAngka(bacaKetikan(this.$el.value, pemisah, desimal).mesin, nilai)) {
                        return;
                    }
                    this.$el.value = tampilAngka(nilai, pemisah, desimal);
                });
            },

            format(event) {
                const isian = this.$el;
                const sebelumKursor = isian.value.slice(0, isian.selectionStart);
                const digitSebelumKursor = digit(sebelumKursor).length;
                // Titik dibaca sebagai koma desimal hanya bila baru diketik, atau ditempel dalam format mesin (1530.25).
                const titikDesimal = event?.data === '.'
                    || (event?.inputType === 'insertFromPaste' && new RegExp(`^\\d+\\.\\d{1,${desimal}}$`).test(isian.value.trim()));
                isian.value = bacaKetikan(isian.value, pemisah, desimal, titikDesimal).tampil;

                if (kursorDiAkhir) {
                    isian.setSelectionRange(isian.value.length, isian.value.length);
                    return;
                }

                // Kursor dikembalikan ke posisi digit yang sama, karena pemisah yang bertambah menggeser letaknya.
                let posisi = 0;
                for (let terlewati = 0; posisi < isian.value.length && terlewati < digitSebelumKursor; posisi++) {
                    if (/\d/.test(isian.value[posisi])) terlewati++;
                }
                // Koma desimal yang baru diketik: kursor diletakkan sesudahnya.
                if (desimal > 0 && /[.,]$/.test(sebelumKursor) && isian.value.includes(',')) {
                    posisi = Math.max(posisi, isian.value.indexOf(',') + 1);
                }
                isian.setSelectionRange(posisi, posisi);
            },

            // rapikan === true saat isian ditinggalkan: tampilan dibersihkan, mis. koma tanpa angka di belakangnya.
            kirim(rapikan = false) {
                const mesin = bacaKetikan(this.$el.value, pemisah, desimal).mesin;
                if (rapikan === true) {
                    this.$el.value = tampilAngka(mesin, pemisah, desimal);
                }
                if (samaAngka(mesin, this.$wire.$get(properti))) {
                    return;
                }

                this.$wire.$set(properti, sebagaiTeks ? mesin : (mesin === '' ? null : Number(mesin)));
            },
        };
    });

    Alpine.data('eksporSampling', eksporGambar(gambarSampling));
    Alpine.data('eksporLaporan', eksporGambar(gambarLaporan));
    Alpine.data('eksporPayroll', eksporGambar(gambarPayroll));

    // Potret halaman apa adanya menjadi PNG, supaya hasilnya sama persis dengan yang di layar.
    Alpine.data('eksporHalaman', (selector, nama) => ({
        selector,
        nama,
        sibuk: false,
        gagal: false,

        simpan() {
            return this.ekspor(unduhPng, 'PNG');
        },

        simpanPdf() {
            return this.ekspor(unduhPdf, 'PDF');
        },

        async ekspor(unduh, format) {
            this.sibuk = true;
            this.gagal = false;

            try {
                const kanvas = await tangkapHalaman(this.selector);
                await unduh(kanvas, this.nama);
            } catch (error) {
                console.error(`Gagal memotret halaman untuk ekspor ${format}.`, error);
                this.gagal = true;
            } finally {
                this.sibuk = false;
            }
        },
    }));
});
