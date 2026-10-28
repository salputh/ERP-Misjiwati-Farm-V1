<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Enums\StatusMasuk;
use App\Models\Aktivitas;
use App\Models\Sesi;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Akun pengguna: akun untuk masuk ke ERP beserta siapa yang sedang masuk, dibaca dari tabel sessions.
 * Akun yang sedang dipakai tidak bisa dihapus; mengganti password akun lain mengeluarkannya dari semua perangkat.
 */
#[Title('Akun pengguna')]
class DaftarAkun extends Component
{
    #[Locked]
    public ?int $akunId = null;

    public string $nama = '';

    public string $email = '';

    public string $password = '';

    public string $password_confirmation = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $akunHapusId = null;

    public string $namaHapus = '';

    /**
     * Sesi yang belum kedaluwarsa, terbaru dulu.
     *
     * @return Collection<int, Sesi>
     */
    #[Computed]
    public function sesiMasuk(): Collection
    {
        return Sesi::query()->masihMasuk()->whereHas('user')->with('user')->orderByDesc('last_activity')->get();
    }

    /**
     * Seluruh akun urut nama, masing-masing dengan sesinya yang masih masuk dan status masuknya.
     *
     * @return list<array{akun: User, sesi: \Illuminate\Support\Collection<int, Sesi>, status: StatusMasuk, terakhir_aktif: ?Carbon, diri_sendiri: bool}>
     */
    #[Computed]
    public function daftar(): array
    {
        $sesiPerAkun = $this->sesiMasuk->groupBy('user_id');

        return User::query()->orderBy('name')->get()
            ->map(function (User $akun) use ($sesiPerAkun): array {
                $sesi = $sesiPerAkun->get($akun->id, collect());

                return [
                    'akun' => $akun,
                    'sesi' => $sesi,
                    'status' => StatusMasuk::dariSesi($sesi),
                    'terakhir_aktif' => $sesi->first()?->last_activity,
                    'diri_sendiri' => $akun->is(auth()->user()),
                ];
            })
            ->all();
    }

    /**
     * Jumlah akun yang punya sesi online dalam beberapa menit terakhir.
     */
    #[Computed]
    public function jumlahOnline(): int
    {
        return collect($this->daftar)->where('status', StatusMasuk::Online)->count();
    }

    public function tambah(): void
    {
        $this->resetForm();
        $this->pesan = null;
    }

    public function ubah(int $id): void
    {
        $akun = User::query()->findOrFail($id);

        $this->resetForm();
        $this->pesan = null;
        $this->akunId = $akun->id;
        $this->nama = $akun->name;
        $this->email = $akun->email;
    }

    public function batal(): void
    {
        $this->resetForm();
    }

    public function simpan(): void
    {
        $this->nama = Str::squish($this->nama);
        $this->email = Str::lower(trim($this->email));
        $mengubah = $this->akunId !== null;

        $data = $this->validate([
            'nama' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($this->akunId)],
            'password' => [$mengubah ? 'nullable' : 'required', 'string', 'min:'.User::PANJANG_PASSWORD_MINIMAL, 'max:255', 'confirmed'],
        ], [
            'nama.required' => 'Nama wajib diisi.',
            'nama.max' => 'Nama maksimal 255 karakter.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email ini sudah dipakai akun lain.',
            'password.required' => 'Password wajib diisi.',
            'password.min' => 'Password minimal '.User::PANJANG_PASSWORD_MINIMAL.' karakter.',
            'password.confirmed' => 'Pengulangan password tidak sama.',
        ]);

        $akun = $mengubah ? User::query()->findOrFail($this->akunId) : new User;
        $gantiPassword = filled($data['password']);

        DB::transaction(function () use ($akun, $data, $mengubah, $gantiPassword): void {
            $akun->fill(['name' => $data['nama'], 'email' => $data['email']]);

            if ($gantiPassword) {
                $akun->password = $data['password'];
            }

            if ($mengubah && ! $akun->isDirty()) {
                return;
            }

            if ($mengubah && $gantiPassword) {
                // Password baru mengeluarkan akun ini dari perangkat lain, termasuk "ingat saya"; perangkat ini tetap masuk.
                $akun->setRememberToken(Str::random(60));
                $akun->sesi()->whereKeyNot(session()->getId())->delete();
            }

            $akun->save();
            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::Akun,
                'Akun '.$akun->name,
                $akun->email.($mengubah && $gantiPassword ? ', password diganti' : ''),
            );
        });

        $this->pesan = 'Akun '.$akun->name.($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-akun');
        $this->resetForm();
        unset($this->daftar, $this->sesiMasuk);
    }

    public function mintaHapus(int $id): void
    {
        $akun = User::query()->findOrFail($id);

        $this->resetErrorBag('akun_hapus');
        $this->pesan = null;
        $this->akunHapusId = $akun->id;
        $this->namaHapus = $akun->name;
    }

    public function hapus(): void
    {
        $akun = User::query()->findOrFail($this->akunHapusId ?? abort(404));

        if ($akun->is(auth()->user())) {
            throw ValidationException::withMessages([
                'akun_hapus' => 'Akun yang sedang Anda pakai tidak bisa dihapus. Masuk dengan akun lain untuk menghapusnya.',
            ]);
        }

        DB::transaction(function () use ($akun): void {
            $akun->sesi()->delete();
            $akun->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Akun, 'Akun '.$akun->name, $akun->email);
        });

        $this->akunHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Akun '.$akun->name.' dihapus.';
        unset($this->daftar, $this->sesiMasuk);
    }

    public function render(): View
    {
        return view('livewire.daftar-akun');
    }

    private function resetForm(): void
    {
        $this->resetValidation();
        $this->akunId = null;
        $this->nama = '';
        $this->email = '';
        $this->password = '';
        $this->password_confirmation = '';
    }
}
