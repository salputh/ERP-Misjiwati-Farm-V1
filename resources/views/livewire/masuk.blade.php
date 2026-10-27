<div class="container-fluid">
    <div class="row justify-content-center">
        <div class="col-xxl-3 col-xl-4 col-md-6 col-sm-8">
            <div class="edit-profile">
                <div class="edit-profile__logos">
                    <span class="navbar-brand brand-teks">Misjiwati Farm</span>
                </div>
                <div class="card border-0">
                    <div class="card-header">
                        <div class="edit-profile__title">
                            <h6>Masuk ke ERP</h6>
                        </div>
                    </div>
                    <div class="card-body">
                        <form wire:submit="masuk">
                            <div class="edit-profile__body">
                                <x-masukan
                                    id="email"
                                    tipe="email"
                                    label="Email"
                                    wire:model="email"
                                    autocomplete="username"
                                    autofocus
                                    :kesalahan="$errors->first('email')" />

                                <x-masukan
                                    id="password"
                                    tipe="password"
                                    label="Password"
                                    wire:model="password"
                                    autocomplete="current-password"
                                    :kesalahan="$errors->first('password')" />

                                <div class="admin-condition">
                                    <div class="checkbox-theme-default custom-checkbox">
                                        <input class="checkbox" type="checkbox" id="ingat" wire:model="ingat">
                                        <label for="ingat">
                                            <span class="checkbox-text">Tetap masuk di perangkat ini</span>
                                        </label>
                                    </div>
                                </div>
                                <div class="admin__button-group button-group d-flex pt-1 justify-content-md-start justify-content-center">
                                    <x-tombol tipe="submit" ukuran="default" class="w-100 lh-normal px-50 signIn-createBtn" wire:loading.attr="disabled" wire:target="masuk">
                                        <span wire:loading.remove wire:target="masuk">Masuk</span>
                                        <span wire:loading wire:target="masuk">Memeriksa…</span>
                                    </x-tombol>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="admin-topbar">
                        <p class="mb-0">Belum punya akun? Minta pemilik farm untuk membuatkannya.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
