<?php

namespace App\Enums;

/**
 * Jenis aksi pengguna yang dicatat di riwayat aktivitas.
 */
enum JenisAktivitas: string
{
    case Tambah = 'tambah';
    case Ubah = 'ubah';
    case Hapus = 'hapus';

    public function label(): string
    {
        return match ($this) {
            self::Tambah => 'Tambah',
            self::Ubah => 'Ubah',
            self::Hapus => 'Hapus',
        };
    }

    /**
     * Kata penutup kalimat aktivitas: "Laporan harian 2 Oktober 2026 diubah".
     */
    public function hasil(): string
    {
        return match ($this) {
            self::Tambah => 'ditambahkan',
            self::Ubah => 'diubah',
            self::Hapus => 'dihapus',
        };
    }

    /**
     * Nama warna template HexaDash, dipakai sebagai tag-{warna} dan dot-{warna}.
     */
    public function warna(): string
    {
        return match ($this) {
            self::Tambah => 'success',
            self::Ubah => 'info',
            self::Hapus => 'danger',
        };
    }
}
