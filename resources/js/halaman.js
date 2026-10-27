// Pemotret layar untuk ekspor PNG. Berbeda dengan gambar lembar yang dilukis dari data,
// hasil di sini benar-benar sama dengan yang terlihat di halaman.

import html2canvas from 'html2canvas';

/**
 * Tangkap satu elemen halaman menjadi kanvas.
 *
 * Huruf web dimuat lebih dulu supaya teks tidak jatuh ke huruf cadangan saat digambar.
 * Tombol ekspor disembunyikan pada salinan, jadi hasilnya sama dengan halaman tanpa tombol.
 *
 * @param {string} selector  penyelector elemen yang ditangkap
 * @param {object} pilihan  opsi html2canvas tambahan
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function tangkapHalaman(selector, pilihan = {}) {
    const elemen = document.querySelector(selector);

    if (!elemen) {
        throw new Error('Halaman yang mau ditangkap tidak ditemukan.');
    }

    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    return html2canvas(elemen, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        // Tombol ekspor tidak perlu ikut dalam gambar.
        onclone: (salinan) => {
            salinan.querySelectorAll('[data-lewati-ekspor]').forEach((elemen) => elemen.remove());
            // Isi kartu yang sedang dilipat tetap ikut, supaya datanya tidak hilang dari hasil ekspor.
            salinan.querySelectorAll('[data-ekspor-buka]').forEach((elemen) => {
                elemen.style.removeProperty('display');
                elemen.style.removeProperty('height');
                elemen.style.removeProperty('opacity');
            });
            // Bilah atas melayang di atas isi, jadi disembunyikan supaya tidak menutupi gambar.
            salinan.querySelectorAll('.header-top').forEach((elemen) => (elemen.style.display = 'none'));
        },
        ...pilihan,
    });
}

/** Unduh kanvas sebagai berkas PNG. */
export async function unduhPng(kanvas, nama) {
    const blob = await new Promise((selesai) => kanvas.toBlob(selesai, 'image/png'));

    if (!blob) {
        throw new Error('Gambar tidak dapat diubah menjadi berkas PNG.');
    }

    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(blob);
    tautan.download = `${nama}.png`;
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
    setTimeout(() => URL.revokeObjectURL(tautan.href), 10000);
}

/**
 * Unduh kanvas sebagai PDF satu halaman seukuran gambarnya, supaya tampilannya sama dengan PNG tanpa terpotong.
 * jsPDF dimuat saat dibutuhkan saja agar tidak membebani halaman lain.
 */
export async function unduhPdf(kanvas, nama) {
    const { jsPDF } = await import('jspdf');
    // Kanvas digambar dua kali lipat (scale 2), jadi ukuran halaman dibagi dua agar setara dengan ukuran layar.
    const lebar = kanvas.width / 2;
    const tinggi = kanvas.height / 2;
    const pdf = new jsPDF({ orientation: lebar > tinggi ? 'landscape' : 'portrait', unit: 'px', format: [lebar, tinggi], hotfixes: ['px_scaling'] });

    pdf.addImage(kanvas, 'PNG', 0, 0, lebar, tinggi, undefined, 'FAST');
    pdf.save(`${nama}.pdf`);
}
