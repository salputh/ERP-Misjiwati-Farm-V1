<?php

namespace App\Livewire;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Layout;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Halaman masuk: seluruh halaman aplikasi hanya terbuka bagi pengguna yang sudah masuk.
 * Percobaan yang salah dibatasi per email dan alamat IP supaya password tidak bisa ditebak beruntun.
 */
#[Layout('layouts.tamu')]
#[Title('Masuk')]
class Masuk extends Component
{
    /**
     * Jumlah percobaan salah sebelum formulir dikunci sementara.
     */
    public const BATAS_PERCOBAAN = 5;

    public string $email = '';

    public string $password = '';

    public bool $ingat = false;

    public function masuk(): void
    {
        $this->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Password wajib diisi.',
        ]);

        $kunci = Str::transliterate(Str::lower($this->email)).'|'.request()->ip();

        if (RateLimiter::tooManyAttempts($kunci, self::BATAS_PERCOBAAN)) {
            throw ValidationException::withMessages([
                'email' => 'Terlalu banyak percobaan masuk. Coba lagi dalam '.RateLimiter::availableIn($kunci).' detik.',
            ]);
        }

        if (! Auth::attempt(['email' => $this->email, 'password' => $this->password], $this->ingat)) {
            RateLimiter::hit($kunci);
            $this->reset('password');

            throw ValidationException::withMessages([
                'email' => 'Email atau password salah.',
            ]);
        }

        RateLimiter::clear($kunci);
        session()->regenerate();

        $this->redirectIntended(route('dashboard'));
    }

    public function render(): View
    {
        return view('livewire.masuk');
    }
}
