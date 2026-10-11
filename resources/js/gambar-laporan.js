// Melukis laporan harian satu tanggal ke kanvas agar bisa disimpan sebagai PNG atau disalin ke clipboard.
// Semua angka sudah berupa teks siap tampil dari App\Support\LembarLaporanHarian; di sini hanya tata letaknya.

import { HURUF, LEBAR, SELA, TEPI, WARNA, garis, kanvasLembar, pecahBaris, tulis } from './kanvas';

const TINGGI_BARIS = 34;
const TINGGI_BARIS_DUA = 50;
const JARAK_SEL = 12;

const jumlah = (daftar) => daftar.reduce((a, b) => a + b, 0);
const sel = (isi) => (typeof isi === 'object' && isi !== null ? isi : { teks: isi });
const teksSelisih = (selisih) => `${selisih.naik ? '↑' : '↓'} ${selisih.teks}`;
const warnaSelisih = (selisih) => (selisih.naik ? WARNA.naik : WARNA.turun);

/** Persegi bersudut tumpul; peramban lama tanpa roundRect mendapat persegi biasa. */
function kotak(ctx, x, y, lebar, tinggi, radius) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, lebar, tinggi, radius);
    else ctx.rect(x, y, lebar, tinggi);
}

/** Pasangan label dan nilai berjajar, turun baris bila tidak muat; mengembalikan y di bawahnya. */
function info(ctx, daftar, y) {
    let x = TEPI;

    for (const { label, nilai } of daftar) {
        ctx.font = `600 17px ${HURUF}`;
        const lebar = Math.max(ctx.measureText(nilai).width, 60);
        if (x > TEPI && x + lebar > LEBAR - TEPI) {
            x = TEPI;
            y += 60;
        }
        tulis(ctx, label, x, y + 7, { ukuran: 12, warna: WARNA.redup });
        tulis(ctx, nilai, x, y + 32, { ukuran: 17, tebal: 600 });
        x += lebar + 36;
    }

    return y + 62;
}

/** Empat angka utama dalam kotak sejajar; mengembalikan y di bawahnya. */
function angkaUtama(ctx, daftar, y) {
    const lebar = (LEBAR - TEPI * 2 - SELA * (daftar.length - 1)) / daftar.length;
    const tinggi = 112;

    daftar.forEach(({ label, nilai, catatan, selisih }, i) => {
        const x = TEPI + i * (lebar + SELA);
        ctx.fillStyle = WARNA.kaki;
        kotak(ctx, x, y, lebar, tinggi, 12);
        ctx.fill();
        ctx.strokeStyle = WARNA.garis;
        ctx.stroke();

        tulis(ctx, label, x + 18, y + 24, { ukuran: 13, warna: WARNA.redup });
        tulis(ctx, nilai, x + 18, y + 58, { ukuran: 28, tebal: 700 });

        let xCatatan = x + 18;
        if (selisih) {
            xCatatan += tulis(ctx, teksSelisih(selisih), xCatatan, y + 90, { ukuran: 12, tebal: 600, warna: warnaSelisih(selisih) }) + 6;
        }
        tulis(ctx, catatan, xCatatan, y + 90, { ukuran: 12, warna: WARNA.redup });
    });

    return y + tinggi;
}

/**
 * Tabel dengan kepala berlatar, garis antarbaris, dan baris kaki opsional; mengembalikan y di bawahnya.
 * kolom: [{ judul, porsi, rata }]. Tiap sel berupa teks atau { teks, sub, warna, warnaSub, tebal };
 * sel dengan sub memakai baris dua tingkat.
 */
