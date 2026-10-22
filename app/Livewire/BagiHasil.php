<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Enums\PeranBagiHasil;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\BagiHasil as ModelBagiHasil;
use App\Models\Kandang;
use App\Models\Pemodal;
use App\Models\PenerimaBagiHasil;
use App\Models\Pengaturan;
use App\Models\PeriodeKandang;
use App\Models\SlipGaji;
use App\Support\BukuKas;
use App\Support\LembarBagiHasil;
use App\Support\LembarRhpp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Component;

/**
 * Bagi hasil satu kandang: pendapatan dari RHPP real, potongan berurutan, pembagian ABK dan pemodal.
 */
class BagiHasil extends Component
{
    use MemilihPeriode;

    #[Locked]
    public Kandang $kandang;

    /**
     * @var array{
     *     controller: string,
     *     operasional: string,
     *     tarif_gaji_abk_per_kg: string,
     *     premi_pemeliharaan_abk: string,
     *     premi_controller: string,
     *     persen_upah_controller: string,
     *     persen_bonus_pasar_abk: string,
     *     persen_bonus_pasar_controller: string,
     *     persen_zakat: string
     * }
     */
    public array $masukan = [];

    /** @var list<array{id: ?int, nama: string, keterangan: string, jumlah: string}> */
    public array $abk = [];

    /** @var list<array{id: ?int, nama: string, jumlah: string}> */
    public array $entertain = [];

    /** @var list<array{id: ?int, nama: string, persen: string}> */
    public array $pemodal = [];

    public ?string $pesan = null;

    /**
     * Password admin yang diminta saat mengunci lembar bagi hasil.
     */
    public string $sandiAdmin = '';

    /**
     * Konfirmasi password admin saat password baru ditetapkan.
     */
    public string $sandiAdminUlang = '';

    public function mount(Kandang $kandang): void
    {
        abort_unless($kandang->farm_id === $this->farm?->id, 404);

        $this->kandang = $kandang;
        $this->muatForm();
    }

    /**
     * Siapkan modal untuk mengunci lembar bagi hasil.
     */
    public function bukaModalKunci(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
    }

