<?php

namespace App\Livewire;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Periode;
use App\Support\DaftarKaryawan;
use App\Support\LembarPayroll;
use App\Support\LembarRhpp;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

/**
 * Data karyawan: seluruh karyawan kandang, orang yang sama dengan penerima slip di Payroll ABK.
 * Karyawan bisa ditambah, diubah, dan dihapus; slip gaji yang sudah dibuat tetap menyimpan nama dan jabatannya.
 */
#[Title('Karyawan')]
class DataKaryawan extends Component
{
    use MemilihPeriode;

    #[Locked]
    public ?int $karyawanId = null;

    public string $nama = '';

    public string $jabatan = 'ABK';

    public ?int $kandangId = null;

    public string $keterangan = '';

    public string $gajiPokok = '';

    public string $hariKerja = '';

    public string $tanggalGajian = '';

    public ?string $pesan = null;

    #[Locked]
    public ?int $karyawanHapusId = null;

    public string $namaHapus = '';

    /**
     * Periode terbaru yang sudah punya slip gaji; sumber hari kerja dan pendapatan bersih di daftar.
     */
    #[Computed]
    public function periodeSlip(): ?Periode
    {
        return $this->farm?->periodes()
            ->whereHas('kandangPeriode.slipGaji')
            ->orderByDesc('tanggal_chick_in')
            ->first();
    }

