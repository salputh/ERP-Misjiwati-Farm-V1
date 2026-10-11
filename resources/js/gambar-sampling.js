// Melukis hasil satu sesi sampling ke kanvas agar bisa disimpan sebagai PNG atau disalin ke clipboard.

import { HURUF, LEBAR, SELA, TEPI, WARNA, angka, garis, kanvasLembar, kosong, tulis } from './kanvas';

// Warna tag template (dm-tag tag-transparented): warning, info, success.
const CHIP = {
    jantan: { latar: 'rgba(250, 139, 12, 0.15)', teks: '#FA8B0C' },
    betina: { latar: 'rgba(0, 170, 255, 0.15)', teks: '#00AAFF' },
    gabungan: { latar: 'rgba(1, 184, 26, 0.15)', teks: '#01B81A' },
};

// Selisih DG: negatif ditulis dalam kurung, seperti di lembar farm.
const selisih = (nilai) => {
    if (kosong(nilai)) return { teks: '-', warna: WARNA.teks };
    if (nilai < 0) return { teks: `(${angka(-nilai)})`, warna: WARNA.turun };
    return { teks: angka(nilai), warna: nilai > 0 ? WARNA.naik : WARNA.teks };
};
const judulKelamin = (kelamin) => kelamin[0].toUpperCase() + kelamin.slice(1);

/** Label berwarna untuk kelamin; mengembalikan y di bawahnya. */
function chip(ctx, teks, jenis, x, y) {
    ctx.font = `600 12px ${HURUF}`;
    const lebar = ctx.measureText(teks).width + 20;
    ctx.fillStyle = CHIP[jenis].latar;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, lebar, 24, 5);
    else ctx.rect(x, y, lebar, 24);
    ctx.fill();
    tulis(ctx, teks, x + 10, y + 12, { ukuran: 12, tebal: 600, warna: CHIP[jenis].teks });

    return y + 24 + 10;
}

/** Tabel sampel satu lantai dan satu kelamin; mengembalikan y di bawahnya. */
function tabelSampel(ctx, kelompok, x, y, lebar) {
    const tinggi = 32;
    const kolom = [0.14, 0.29, 0.29, 0.28].map((porsi) => porsi * lebar);
    const tengah = kolom.map((lebarKolom, i) => x + kolom.slice(0, i).reduce((a, b) => a + b, 0) + lebarKolom / 2);
    const batasNilai = x + lebar - kolom[3];
    const awal = y;

    ctx.fillStyle = WARNA.kepala;
    ctx.fillRect(x, y, lebar, tinggi);
    ['Line', 'Sampel 1 (gram)', 'Sampel 2 (gram)', 'Total line (gram)'].forEach((judul, i) =>
        tulis(ctx, judul, tengah[i], y + tinggi / 2, { ukuran: 13, tebal: 600, rata: 'center' }));
    y += tinggi;

    for (const [line, baris] of Object.entries(kelompok.baris)) {
        garis(ctx, x, y, x + lebar, y);
        tulis(ctx, line, tengah[0], y + tinggi / 2, { ukuran: 13, tebal: 600, rata: 'center' });
        Object.values(baris.sampel).forEach((nilai, i) =>
            tulis(ctx, angka(nilai), tengah[i + 1], y + tinggi / 2, { ukuran: 13, tebal: 600, warna: WARNA.utama, rata: 'center' }));
        tulis(ctx, angka(baris.total), tengah[3], y + tinggi / 2, { ukuran: 13, tebal: 600, rata: 'center' });
        y += tinggi;
    }
    const akhirSampel = y;

    const beda = selisih(kelompok.selisih_dg);
    const kaki = [
        ['Subtotal (gram)', angka(kelompok.subtotal), { tebal: 600 }],
        ['ABW per ekor (gram)', angka(kelompok.abw), { tebal: 600 }],
        ['DG aktual', angka(kelompok.dg), {}],
        ['DG standar', angka(kelompok.dg_standar), {}],
        ['Selisih DG', beda.teks, { warna: beda.warna }],
    ];
    ctx.fillStyle = WARNA.kaki;
    ctx.fillRect(x, y, lebar, tinggi * kaki.length);
    for (const [label, nilai, gaya] of kaki) {
        garis(ctx, x, y, x + lebar, y);
        tulis(ctx, label, batasNilai - 10, y + tinggi / 2, { ukuran: 13, tebal: 500, rata: 'right' });
        tulis(ctx, nilai, tengah[3], y + tinggi / 2, { ukuran: 13, rata: 'center', ...gaya });
        y += tinggi;
    }

    // Garis tegak: antar kolom hanya di bagian sampel, karena label kaki membentang tiga kolom.
    [x + kolom[0], x + kolom[0] + kolom[1]].forEach((batas) => garis(ctx, batas, awal, batas, akhirSampel));
    garis(ctx, batasNilai, awal, batasNilai, y);
    ctx.strokeStyle = WARNA.garis;
    ctx.strokeRect(x, awal, lebar, y - awal);

    return y;
}

