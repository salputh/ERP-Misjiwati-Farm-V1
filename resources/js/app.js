// Komponen Alpine untuk dashboard. Alpine dibawa Livewire; Chart.js dibawa template (assets/js/plugins.min.js).

import { gambarLaporan } from './gambar-laporan';
import { gambarPayroll } from './gambar-payroll';
import { gambarSampling } from './gambar-sampling';
import { berkasPng, muatHuruf } from './kanvas';

const WARNA = { utama: '#8231D3', info: '#00AAFF', bahaya: '#FF0F0F', teks: '#747474', garis: '#F1F2F6' };

const angka = (nilai, desimal = 0) =>
    Number(nilai).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });

// Nama bulan dan hari untuk kalender jQuery UI.
const KALENDER_INDONESIA = {
    monthNames: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    dayNames: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    dayNamesMin: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    prevText: 'Bulan sebelumnya',
    nextText: 'Bulan berikutnya',
    firstDay: 1,
};

const digit = (nilai) => String(nilai ?? '').replace(/\D/g, '');
// Angka bulat dengan titik pemisah ribuan: 12000000 menjadi 12.000.000; kosong tetap kosong.
const ribuan = (nilai) => digit(nilai).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

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

        init() {
            // Instance Chart disimpan di elemen, bukan di state Alpine, agar tidak dibungkus proxy.
            this.$refs.kanvas.grafik = new Chart(this.$refs.kanvas, {
                type: 'line',
                data: {
                    labels: this.data.hari,
                    datasets: [
                        { label: 'Aktual', data: this.seri.data, borderColor: WARNA.utama, backgroundColor: 'rgba(130,49,211,0.10)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 0, pointHoverRadius: 5 },
                        { label: 'Standar', data: this.data.standar, borderColor: WARNA.info, borderDash: [5, 5], borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
                    ],
                },
                options: {
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
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
        },

        ganti(kode) {
            this.pilih = kode;
            const grafik = this.$refs.kanvas.grafik;
            grafik.data.datasets[0].data = this.seri.data;
            grafik.update();
        },
    }));

    // Pakan dan kematian per hari.
    Alpine.data('grafikHarian', (data) => ({
        data,
        pilih: 'pakan',
        seri: {
            pakan: { label: 'Pakan', satuan: 'kg', warna: WARNA.utama },
            kematian: { label: 'Mati dan afkir', satuan: 'ekor', warna: WARNA.bahaya },
        },
        fmt: (nilai) => angka(Math.round(nilai)),

        get jumlah() {
            return this.data[this.pilih].reduce((total, nilai) => total + nilai, 0);
        },
        get terakhir() {
            return this.data[this.pilih].at(-1) ?? 0;
        },

        init() {
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

        tampil(nomor) {
            return this.hari === 0 || this.hari === nomor;
        },
    }));

    // Pemilih tanggal bergaya template: jQuery UI datepicker (dibawa assets/js/plugins.min.js).
    // Tampil sebagai "3 Oktober 2026"; nilai Y-m-d dibaca dari data-* dan dikirim lewat event tanggal-dipilih.
    Alpine.data('pilihTanggal', () => ({
        init() {
            const { nilai, min, maks } = this.$el.dataset;
            const pemilih = window.jQuery.datepicker;
            const tanggal = (iso) => (iso ? pemilih.parseDate('yy-mm-dd', iso) : null);

            window.jQuery(this.$refs.isian)
                .datepicker({
                    ...KALENDER_INDONESIA,
                    dateFormat: 'd MM yy',
                    minDate: tanggal(min),
                    maxDate: tanggal(maks),
                    onSelect: () => {
                        const dipilih = pemilih.formatDate('yy-mm-dd', window.jQuery(this.$refs.isian).datepicker('getDate'));
                        if (dipilih !== nilai) this.$dispatch('tanggal-dipilih', dipilih);
                    },
                })
                .datepicker('setDate', tanggal(nilai));
        },

        destroy() {
            window.jQuery(this.$refs.isian).datepicker('destroy');
        },
    }));

    // Isian angka bulat yang tampil dengan titik pemisah ribuan selagi diketik.
    // Pengganti wire:model.blur: properti Livewire tetap menerima angka mentahnya saat isian ditinggalkan.
    Alpine.data('isianRibuan', (properti) => ({
        init() {
            this.$el.value = ribuan(this.$wire.$get(properti));
            // Nilai yang diganti server (mis. sesi tanggal lain dimuat) ditampilkan ulang.
            this.$watch(() => this.$wire.$get(properti), (nilai) => (this.$el.value = ribuan(nilai)));
        },

        format() {
            const isian = this.$el;
            const digitSebelumKursor = digit(isian.value.slice(0, isian.selectionStart)).length;
            isian.value = ribuan(isian.value);

            // Kursor dikembalikan ke posisi digit yang sama, karena titik yang bertambah menggeser letaknya.
            let posisi = 0;
            for (let terlewati = 0; posisi < isian.value.length && terlewati < digitSebelumKursor; posisi++) {
                if (isian.value[posisi] !== '.') terlewati++;
            }
            isian.setSelectionRange(posisi, posisi);
        },

        kirim() {
            const mentah = digit(this.$el.value);
            if (mentah !== digit(this.$wire.$get(properti))) {
                this.$wire.$set(properti, mentah === '' ? null : Number(mentah));
            }
        },
    }));

    Alpine.data('eksporSampling', eksporGambar(gambarSampling));
    Alpine.data('eksporLaporan', eksporGambar(gambarLaporan));
    Alpine.data('eksporPayroll', eksporGambar(gambarPayroll));
});