function tabel(ctx, { kolom, baris, kaki = null, kosong = null }, x, y, lebar) {
    const lebarKolom = kolom.map(({ porsi }) => porsi * lebar);
    const titik = (i) => {
        const kiri = x + jumlah(lebarKolom.slice(0, i));

        return kolom[i].rata === 'right' ? kiri + lebarKolom[i] - JARAK_SEL : kiri + JARAK_SEL;
    };
    const awal = y;

    ctx.fillStyle = WARNA.kepala;
    ctx.fillRect(x, y, lebar, TINGGI_BARIS);
    kolom.forEach(({ judul, rata = 'left' }, i) => tulis(ctx, judul, titik(i), y + TINGGI_BARIS / 2, { ukuran: 12.5, tebal: 600, rata }));
    y += TINGGI_BARIS;

    if (!baris.length && kosong) {
        tulis(ctx, kosong, x + JARAK_SEL, y + TINGGI_BARIS / 2, { ukuran: 13, warna: WARNA.redup });
        y += TINGGI_BARIS;
    }

    for (const isiBaris of baris) {
        const daftarSel = isiBaris.map(sel);
        const tinggi = daftarSel.some(({ sub }) => sub) ? TINGGI_BARIS_DUA : TINGGI_BARIS;

        garis(ctx, x, y, x + lebar, y);
        daftarSel.forEach(({ teks, sub, warna = WARNA.teks, warnaSub = WARNA.redup, tebal = 400 }, i) => {
            const rata = kolom[i].rata ?? 'left';
            tulis(ctx, teks, titik(i), y + (sub ? 18 : tinggi / 2), { ukuran: 13.5, tebal, warna, rata });
            if (sub) tulis(ctx, sub, titik(i), y + 36, { ukuran: 11.5, warna: warnaSub, rata });
        });
        y += tinggi;
    }

    if (kaki) {
        ctx.fillStyle = WARNA.kaki;
        ctx.fillRect(x, y, lebar, TINGGI_BARIS);
        garis(ctx, x, y, x + lebar, y);
        kaki.map(sel).forEach(({ teks, warna = WARNA.teks }, i) =>
            tulis(ctx, teks, titik(i), y + TINGGI_BARIS / 2, { ukuran: 13.5, tebal: 600, warna, rata: kolom[i].rata ?? 'left' }));
        y += TINGGI_BARIS;
    }

    ctx.strokeStyle = WARNA.garis;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, awal, lebar, y - awal);

    return y;
}

/** Judul bagian dengan keterangan redup di kanannya; mengembalikan y di bawahnya. */
function judulBagian(ctx, judul, keterangan, x, y, lebar) {
    tulis(ctx, judul, x, y + 10, { ukuran: 17, tebal: 600 });
    if (keterangan) tulis(ctx, keterangan, x + lebar, y + 11, { ukuran: 12, warna: WARNA.redup, rata: 'right' });

    return y + 34;
}

function tabelPakanMasuk(ctx, pakanMasuk, x, y, lebar) {
    y = judulBagian(ctx, 'Pakan masuk', null, x, y, lebar);

    return tabel(ctx, {
        kolom: [{ judul: 'Tanggal', porsi: 0.52 }, { judul: 'Jenis', porsi: 0.22 }, { judul: 'Zak', porsi: 0.26, rata: 'right' }],
        baris: pakanMasuk.baris.map(({ tanggal, jenis, zak }) => [tanggal, jenis, zak]),
        kaki: ['Total pakan masuk', '', pakanMasuk.total],
        kosong: 'Belum ada pakan masuk sampai tanggal ini.',
    }, x, y, lebar);
}

function tabelOpname(ctx, opname, x, y, lebar) {
    const sisa = ({ sisa: teks, sisa_kurang: kurang }) => ({ teks, warna: kurang ? WARNA.turun : WARNA.teks, tebal: kurang ? 600 : 400 });

    y = judulBagian(ctx, 'Opname pakan', null, x, y, lebar);
    y = tabel(ctx, {
        kolom: [
            { judul: 'Jenis', porsi: 0.18 },
            { judul: 'Masuk', porsi: 0.15, rata: 'right' },
            { judul: 'Terpakai hari ini', porsi: 0.23, rata: 'right' },
            { judul: 'Terpakai s/d hari ini', porsi: 0.27, rata: 'right' },
            { judul: 'Sisa stok', porsi: 0.17, rata: 'right' },
        ],
        baris: opname.baris.map((stok) => [{ teks: stok.jenis, tebal: 600 }, stok.masuk, stok.terpakai_hari_ini, stok.terpakai, sisa(stok)]),
        kaki: ['Total (zak)', opname.total.masuk, opname.total.terpakai_hari_ini, opname.total.terpakai, sisa(opname.total)],
    }, x, y, lebar);

    if (opname.catatan) {
        tulis(ctx, opname.catatan, x, y + 16, { ukuran: 12, warna: WARNA.redup });
        y += 26;
    }

    return y;
}