    /**
     * Kunci lembar bagi hasil burung. Bila password admin belum pernah ditetapkan, password itu
     * ditetapkan pada langkah yang sama.
     */
    public function kunciBagiHasil(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periodeKandang = $this->periodeKandang ?? abort(404);
        $bagiHasil = $periodeKandang->bagiHasil ?? abort(404);

        if ($bagiHasil->terkunci()) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Lembar bagi hasil ini sudah dikunci.',
            ]);
        }

        $sandiBaru = ! Pengaturan::passwordAdminTeratur();
        $aturan = ['sandiAdmin' => ['required', 'string', 'min:4', 'max:100']];
        if ($sandiBaru) {
            $aturan['sandiAdminUlang'] = ['required', 'same:sandiAdmin'];
        }

        $this->validate($aturan, [
            'sandiAdmin.required' => 'Password admin wajib diisi.',
            'sandiAdmin.min' => 'Password admin minimal 4 karakter.',
            'sandiAdminUlang.required' => 'Ulangi password admin.',
            'sandiAdminUlang.same' => 'Pengulangan password tidak sama.',
        ]);

        if (! $sandiBaru && ! Pengaturan::cocokPasswordAdmin($this->sandiAdmin)) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Password admin salah.',
            ]);
        }

        DB::transaction(function () use ($bagiHasil, $periodeKandang, $sandiBaru): void {
            if ($sandiBaru) {
                Pengaturan::setPasswordAdmin($this->sandiAdmin);
            }

            $bagiHasil->update(['status' => ModelBagiHasil::DIKUNCI]);
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::BagiHasil,
                'Bagi hasil '.$this->kandang->nama.' pada '.$periodeKandang->periode->nama,
                $sandiBaru ? 'Lembar dikunci, password admin ditetapkan' : 'Lembar dikunci',
            );
        });

        $this->pesan = 'Lembar bagi hasil '.$this->kandang->nama.' dikunci.';
        $this->dispatch('tutup-modal-kunci-bagi-hasil');
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        unset($this->lembar, $this->periodeKandang);
    }

    public function updatedPeriodeId(): void
    {
        unset($this->lembar, $this->periodeKandang, $this->rhpp);
        $this->muatForm();
    }

    public function updatedFarmId(): void
    {
        unset($this->lembar, $this->periodeKandang, $this->rhpp);
        $this->muatForm();
    }

    public function tambahAbk(): void
    {
        $this->pastikanEditorKandangDua();
        $this->abk[] = ['id' => null, 'nama' => '', 'keterangan' => '', 'jumlah' => ''];
    }

    public function hapusAbk(int $indeks): void
    {
        $this->pastikanEditorKandangDua();
        unset($this->abk[$indeks]);
        $this->abk = array_values($this->abk);
    }

    /**
     * Data yang akan dihapus setelah konfirmasi, dengan tipe (abk, entertain, pemodal) dan indeks baris.
     *
     * @var array{tipe: string, indeks: int}|null
     */
    public ?array $hapusTarget = null;

    public function mintaHapus(string $tipe, int $indeks): void
    {
        $this->hapusTarget = ['tipe' => $tipe, 'indeks' => $indeks];
    }

    public function konfirmasiHapus(): void
    {
        $target = $this->hapusTarget;
        $this->hapusTarget = null;

        if ($target === null) {
            return;
        }

        match ($target['tipe']) {
            'abk' => $this->hapusAbk($target['indeks']),
            'entertain' => $this->hapusEntertain($target['indeks']),
            'pemodal' => $this->hapusPemodal($target['indeks']),
            default => null,
        };
    }

    /**
     * Nama yang akan dihapus, untuk pesan konfirmasi.
     */
    public function namaHapusTarget(): string
    {
        $target = $this->hapusTarget;

        if ($target === null) {
            return '';
        }

        $daftar = match ($target['tipe']) {
            'abk' => $this->abk,
            'entertain' => $this->entertain,
            'pemodal' => $this->pemodal,
            default => [],
        };

        return (string) ($daftar[$target['indeks']]['nama'] ?? '');
    }

    public function tambahEntertain(): void
    {
        $this->pastikanEditorKandangDua();
        $this->entertain[] = ['id' => null, 'nama' => '', 'jumlah' => ''];
    }

    public function hapusEntertain(int $indeks): void
    {
        $this->pastikanEditorKandangDua();
        unset($this->entertain[$indeks]);
        $this->entertain = array_values($this->entertain);
    }

    public function tambahPemodal(): void
    {
        $this->pastikanEditorKandangDua();
        $this->pemodal[] = ['id' => null, 'nama' => '', 'persen' => ''];
    }

    public function hapusPemodal(int $indeks): void
    {
        $this->pastikanEditorKandangDua();
        unset($this->pemodal[$indeks]);
        $this->pemodal = array_values($this->pemodal);
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periodeKandang = $this->periodeKandang ?? abort(404);
        abort_unless($this->kandang->nama === 'Kandang 2', 403);
        abort_unless($periodeKandang->bagiHasil, 404);

        if ($periodeKandang->bagiHasil->terkunci()) {
            throw ValidationException::withMessages([
                'masukan' => 'Lembar bagi hasil ini dikunci. Buka kuncinya dari halaman Periode sebelum mengubah.',
            ]);
        }

        $this->rapikanMasukanForm();

        $data = $this->validate([
            'masukan.controller' => ['nullable', 'string', 'max:150'],
            'masukan.tarif_gaji_abk_per_kg' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukan.premi_pemeliharaan_abk' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukan.premi_controller' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukan.persen_upah_controller' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukan.persen_bonus_pasar_abk' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukan.persen_bonus_pasar_controller' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukan.persen_zakat' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'abk' => ['required', 'array', 'min:1'],
            'abk.*.id' => ['nullable', 'integer'],
            'abk.*.nama' => ['required', 'string', 'max:150'],
            'abk.*.keterangan' => ['nullable', 'string', 'max:150'],
            'abk.*.jumlah' => ['nullable', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'entertain' => ['present', 'array'],
            'entertain.*.id' => ['nullable', 'integer'],
            'entertain.*.nama' => ['required', 'string', 'max:150'],
            'entertain.*.jumlah' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'pemodal' => ['required', 'array', 'min:1'],
            'pemodal.*.id' => ['nullable', 'integer'],
            'pemodal.*.nama' => ['required', 'string', 'max:150'],
            'pemodal.*.persen' => ['required', 'numeric', 'decimal:0,3', 'gt:0', 'max:100'],
        ], [
            'masukan.*.required' => 'Bagian ini wajib diisi.',
            'masukan.*.integer' => 'Masukkan angka bulat yang valid.',
            'masukan.*.numeric' => 'Masukkan angka persentase yang valid.',
            'masukan.*.max' => 'Nilai tidak boleh lebih dari 100.',
            'abk.min' => 'Minimal satu ABK harus tercantum.',
            'abk.*.nama.required' => 'Nama ABK wajib diisi.',
            'entertain.*.nama.required' => 'Nama penerima entertain wajib diisi.',
            'entertain.*.jumlah.required' => 'Jumlah entertain wajib diisi.',
            'pemodal.min' => 'Minimal satu pemodal harus tercantum.',
            'pemodal.*.nama.required' => 'Nama pemodal wajib diisi.',
            'pemodal.*.persen.required' => 'Porsi pemodal wajib diisi.',
        ]);

        $jumlahPorsiPemodal = (int) collect($data['pemodal'])
            ->sum(fn (array $satu): int => (int) round((float) $satu['persen'] * 1000));

        if ($jumlahPorsiPemodal !== 100_000) {
            throw ValidationException::withMessages([
                'pemodal' => 'Jumlah porsi seluruh pemodal harus tepat 100%.',
            ]);
        }

        DB::transaction(function () use ($data, $periodeKandang): void {
            $terkunci = PeriodeKandang::query()->lockForUpdate()->findOrFail($periodeKandang->id);
            $bagiHasil = $terkunci->bagiHasil()->lockForUpdate()->firstOrFail();
            $bagiHasil->update([
                'controller' => $data['masukan']['controller'] ?: null,
                'operasional' => $this->operasional,
                'tarif_gaji_abk_per_kg' => $data['masukan']['tarif_gaji_abk_per_kg'],
                'premi_pemeliharaan_abk' => $data['masukan']['premi_pemeliharaan_abk'],
                'premi_controller' => $data['masukan']['premi_controller'],
                'persen_upah_controller' => $data['masukan']['persen_upah_controller'],
                'persen_bonus_pasar_abk' => $data['masukan']['persen_bonus_pasar_abk'],
                'persen_bonus_pasar_controller' => $data['masukan']['persen_bonus_pasar_controller'],
                'persen_zakat' => $data['masukan']['persen_zakat'],
            ]);

            $this->simpanPenerima($bagiHasil, PeranBagiHasil::Abk, $data['abk']);
            $this->simpanPenerima($bagiHasil, PeranBagiHasil::Entertain, $data['entertain']);
            $this->simpanPenerima($bagiHasil, PeranBagiHasil::Pemodal, $data['pemodal']);
        });

        unset($this->lembar, $this->periodeKandang, $this->rhpp);
        $this->muatForm();
        $this->pesan = 'Data bagi hasil Kandang 2 berhasil disimpan.';
    }

    /**
     * Kandang ini pada periode terpilih; null bila kandang tidak dipakai di periode itu.
     */
    #[Computed]
    public function periodeKandang(): ?PeriodeKandang
    {
        return $this->periode?->kandangPeriode()
            ->where('kandang_id', $this->kandang->id)
            ->with(['bagiHasil.penerima', 'transaksiKas'])
            ->first();
    }

    /**
     * RHPP real periode terpilih; sumber pendapatan per kandang.
     *
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function rhpp(): ?array
    {
        return $this->periode ? LembarRhpp::real($this->periode->loadMissing(LembarRhpp::RELASI)) : null;
    }

    /**
     * Apakah lembar bagi hasil kandang ini pada periode terpilih dikunci.
     */
    #[Computed]
    public function bagiHasilTerkunci(): bool
    {
        return (bool) $this->periodeKandang?->bagiHasil?->terkunci();
    }

    /**
     * Apakah password admin sudah pernah ditetapkan.
     */
    #[Computed]
    public function sandiAdminTeratur(): bool
    {
        return Pengaturan::passwordAdminTeratur();
    }

    /**
     * Nama berkas untuk hasil ekspor (PDF dan PNG).
     */
    #[Computed]
    public function namaBerkasGambar(): string
    {
        return Str::slug('bagi-hasil-'.$this->kandang->nama.'-'.($this->periode?->nama ?? 'tanpa-periode'));
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function lembar(): ?array
    {
        if (! $this->periodeKandang) {
            return null;
        }

        return LembarBagiHasil::buat($this->periodeKandang, $this->rhpp, BukuKas::buat($this->periodeKandang));
    }

    /**
     * Biaya operasional 시기 diambil dari buku kas, tidak diketik.
     */
    #[Computed]
    public function operasional(): int
    {
        $periodeKandang = $this->periodeKandang;
        if (! $periodeKandang) {
            return 0;
        }

        $dariKas = BukuKas::buat($periodeKandang)['ringkasan']['biaya'] ?? null;

        return (int) ($dariKas ?? $periodeKandang->bagiHasil?->operasional ?? 0);
    }

    public function render(): View
    {
        return view('livewire.bagi-hasil')->title('Bagi hasil '.$this->kandang->nama);
    }

    private function muatForm(): void
    {
        $masukan = $this->periodeKandang?->bagiHasil;
        $this->pesan = null;
        $this->resetValidation();

        if (! $masukan || $this->kandang->nama !== 'Kandang 2') {
            $this->masukan = [];
            $this->abk = [];
            $this->entertain = [];
            $this->pemodal = [];

            return;
        }

        $this->masukan = [
            'controller' => (string) ($masukan->controller ?? ''),
            'operasional' => (string) $this->operasional,
            'tarif_gaji_abk_per_kg' => (string) $masukan->tarif_gaji_abk_per_kg,
            'premi_pemeliharaan_abk' => (string) $masukan->premi_pemeliharaan_abk,
            'premi_controller' => (string) $masukan->premi_controller,
            'persen_upah_controller' => (string) $masukan->persen_upah_controller,
            'persen_bonus_pasar_abk' => (string) $masukan->persen_bonus_pasar_abk,
            'persen_bonus_pasar_controller' => (string) $masukan->persen_bonus_pasar_controller,
            'persen_zakat' => (string) $masukan->persen_zakat,
        ];

        $this->abk = $masukan->penerimaBerperan(PeranBagiHasil::Abk)
            ->map(fn (PenerimaBagiHasil $satu): array => [
                'id' => $satu->id,
                'nama' => $satu->nama,
                'keterangan' => (string) ($satu->keterangan ?? ''),
                'jumlah' => (string) ($satu->jumlah ?? ''),
            ])->all();
        $this->entertain = $masukan->penerimaBerperan(PeranBagiHasil::Entertain)
            ->map(fn (PenerimaBagiHasil $satu): array => [
                'id' => $satu->id,
                'nama' => $satu->nama,
                'jumlah' => (string) ($satu->jumlah ?? 0),
            ])->all();
        $pemodal = $masukan->penerimaBerperan(PeranBagiHasil::Pemodal);
        if ($pemodal->isEmpty()) {
            $this->pemodal = $this->kandang->pemodal
                ->map(fn (Pemodal $satu): array => [
                    'id' => null,
                    'nama' => $satu->nama,
                    'persen' => (string) $satu->pivot->persen,
                ])->all();

            return;
        }

        $this->pemodal = $pemodal
            ->map(fn (PenerimaBagiHasil $satu): array => [
                'id' => $satu->id,
                'nama' => $satu->nama,
                'persen' => (string) ($satu->persen ?? ''),
            ])->all();
    }

    private function pastikanEditorKandangDua(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        abort_unless($this->kandang->nama === 'Kandang 2', 403);
        abort_unless($this->periodeKandang?->bagiHasil, 404);
        abort_if($this->periodeKandang->bagiHasil->terkunci(), 403, 'Lembar bagi hasil ini dikunci. Buka kuncinya dari halaman Periode.');
    }

    private function rapikanMasukanForm(): void
    {
        foreach (['controller'] as $kolom) {
            $this->masukan[$kolom] = trim($this->masukan[$kolom] ?? '');
        }

        foreach ($this->abk as $indeks => $satu) {
            $this->abk[$indeks]['nama'] = trim($satu['nama'] ?? '');
            $this->abk[$indeks]['keterangan'] = trim($satu['keterangan'] ?? '');
        }

        foreach (['entertain', 'pemodal'] as $daftar) {
            foreach ($this->{$daftar} as $indeks => $satu) {
                $this->{$daftar}[$indeks]['nama'] = trim($satu['nama'] ?? '');
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $baris
     */
    private function simpanPenerima(ModelBagiHasil $bagiHasil, PeranBagiHasil $peran, array $baris): void
    {
        $tersimpan = $bagiHasil->penerimaBerperan($peran);
        $dipertahankan = [];

        foreach ($baris as $urutan => $data) {
            $penerima = isset($data['id'])
                ? $tersimpan->firstWhere('id', (int) $data['id'])
                : null;

            if (isset($data['id']) && ! $penerima) {
                throw ValidationException::withMessages([
                    strtolower($peran->name) => 'Penerima yang dipilih tidak termasuk lembar bagi hasil ini.',
                ]);
            }

            $penerima ??= new PenerimaBagiHasil;
            $penerima->fill([
                'peran' => $peran,
                'nama' => $data['nama'],
                'keterangan' => $peran === PeranBagiHasil::Abk ? ($data['keterangan'] ?: null) : null,
                'jumlah' => match ($peran) {
                    PeranBagiHasil::Abk => ($data['jumlah'] ?? '') === '' ? null : $data['jumlah'],
                    PeranBagiHasil::Entertain => $data['jumlah'],
                    default => null,
                },
                'persen' => $peran === PeranBagiHasil::Pemodal ? $data['persen'] : null,
                'dijumlahkan' => true,
                'urutan' => $urutan + 1,
            ]);
            $bagiHasil->penerima()->save($penerima);
            $dipertahankan[] = $penerima->id;
        }

        $dihapus = $tersimpan->whereNotIn('id', $dipertahankan);
        if ($peran === PeranBagiHasil::Abk && $dihapus->isNotEmpty()) {
            $terkaitPayroll = SlipGaji::query()
                ->whereIn('penerima_bagi_hasil_id', $dihapus->modelKeys())
                ->exists();

            if ($terkaitPayroll) {
                throw ValidationException::withMessages([
                    'abk' => 'ABK yang sudah terhubung ke slip gaji tidak dapat dihapus. Ubah nama atau data premi saja.',
                ]);
            }
        }

        $dihapus->each->delete();
    }
}
