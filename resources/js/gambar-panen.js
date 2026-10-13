const gayaInline = (sumber, salinan) => {
    const gaya = getComputedStyle(sumber);

    for (const nama of gaya) {
        salinan.style.setProperty(nama, gaya.getPropertyValue(nama), gaya.getPropertyPriority(nama));
    }
};

const dataUri = async (url) => {
    const respons = await fetch(url, { credentials: 'same-origin' });
    if (!respons.ok) {
        throw new Error(`Gagal memuat gambar tabel (${respons.status}).`);
    }

    const berkas = await respons.blob();

    return new Promise((resolve, reject) => {
        const pembaca = new FileReader();
        pembaca.onload = () => resolve(pembaca.result);
        pembaca.onerror = () => reject(pembaca.error);
        pembaca.readAsDataURL(berkas);
    });
};

const gambarDariSvg = (svg) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const gambar = new Image();

    gambar.onload = () => {
        URL.revokeObjectURL(url);

        const kanvas = document.createElement('canvas');
        kanvas.width = gambar.width;
        kanvas.height = gambar.height;
        kanvas.getContext('2d').drawImage(gambar, 0, 0);
        kanvas.toBlob((berkas) => {
            if (berkas) resolve(berkas);
            else reject(new Error('Browser gagal membuat gambar PNG.'));
        }, 'image/png');
    };
    gambar.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Browser gagal merender tampilan tabel sebagai gambar.'));
    };
    gambar.src = url;
});

export async function gambarPanen(tabel) {
    const salinan = tabel.cloneNode(true);
    const sumber = [tabel, ...tabel.querySelectorAll('*')];
    const tujuan = [salinan, ...salinan.querySelectorAll('*')];

    sumber.forEach((elemen, indeks) => gayaInline(elemen, tujuan[indeks]));

    const lebar = Math.ceil(Math.max(tabel.scrollWidth, tabel.getBoundingClientRect().width));
    const tinggi = Math.ceil(Math.max(tabel.scrollHeight, tabel.getBoundingClientRect().height));
    salinan.style.setProperty('width', `${lebar}px`, 'important');
    salinan.style.setProperty('max-width', 'none', 'important');
    salinan.style.setProperty('margin', '0', 'important');

    await Promise.all(Array.from(salinan.querySelectorAll('img')).map(async (gambar) => {
        const alamat = new URL(gambar.getAttribute('src'), document.baseURI);
        if (alamat.origin === window.location.origin && !alamat.protocol.startsWith('data:')) {
            gambar.setAttribute('src', await dataUri(alamat.href));
        }
    }));

    const isi = new XMLSerializer().serializeToString(salinan);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}">
            <foreignObject width="100%" height="100%">
                <div xmlns="http://www.w3.org/1999/xhtml" style="width:${lebar}px;height:${tinggi}px;overflow:hidden;background:#fff">${isi}</div>
            </foreignObject>
        </svg>`;

    return gambarDariSvg(svg);
}
