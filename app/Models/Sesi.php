<?php

namespace App\Models;

use App\Enums\StatusMasuk;
use Database\Factories\SesiFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Satu sesi masuk di tabel sessions bawaan Laravel (SESSION_DRIVER=database). Setiap permintaan memperbarui
 * last_activity, sehingga tabel ini menjadi sumber "siapa yang sedang masuk" tanpa pencatatan tambahan.
 *
 * @property string $id
 * @property ?int $user_id
 * @property ?string $ip_address
 * @property ?string $user_agent
 * @property Carbon $last_activity
 */
class Sesi extends Model
{
    /** @use HasFactory<SesiFactory> */
    use HasFactory;

    /**
     * Pengguna dianggap sedang online bila ada permintaan dalam rentang menit ini.
     */
    public const MENIT_ONLINE = 5;

    protected $table = 'sessions';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    /**
     * Laravel menyimpan last_activity sebagai detik Unix, bukan teks tanggal.
     */
    protected $dateFormat = 'U';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['last_activity' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Sesi milik pengguna yang masuk dan belum kedaluwarsa menurut SESSION_LIFETIME.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function masihMasuk(Builder $query): void
    {
        $query->whereNotNull('user_id')
            ->where('last_activity', '>=', now()->subMinutes((int) config('session.lifetime'))->getTimestamp());
    }

    public function online(): bool
    {
        return $this->last_activity->greaterThanOrEqualTo(now()->subMinutes(self::MENIT_ONLINE));
    }

    public function status(): StatusMasuk
    {
        return $this->online() ? StatusMasuk::Online : StatusMasuk::Diam;
    }

    /**
     * Peramban dan sistem operasi dari user agent: "Chrome di macOS".
     */
    public function perangkat(): string
    {
        $agen = (string) $this->user_agent;

        $peramban = match (true) {
            str_contains($agen, 'Edg/') => 'Edge',
            str_contains($agen, 'OPR/') => 'Opera',
            str_contains($agen, 'Firefox/') => 'Firefox',
            str_contains($agen, 'Chrome/') || str_contains($agen, 'CriOS/') => 'Chrome',
            str_contains($agen, 'Safari/') => 'Safari',
            default => 'Peramban lain',
        };

        $sistem = match (true) {
            str_contains($agen, 'iPhone') || str_contains($agen, 'iPad') => 'iOS',
            str_contains($agen, 'Android') => 'Android',
            str_contains($agen, 'Windows') => 'Windows',
            str_contains($agen, 'Macintosh') => 'macOS',
            str_contains($agen, 'Linux') => 'Linux',
            default => null,
        };

        return $sistem ? "{$peramban} di {$sistem}" : $peramban;
    }

    /**
     * Ikon Unicons sesuai jenis perangkat: HP atau komputer.
     */
    public function ikon(): string
    {
        return preg_match('/iPhone|Android|Mobile/', (string) $this->user_agent) ? 'bi-phone' : 'bi-display';
    }
}
