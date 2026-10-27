<?php

namespace App\Support;

use App\Models\Kasbon;
use App\Models\Periode;
use App\Models\SlipGaji;

/**
 * Aturan potongan kasbon di slip gaji. Kasbon tidak pernah dipotong otomatis: potongan baru dibuat lewat tombol
 * Potong setelah ada kesepakatan dengan ABK, paling banyak sekali per slip. Slip periode tertutup tidak diubah.
 */
class CicilanKasbon
{
    /**
     * Slip gaji karyawan kasbon ini di periode tersebut; null bila slipnya belum dibuat.
     */
    public static function slipDi(Kasbon $kasbon, Periode $periode): ?SlipGaji
    {
        return SlipGaji::query()
            ->with('periodeKandang.kandang')
            ->where('karyawan_id', $kasbon->karyawan_id)
            ->whereHas('periodeKandang', fn ($query) => $query->where('periode_id', $periode->id))
            ->orderBy('id')
            ->first();
    }

    /**
     * Kasbon dapat dipotong di periode ini bila periodenya belum ditutup, kasbon diambil di periode ini atau
     * sebelumnya pada farm yang sama, dan masih bersisa.
     */
    public static function dapatDipotongDi(Kasbon $kasbon, Periode $periode): bool
    {
        return ! $periode->tertutup()
            && $kasbon->periode->farm_id === $periode->farm_id
            && $kasbon->periode->tanggal_chick_in->lte($periode->tanggal_chick_in)
            && ! $kasbon->lunas();
    }

    /**
     * Kasbon dapat dihapus selama belum ada potongannya di slip periode yang sudah ditutup.
     */
    public static function bolehDihapus(Kasbon $kasbon): bool
    {
        return ! $kasbon->potongan()
            ->whereHas('slipGaji.periodeKandang.periode', fn ($query) => $query->whereIn('status', Periode::STATUS_TERTUTUP))
            ->exists();
    }
}