    /**
     * Kandang farm terpilih, pilihan tempat bertugas di form karyawan.
     *
     * @return Collection<int, Kandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        return $this->farm ? $this->farm->kandangs()->orderBy('nama')->get() : new Collection;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function daftar(): ?array
    {
        $payroll = null;

        if ($this->periodeSlip) {
            $kandangPeriode = $this->periodeSlip->kandangPeriode()
                ->has('slipGaji')
                ->with(['kandang', 'slipGaji.penerimaBagiHasil', 'slipGaji.potonganKasbon.kasbon.potongan', 'bagiHasil.penerima'])
                ->get();
            $payroll = LembarPayroll::buat($kandangPeriode, LembarRhpp::real($this->periodeSlip->loadMissing(LembarRhpp::RELASI)));
        }

        // Karyawan kandang farm ini, ditambah karyawan yang belum ditempatkan supaya tetap bisa diubah.
        $karyawan = $this->farm
            ? Karyawan::query()
                ->where(fn ($query) => $query
                    ->whereHas('kandang', fn ($kandang) => $kandang->where('farm_id', $this->farm->id))
                    ->orWhereNull('kandang_id'))
                ->with('kandang')
                ->get()
            : collect();

        return DaftarKaryawan::buat($karyawan, $payroll);
    }

    public function tambah(): void
    {
        $this->resetForm();
        $this->pesan = null;
        $this->kandangId = $this->daftarKandang->first()?->id;
    }

    public function ubah(int $id): void
    {
        $karyawan = Karyawan::query()->findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->karyawanId = $karyawan->id;
        $this->nama = $karyawan->nama;
        $this->jabatan = $karyawan->jabatan->value;
        $this->kandangId = $karyawan->kandang_id;
        $this->keterangan = $karyawan->keterangan ?? '';
        $this->gajiPokok = (string) $karyawan->gaji_pokok;
        $this->hariKerja = (string) $karyawan->hari_kerja;
        $this->tanggalGajian = (string) $karyawan->tanggal_gajian;
    }

    public function batal(): void
    {
        $this->resetForm();
    }

    public function simpan(): void
    {
        $this->nama = trim($this->nama);
        $this->keterangan = trim($this->keterangan);
        $this->gajiPokok = trim($this->gajiPokok);
        $this->hariKerja = trim($this->hariKerja);
        $this->tanggalGajian = trim($this->tanggalGajian);
        $data = $this->validate([
            'nama' => [
                'required',
                'string',
                'max:150',
                Rule::unique('karyawans', 'nama')->where('kandang_id', $this->kandangId)->ignore($this->karyawanId),
            ],
            'jabatan' => ['required', Rule::enum(Jabatan::class)],
            'kandangId' => ['nullable', 'integer', Rule::exists('kandangs', 'id')->where('farm_id', $this->farm?->id)],
            'keterangan' => ['nullable', 'string', 'max:255'],
            'gajiPokok' => ['nullable', 'integer', 'min:0', 'max:999999999999'],
            'hariKerja' => ['nullable', 'integer', 'min:0', 'max:366'],
            'tanggalGajian' => ['nullable', 'integer', 'min:1', 'max:31'],
        ], [
            'nama.required' => 'Nama karyawan wajib diisi.',
            'nama.max' => 'Nama karyawan maksimal 150 karakter.',
            'nama.unique' => 'Nama ini sudah terdaftar di kandang yang sama.',
            'jabatan.required' => 'Pilih jabatan karyawan.',
            'jabatan.enum' => 'Jabatan tidak dikenal.',
            'kandangId.exists' => 'Kandang tidak ditemukan di farm ini.',
            'keterangan.max' => 'Keterangan maksimal 255 karakter.',
            'gajiPokok.integer' => 'Gaji pokok harus berupa angka bulat.',
            'gajiPokok.min' => 'Gaji pokok tidak boleh negatif.',
            'gajiPokok.max' => 'Gaji pokok terlalu besar.',
            'hariKerja.integer' => 'Hari kerja harus berupa angka bulat.',
            'hariKerja.min' => 'Hari kerja tidak boleh negatif.',
            'hariKerja.max' => 'Hari kerja maksimal 366 hari.',
            'tanggalGajian.integer' => 'Tanggal gajian harus berupa angka bulat.',
            'tanggalGajian.min' => 'Tanggal gajian antara 1 dan 31.',
            'tanggalGajian.max' => 'Tanggal gajian antara 1 dan 31.',
        ]);

        $mengubah = $this->karyawanId !== null;
        $karyawan = $mengubah ? Karyawan::query()->findOrFail($this->karyawanId) : new Karyawan;

        DB::transaction(function () use ($karyawan, $data, $mengubah): void {
            $karyawan->fill([
                'nama' => $data['nama'],
                'jabatan' => $data['jabatan'],
                'kandang_id' => $data['kandangId'],
                'keterangan' => filled($data['keterangan']) ? $data['keterangan'] : null,
                'gaji_pokok' => filled($data['gajiPokok']) ? (int) $data['gajiPokok'] : null,
                'hari_kerja' => filled($data['hariKerja']) ? (int) $data['hariKerja'] : null,
                'tanggal_gajian' => filled($data['tanggalGajian']) ? (int) $data['tanggalGajian'] : null,
            ]);

            if ($mengubah && ! $karyawan->isDirty()) {
                return;
            }

            $karyawan->save();
            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::Karyawan,
                'Karyawan '.$karyawan->nama,
                $this->rincian($karyawan),
            );
        });

        $this->pesan = 'Karyawan '.$karyawan->nama.($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-karyawan');
        $this->resetForm();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        $karyawan = Karyawan::query()->findOrFail($id);

        $this->resetErrorBag('karyawan_hapus');
        $this->pesan = null;
        $this->karyawanHapusId = $karyawan->id;
        $this->namaHapus = $karyawan->nama;
    }

    public function hapus(): void
    {
        $karyawan = Karyawan::query()->with('kandang')->findOrFail($this->karyawanHapusId ?? abort(404));
        $nama = $karyawan->nama;
        $rincian = $this->rincian($karyawan);

        if ($karyawan->kasbon()->exists()) {
            throw ValidationException::withMessages([
                'karyawan_hapus' => $nama.' masih punya kasbon. Hapus kasbonnya dulu di halaman Kasbon ABK, atau biarkan karyawan ini tetap di daftar.',
            ]);
        }

        DB::transaction(function () use ($karyawan, $nama, $rincian): void {
            $karyawan->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Karyawan, 'Karyawan '.$nama, $rincian);
        });

        $this->karyawanHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Karyawan '.$nama.' dihapus.';
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.data-karyawan');
    }

    /**
     * Jabatan dan kandang untuk rincian riwayat aktivitas: "ABK, Kandang 1".
     */
    private function rincian(Karyawan $karyawan): string
    {
        return $karyawan->jabatan->label().', '.($karyawan->kandang()->value('nama') ?? 'belum ditempatkan');
    }

    private function resetForm(): void
    {
        $this->resetValidation();
        $this->karyawanId = null;
        $this->nama = '';
        $this->jabatan = Jabatan::Abk->value;
        $this->kandangId = null;
        $this->keterangan = '';
        $this->gajiPokok = '';
        $this->hariKerja = '';
        $this->tanggalGajian = '';
    }
}