/** Daftar label dan nilai dengan garis bawah tiap baris; mengembalikan y di bawahnya. */
function daftar(ctx, baris, x, y, lebar) {
    const tinggi = 38;

    for (const { label, catatan, nilai, tebal = 400, warna = WARNA.teks, sorot = false } of baris) {
        if (sorot) {
            ctx.fillStyle = WARNA.kepala;
            ctx.fillRect(x, y, lebar, tinggi);
        }
        const lebarLabel = tulis(ctx, label, x + 14, y + tinggi / 2, { ukuran: 14, tebal });
        if (catatan) {
            tulis(ctx, catatan, x + 14 + lebarLabel + 6, y + tinggi / 2, { ukuran: 12, warna: WARNA.redup });
        }
        tulis(ctx, nilai, x + lebar - 14, y + tinggi / 2, { ukuran: 14, tebal, warna, rata: 'right' });
        y += tinggi;
        garis(ctx, x, y, x + lebar, y);
    }

    return y;
}

function barisKelamin(ringkasan) {
    return [
        { label: 'Total berat (gram)', nilai: angka(ringkasan.total) },
        { label: 'Jumlah line', nilai: angka(ringkasan.jumlah_line) },
        { label: 'Jumlah titik sampel', nilai: angka(ringkasan.jumlah_titik) },
        { label: 'Total ekor tersampel', nilai: angka(ringkasan.ekor) },
        { label: 'ABW per ekor', nilai: `${angka(ringkasan.abw)} g`, tebal: 600 },
    ];
}

function barisGabungan({ hasil, pakan, umur, dengan_sexing: denganSexing }) {
    const gabungan = hasil.gabungan;
    const beda = selisih(gabungan.selisih_dg);
    const pakanTertinggal = !kosong(pakan.pakan_sampai_umur) && pakan.pakan_sampai_umur < umur;

    return [
        { label: 'Total berat keseluruhan (gram)', nilai: angka(gabungan.total) },
        { label: 'Jumlah line', nilai: angka(gabungan.jumlah_line) },
        { label: 'Jumlah titik sampel', nilai: `${angka(gabungan.jumlah_titik)} dari ${angka(gabungan.jumlah_titik_penuh)}` },
        { label: 'Total ekor tersampel', nilai: angka(gabungan.ekor) },
        { label: denganSexing ? 'ABW per ekor gabungan' : 'ABW per ekor', nilai: `${angka(gabungan.abw)} g`, tebal: 600, sorot: true },
        { label: 'ABW standar', nilai: `${angka(gabungan.abw_standar)} g` },
        { label: 'DG aktual', catatan: `(dari ABW kemarin ${angka(gabungan.abw_sebelumnya)} g)`, nilai: angka(gabungan.dg) },
        { label: 'DG standar', nilai: angka(gabungan.dg_standar) },
        { label: 'Selisih DG', nilai: beda.teks, warna: beda.warna },
        { label: 'FCR standar', nilai: angka(pakan.fcr_standar, 3) },
        { label: 'FCR aktual', catatan: pakanTertinggal ? `(pakan tercatat s/d hari ke-${pakan.pakan_sampai_umur})` : null, nilai: angka(pakan.fcr, 3) },
    ];
}

