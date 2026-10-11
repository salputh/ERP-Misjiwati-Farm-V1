// Alat bersama untuk melukis lembar ke kanvas lalu menjadikannya PNG (hasil sampling, laporan harian).
// Gambar dilukis dari data, bukan memotret layar, supaya lebarnya tetap dan rapi di layar HP sekalipun.

export const LEBAR = 1080;
export const TEPI = 40;
export const SELA = 24;
const SKALA = 2;
export const HURUF = 'Jost, system-ui, sans-serif';
const TEBAL_HURUF = [400, 500, 600, 700];

export const WARNA = { teks: '#0A0A0A', redup: '#747474', utama: '#8231D3', garis: '#E3E6EF', kepala: '#F7F2FC', kaki: '#FAFAFA', naik: '#01B81A', turun: '#FF0F0F' };

export const kosong = (nilai) => nilai === null || nilai === undefined;
export const angka = (nilai, desimal = 0) =>
    kosong(nilai) ? '-' : Number(nilai).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });

/** Muat huruf lebih dulu supaya gambar bisa dilukis seketika saat tombol ditekan. */
export const muatHuruf = () => Promise.all(TEBAL_HURUF.map((tebal) => document.fonts.load(`${tebal} 16px Jost`)));

export function tulis(ctx, teks, x, y, { ukuran = 14, tebal = 400, warna = WARNA.teks, rata = 'left' } = {}) {
    ctx.font = `${tebal} ${ukuran}px ${HURUF}`;
    ctx.fillStyle = warna;
    ctx.textAlign = rata;
    ctx.textBaseline = 'middle';
    ctx.fillText(teks, x, y);

    return ctx.measureText(teks).width;
}

export function garis(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = WARNA.garis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

/** Pecah teks menjadi baris-baris yang muat di lebar tertentu, untuk huruf yang sedang dipakai ctx. */
export function pecahBaris(ctx, teks, lebar, { ukuran = 14, tebal = 400 } = {}) {
    ctx.font = `${tebal} ${ukuran}px ${HURUF}`;
    const baris = [];
    let kini = '';

    for (const kata of String(teks).split(/\s+/)) {
        const calon = kini ? `${kini} ${kata}` : kata;
        if (kini && ctx.measureText(calon).width > lebar) {
            baris.push(kini);
            kini = kata;
        } else {
            kini = calon;
        }
    }
    if (kini) baris.push(kini);

    return baris;
}

/**
 * Kanvas berisi satu lembar, dua kali resolusi agar tetap tajam saat ditempel di chat.
 * lukis(ctx, lembar) melukis seluruh lembar dan mengembalikan tingginya; dipanggil sekali untuk mengukur, sekali untuk melukis.
 */
export function kanvasLembar(lukis, lembar) {
    const tinggi = lukis(document.createElement('canvas').getContext('2d'), lembar);
    const kanvas = document.createElement('canvas');
    kanvas.width = LEBAR * SKALA;
    kanvas.height = Math.ceil(tinggi) * SKALA;

    const ctx = kanvas.getContext('2d');
    ctx.scale(SKALA, SKALA);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, LEBAR, tinggi);
    lukis(ctx, lembar);

    return kanvas;
}

/**
 * Kanvas menjadi berkas PNG secara sinkron (tanpa toBlob), supaya penyalinan ke clipboard tetap
 * berada di dalam klik pengguna; Safari menolak clipboard.write setelah jeda asinkron.
 */
export function berkasPng(kanvas, nama) {
    const biner = atob(kanvas.toDataURL('image/png').split(',')[1]);

    return new File([Uint8Array.from(biner, (huruf) => huruf.charCodeAt(0))], `${nama}.png`, { type: 'image/png' });
}
