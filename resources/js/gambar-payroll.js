// Melukis slip payroll satu ABK ke kanvas agar bisa disimpan sebagai PNG atau disalin ke clipboard.

import { HURUF, LEBAR, TEPI, WARNA, angka, garis, kanvasLembar, pecahBaris, tulis } from './kanvas';

const JARAK = 18;
const TINGGI = 38;

function baris(ctx, daftar, x, y, lebar) {
    for (const item of daftar) {
        const teksLabel = pecahBaris(ctx, item.label, lebar - 220, { ukuran: 14, tebal: item.total ? 600 : 400 });
        const teksRumus = item.rumus ? pecahBaris(ctx, item.rumus, lebar - 220, { ukuran: 11, tebal: 400 }) : [];
        const jumlahBaris = teksLabel.length + teksRumus.length;
        const tinggi = Math.max(TINGGI, jumlahBaris * 19 + 16);

        if (item.total) {
            ctx.fillStyle = WARNA.kaki;
            ctx.fillRect(x, y, lebar, tinggi);
        }
        garis(ctx, x, y, x + lebar, y);

        teksLabel.forEach((teks, indeks) => {
            tulis(ctx, teks, x + JARAK, y + 15 + indeks * 19, {
                ukuran: 14,
                tebal: item.total ? 600 : 400,
            });
        });
        teksRumus.forEach((teks, indeks) => {
            tulis(ctx, teks, x + JARAK, y + 15 + (teksLabel.length + indeks) * 19, {
                ukuran: 11,
                warna: WARNA.redup,
            });
        });

        tulis(ctx, angka(item.jumlah), x + lebar - JARAK, y + tinggi / 2, {
            ukuran: item.total ? 14 : 13,
            tebal: item.total ? 600 : 400,
            rata: 'right',
        });
        y += tinggi;
    }

    return y;
}

function judulBagian(ctx, teks, x, y) {
    tulis(ctx, teks, x, y + 10, { ukuran: 16, tebal: 600 });

    return y + 30;
}

function lukis(ctx, lembar) {
    const { slip } = lembar;
    const lebar = LEBAR - TEPI * 2;
    let y = TEPI;

    tulis(ctx, 'MISJIWATI FARM', TEPI, y + 8, { ukuran: 12, tebal: 600, warna: WARNA.utama });
    y += 38;
    tulis(ctx, 'SLIP GAJI', TEPI, y + 14, { ukuran: 12, tebal: 600, warna: WARNA.redup });
    y += 34;
    tulis(ctx, slip.nama, TEPI, y + 18, { ukuran: 28, tebal: 700 });
    y += 48;
    tulis(ctx, `${slip.jabatan} · ${slip.kandang} · ${slip.hari_kerja} hari kerja`, TEPI, y + 9, { ukuran: 14, warna: WARNA.redup });
    y += 34;
    tulis(ctx, lembar.periode, TEPI, y + 9, { ukuran: 13, warna: WARNA.redup });
    y += 28;
    garis(ctx, TEPI, y, LEBAR - TEPI, y);
    y += 18;

    y = judulBagian(ctx, 'Pendapatan', TEPI, y);
    y = baris(ctx, slip.pendapatan.map((item) => ({ ...item, jumlah: item.jumlah })), TEPI, y, lebar);
    y = baris(ctx, [{ label: 'Total pendapatan', jumlah: slip.total_pendapatan, total: true }], TEPI, y, lebar) + 20;

    y = judulBagian(ctx, 'Potongan', TEPI, y);
    y = baris(ctx, slip.potongan.map((item) => ({ ...item, jumlah: item.jumlah })), TEPI, y, lebar);
    y = baris(ctx, [{ label: 'Total potongan', jumlah: slip.total_potongan, total: true }], TEPI, y, lebar) + 24;

    ctx.fillStyle = WARNA.kepala;
    ctx.fillRect(TEPI, y, lebar, 62);
    tulis(ctx, 'Pendapatan bersih diterima', TEPI + JARAK, y + 31, { ukuran: 15, tebal: 600 });
    tulis(ctx, `Rp ${angka(slip.bersih)}`, LEBAR - TEPI - JARAK, y + 31, {
        ukuran: 20,
        tebal: 700,
        warna: slip.bersih < 0 ? WARNA.turun : WARNA.utama,
        rata: 'right',
    });

    return y + 62 + TEPI;
}

/** Kanvas berisi slip payroll seorang ABK. */
export const gambarPayroll = (lembar) => kanvasLembar(lukis, lembar);
