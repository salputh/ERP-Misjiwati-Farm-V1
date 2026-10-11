<?php

namespace App\Enums;

/**
 * Kategori transaksi kas operasional kandang, mengikuti lembar "Laporan Biaya Operasional".
 * Dana operasional adalah satu-satunya uang masuk; kategori lain adalah pengeluaran.
 */
enum KategoriKas: string
{
    case DanaOperasional = 'dana-operasional';
    case SewaLahan = 'sewa-lahan';
    case Listrik = 'listrik';
    case Gas = 'gas';
    case Solar = 'solar';
    case Berobat = 'berobat';
    case Upah = 'upah';
    case MakanMinum = 'makan-minum';
    case LainLain = 'lain-lain';
    case ObatAyam = 'obat-ayam';
    case Entertain = 'entertain';
    case Transport = 'transport';
    case PinjamanMakan = 'pinjaman-makan';
    case PinjamanAbk = 'pinjaman-abk';
    case Maintenance = 'maintenance';

    public function label(): string
    {
        return match ($this) {
            self::DanaOperasional => 'Dana Operasional',
            self::SewaLahan => 'Biaya Sewa Lahan',
            self::Listrik => 'PLN & Kelistrikan',
            self::Gas => 'Gas',
            self::Solar => 'Solar',
            self::Berobat => 'Berobat',
            self::Upah => 'Upah',
            self::MakanMinum => 'Meal & Drink',
            self::LainLain => 'Lain-lain',
            self::ObatAyam => 'Obat Ayam',
            self::Entertain => 'Entertain',
            self::Transport => 'Transport',
            self::PinjamanMakan => 'Pinjaman Makan (Uang Makan)',
            self::PinjamanAbk => 'Pinjaman ABK',
            self::Maintenance => 'Maintenance',
        };
    }

    /**
     * Uang masuk ke kas (debet). Selain itu pengeluaran (kredit).
     */
    public function masuk(): bool
    {
        return $this === self::DanaOperasional;
    }

    /**
     * Pinjaman karyawan keluar dari kas, tetapi tidak dihitung sebagai biaya operasional.
     */
    public function pinjaman(): bool
    {
        return in_array($this, [self::PinjamanMakan, self::PinjamanAbk], true);
    }

    /**
     * Kelas CSS tag template HexaDash (dm-tag) untuk kolom kategori di buku kas.
     */
    public function kelasTag(): string
    {
        return match (true) {
            $this->masuk() => 'tag-success',
            $this->pinjaman() => 'tag-warning',
            default => 'tag-primary',
        };
    }

    /**
     * Kategori pengeluaran, untuk pilihan saringan dan isian.
     *
     * @return list<self>
     */
    public static function pengeluaran(): array
    {
        return array_values(array_filter(self::cases(), fn (self $kategori): bool => ! $kategori->masuk()));
    }
}
