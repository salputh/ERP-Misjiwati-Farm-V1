<?php

namespace App\Enums;

/**
 * Peran seseorang di lembar bagi hasil satu kandang.
 */
enum PeranBagiHasil: string
{
    /** Anak kandang; jumlah berisi premi tetapnya (misalnya ketua ABK), bila ada. */
    case Abk = 'abk';

    /** Penerima bonus pasar perorangan di luar ABK dan controller; jumlah berisi bonusnya. */
    case BonusPasar = 'bonus-pasar';

    /** Penerima entertain; jumlah berisi nilainya. */
    case Entertain = 'entertain';

    /** Pemodal; persen berisi porsinya atas sisa akhir. */
    case Pemodal = 'pemodal';
}
