<?php

namespace App\Support;

/**
 * Isi panduan penggunaan pertama (x-panduan-sistem): urutan langkah dari persiapan sampai penutupan periode.
 */
class PanduanSistem
{
    /**
     * @return list<array{judul: string, ringkasan: string, poin: list<string>, tautan: ?string, label_tautan: ?string}>
     */
    public static function langkah(): array
    {
        return [
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
                    'Laporan baru diisi lewat formulir modal yang dibuka langsung dari halaman laporan.',
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
    }
}
