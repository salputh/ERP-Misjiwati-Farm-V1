<div class="signin-page">
    <div data-signin-sky class="signin-sky">
        <div aria-hidden="true" class="signin-sky-art">
            <i class="signin-sky-stars"></i>
            <i class="signin-sky-stars signin-sky-stars-b"></i>
            <i class="signin-sky-sun"></i>
            <i class="signin-sky-clouds"></i>
            <svg aria-hidden="true" class="signin-sky-hills" viewBox="0 0 1440 230" preserveAspectRatio="none">
                <path d="M0 120 C160 60 300 90 440 70 S720 20 880 60 S1180 110 1300 70 S1420 60 1440 70 V230 H0Z" class="signin-hill-back" />
                <path d="M0 160 C180 120 320 150 520 125 S820 100 980 135 S1260 170 1440 130 V230 H0Z" class="signin-hill-mid" />
                <path d="M0 200 C240 170 480 190 720 182 S1200 170 1440 196 V230 H0Z" class="signin-hill-front" />
            </svg>
        </div>
        <header class="signin-top">
            <a aria-label="Misjiwati Farm" href="{{ route('login') }}" class="signin-brand">
                <svg aria-hidden="true" viewBox="0 0 32 32">
                    <path d="M2.75 27.5V17L5.5 15.5L8.25 17V27.5Z M9.75 27.5V10L12.5 8.5L15.25 10V27.5Z M16.75 27.5V13.5L19.5 12L22.25 13.5V27.5Z M23.75 27.5V6L26.5 4.5L29.25 6V27.5Z" />
                </svg><span>Misjiwati Farm</span>
            </a>
            <button data-basalt-chrome="mode" aria-label="Ganti mode terang atau gelap" type="button" class="signin-theme-toggle">
                <i class="bi bi-moon"></i>
                <i class="bi bi-brightness-high"></i>
            </button>
        </header>
        <section aria-label="Tentang langkah ini" class="signin-intro">
            <p data-signin-clock class="signin-eyebrow">Masuk</p>
            <h1 data-signin-greeting="" class="signin-title">Selamat datang kembali.</h1>
        </section>
    </div>

    <main class="signin-main">
        {{-- Email, password, dan tombol masuk berada dalam satu baris. Pengiriman dan validasi ditangani Livewire. --}}
        <form wire:submit="masuk" novalidate>
            <div class="signin-row">
                <div class="signin-field">
                    <div class="signin-label"><label for="email">Email</label></div>
                    <div class="signin-box">
                        <input id="email" type="email" wire:model="email" placeholder="nama@email.com" autocomplete="username" autofocus @class(['form-control', 'is-invalid' => $errors->has('email')]) required>
                    </div>
                    @error('email')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="signin-field">
                    <div class="signin-label"><label for="password">Password</label></div>
                    <div class="signin-box">
                        <input id="password" type="password" wire:model="password" placeholder="Password akun Anda" autocomplete="current-password" @class(['form-control', 'is-invalid' => $errors->has('password')]) required>
                        <button data-signin-password-toggle="password" aria-label="Tampilkan password" type="button" class="signin-toggle-pw">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                    @error('password')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                </div>
                <div class="signin-row-go">
                    <button type="submit" class="signin-btn" wire:loading.attr="disabled" wire:target="masuk">
                        <span wire:loading.remove wire:target="masuk">Masuk</span>
                        <span wire:loading wire:target="masuk">Memeriksa…</span>
                        <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
            <div class="signin-sub">
                <label class="signin-check"><input id="ingat" type="checkbox" wire:model="ingat"> Tetap masuk di perangkat ini</label>
            </div>
        </form>
    </main>

    <footer class="signin-foot">
        Belum punya akun? Minta pemilik farm untuk membuatkannya.
    </footer>
</div>
