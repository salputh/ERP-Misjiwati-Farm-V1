<?php

namespace App\Support;

use App\Enums\KategoriKas;
use App\Models\Farm;
use App\Models\TransaksiKas;

/**
 * Kategori pengeluaran yang ditambahkan pengguna dari form kas operasional, di luar daftar baku KategoriKas.
 * Namanya disimpan apa adanya di kolom kategori transaksi, dan selalu dihitung sebagai biaya operasional.
 * Bentuknya meniru KategoriKas (value, label, masuk, pinjaman, kelasTag) agar buku kas memperlakukan keduanya sama.
 */
final readonly class KategoriKasTambahan
{
    public function __construct(public string $value) {}

    public function label(): string
    {
        return $this->value;
    }

    public function masuk(): bool
    {
        return false;
    }

    public function pinjaman(): bool
    {
        return false;
    }

    public function kelasTag(): string
    {
        return 'tag-primary';
    }

    /**
     * Kategori tambahan yang sudah dipakai transaksi kas di farm ini, urut abjad.
     *
     * @return list<self>
     */
    public static function untukFarm(Farm $farm): array
    {
        return TransaksiKas::query()
            ->whereHas('periodeKandang.periode', fn ($query) => $query->where('farm_id', $farm->id))
            ->whereNotIn('kategori', array_column(KategoriKas::cases(), 'value'))
            ->distinct()
            ->orderBy('kategori')
            ->toBase()
            ->pluck('kategori')
            ->map(fn (string $nama): self => new self($nama))
            ->all();
    }

    /**
     * Kategori untuk nama yang diketik pengguna. Nama yang sama dengan kategori baku atau kategori tambahan
     * yang sudah ada (tanpa membedakan huruf besar-kecil) memakai kategori itu, agar tidak ada kategori kembar.
     *
     * @param  list<self>  $tambahan
     */
    public static function dariNama(string $nama, array $tambahan): KategoriKas|self
    {
        $nama = self::rapikan($nama);

        foreach (KategoriKas::cases() as $kategori) {
            if (strcasecmp($nama, $kategori->value) === 0 || strcasecmp($nama, $kategori->label()) === 0) {
                return $kategori;
            }
        }

        foreach ($tambahan as $kategori) {
            if (mb_strtolower($nama) === mb_strtolower($kategori->value)) {
                return $kategori;
            }
        }

        return new self($nama);
    }

    /**
     * Nama tanpa spasi di awal, akhir, dan spasi ganda.
     */
    public static function rapikan(string $nama): string
    {
        return (string) preg_replace('/\s+/u', ' ', trim($nama));
    }
}