function tabelKandang(ctx, kandang, x, y, lebar) {
    y = judulBagian(ctx, 'Mortalitas dan performa', null, x, y, lebar);

    return tabel(ctx, {
        kolom: [
            { judul: 'Kandang', porsi: 0.23 },
            { judul: 'Kematian hari ini', porsi: 0.2, rata: 'right' },
            { judul: 'Kumulatif', porsi: 0.16, rata: 'right' },
            { judul: 'Sisa ayam', porsi: 0.15, rata: 'right' },
            { judul: 'ABW', porsi: 0.13, rata: 'right' },
            { judul: 'FCR', porsi: 0.13, rata: 'right' },
        ],
        baris: kandang.baris.map((satu) => [
            { teks: satu.nama, sub: satu.populasi, tebal: 600 },
            satu.mati_hari_ini,
            { teks: satu.mati_kumulatif, sub: satu.mortalitas },
            satu.sisa,
            satu.abw_selisih ? { teks: satu.abw, sub: teksSelisih(satu.abw_selisih), warnaSub: warnaSelisih(satu.abw_selisih) } : satu.abw,
            satu.fcr_standar ? { teks: satu.fcr, sub: satu.fcr_standar } : satu.fcr,
        ]),
        kaki: kandang.total ? ['Total', kandang.total.mati_hari_ini, kandang.total.mati_kumulatif, kandang.total.sisa, kandang.total.abw, kandang.total.fcr] : null,
    }, x, y, lebar);
}

/** Catatan recording sebagai butir yang dipatahkan sesuai lebar; mengembalikan y di bawahnya. */
function catatan(ctx, daftar, y) {
    const lebar = LEBAR - TEPI * 2;
    y = judulBagian(ctx, 'Catatan recording', null, TEPI, y, lebar);

    for (const butir of daftar) {
        ctx.fillStyle = WARNA.redup;
        ctx.beginPath();
        ctx.arc(TEPI + 7, y + 11, 2.5, 0, Math.PI * 2);
        ctx.fill();
        for (const baris of pecahBaris(ctx, butir, lebar - 22, { ukuran: 14 })) {
            tulis(ctx, baris, TEPI + 22, y + 11, { ukuran: 14 });
            y += 22;
        }
        y += 6;
    }

    return y;
}

/** Melukis seluruh lembar dan mengembalikan tingginya, sehingga bisa dipakai untuk mengukur lebih dulu. */
function lukis(ctx, lembar) {
    const isi = LEBAR - TEPI * 2;
    const lebarKiri = Math.round((isi - SELA) * 0.38);
    const lebarKanan = isi - SELA - lebarKiri;
    const xKanan = TEPI + lebarKiri + SELA;
    let y = TEPI;

    tulis(ctx, 'MISJIWATI FARM', TEPI, y + 8, { ukuran: 12, tebal: 600, warna: WARNA.utama });
    y += 34;
    tulis(ctx, 'Laporan harian pemeliharaan ayam broiler', TEPI, y + 14, { ukuran: 26, tebal: 700 });
    y += 52;

    y = info(ctx, lembar.info, y);
    garis(ctx, TEPI, y, LEBAR - TEPI, y);
    y += 24;

    y = angkaUtama(ctx, lembar.utama, y) + 30;

    const bawahKiri = tabelPakanMasuk(ctx, lembar.pakan_masuk, TEPI, y, lebarKiri);
    const bawahOpname = tabelOpname(ctx, lembar.opname, xKanan, y, lebarKanan);
    const bawahKanan = tabelKandang(ctx, lembar.kandang, xKanan, bawahOpname + 24, lebarKanan);
    y = Math.max(bawahKiri, bawahKanan) + 30;

    if (lembar.catatan.length) {
        y = catatan(ctx, lembar.catatan, y) + 14;
    }

    garis(ctx, TEPI, y, LEBAR - TEPI, y);
    tulis(ctx, lembar.keterangan, TEPI, y + 22, { ukuran: 12, warna: WARNA.redup });

    return y + 22 + TEPI;
}

/** Kanvas berisi laporan harian. */
export const gambarLaporan = (lembar) => kanvasLembar(lukis, lembar);
