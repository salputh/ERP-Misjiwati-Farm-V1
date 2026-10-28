<?php

namespace Database\Factories;

use App\Models\Sesi;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Sesi>
 */
class SesiFactory extends Factory
{
    /**
     * Sesi pengguna yang baru saja membuka aplikasi dari Chrome di macOS.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => Str::random(40),
            'user_id' => User::factory(),
            'ip_address' => fake()->ipv4(),
            'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'payload' => base64_encode(serialize([])),
            'last_activity' => now()->getTimestamp(),
        ];
    }

    /**
     * Sesi dari Safari di iPhone.
     */
    public function iphone(): static
    {
        return $this->state(fn (array $attributes): array => [
            'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        ]);
    }

    /**
     * Sesi yang terakhir dipakai sekian menit lalu.
     */
    public function terakhirAktif(int $menitLalu): static
    {
        return $this->state(fn (array $attributes): array => [
            'last_activity' => now()->subMinutes($menitLalu)->getTimestamp(),
        ]);
    }
}