/** Melukis seluruh lembar dan mengembalikan tingginya, sehingga bisa dipakai untuk mengukur lebih dulu. */
function lukis(ctx, lembar) {
    const { hasil, dengan_sexing: denganSexing } = lembar;
    const isi = LEBAR - TEPI * 2;
    const lebarKolom = (isi - SELA) / 2;
    const kolom = [TEPI, TEPI + lebarKolom + SELA];
    let y = TEPI;

    tulis(ctx, 'MISJIWATI FARM', TEPI, y + 8, { ukuran: 12, tebal: 600, warna: WARNA.utama });
    y += 34;
    tulis(ctx, `Hasil sampling bobot ${lembar.kandang}`, TEPI, y + 14, { ukuran: 26, tebal: 700 });
    y += 52;

    const info = [
        ['Tanggal', lembar.tanggal],
        ['Usia', `${lembar.umur} hari`],
        ['Jenis sampling', denganSexing ? 'Dengan sexing' : 'Tanpa sexing'],
        ...hasil.kelamin.map((kelamin) => [kelamin === 'campuran' ? 'Ekor per sampel' : `Ekor per sampel ${kelamin}`, String(lembar.ekor[kelamin])]),
    ];
    let x = TEPI;
    for (const [label, nilai] of info) {
        const lebarLabel = tulis(ctx, label, x, y + 7, { ukuran: 12, warna: WARNA.redup });
        const lebarNilai = tulis(ctx, nilai, x, y + 32, { ukuran: 17, tebal: 600 });
        x += Math.max(lebarLabel, lebarNilai) + 36;
    }
    y += 62;
    garis(ctx, TEPI, y, LEBAR - TEPI, y);
    y += 28;

    if (denganSexing) {
        for (const [lantai, label] of Object.entries(lembar.lantai)) {
            tulis(ctx, label, TEPI, y + 10, { ukuran: 17, tebal: 600 });
            y += 34;
            const bawah = hasil.kelamin.map((kelamin, i) =>
                tabelSampel(ctx, hasil.lantai[lantai][kelamin], kolom[i], chip(ctx, judulKelamin(kelamin), kelamin, kolom[i], y), lebarKolom));
            y = Math.max(...bawah) + 28;
        }
    } else {
        const bawah = Object.entries(lembar.lantai).map(([lantai, label], i) => {
            tulis(ctx, label, kolom[i], y + 10, { ukuran: 17, tebal: 600 });

            return tabelSampel(ctx, hasil.lantai[lantai].campuran, kolom[i], y + 34, lebarKolom);
        });
        y = Math.max(...bawah) + 28;
    }

    tulis(ctx, 'Ringkasan hasil', TEPI, y + 10, { ukuran: 17, tebal: 600 });
    y += 34;
    if (denganSexing) {
        const bawah = hasil.kelamin.map((kelamin, i) =>
            daftar(ctx, barisKelamin(hasil.per_kelamin[kelamin]), kolom[i], chip(ctx, judulKelamin(kelamin), kelamin, kolom[i], y), lebarKolom));
        y = chip(ctx, 'Gabungan jantan dan betina', 'gabungan', TEPI, Math.max(...bawah) + 24);
    }
    y = daftar(ctx, barisGabungan(lembar), TEPI, y, isi);

    return y + TEPI;
}

/** Kanvas berisi hasil sampling. */
export const gambarSampling = (lembar) => kanvasLembar(lukis, lembar);
