<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Enums\PeranBagiHasil;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\BagiHasil;
use App\Models\HargaDoc;
use App\Models\NotaPanen;
use App\Models\Pengaturan;
use App\Models\Periode;
use App\Models\PeriodeKandang;
use App\Models\RhppReal;
use App\Models\RhppSimulasi;
use App\Support\BukuKas;
use App\Support\Format;
use App\Support\LembarBagiHasil;
use App\Support\LembarRhpp;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('RHPP')]
class Rhpp extends Component
{
    use MemilihPeriode;

    private const TAB = ['simulasi', 'bagi-hasil', 'real', 'sapronak'];

    /**
     * Tab yang dibuka pertama kali: RHPP real, karena berisi hasil usaha yang dipakai jadi acuan.
     */
    private const TAB_AWAL = 'real';

    #[Url(as: 'tab')]
    public string $tab = self::TAB_AWAL;

    public string $tarifEfisiensiPerKg = '260';

    public ?string $pesan = null;

    public ?string $sumberAsumsiBagiHasil = null;

    /** @var array<string, string> */
    public array $masukanBagiHasil = [];

    /** @var list<array{nama: string, keterangan: string, jumlah: string}> */
    public array $abkSimulasi = [];

    /** @var list<array{nama: string, jumlah: string}> */
    public array $entertainSimulasi = [];

    /** @var list<array{nama: string, persen: string}> */
    public array $pemodalSimulasi = [];

    /** @var array<string, mixed>|null */
    public ?array $hasilSimulasiBagiHasil = null;

    /** @var array<string, string> */
    public array $masukanReal = [];

    /** @var array<string, string> */
    public array $hargaPanenReal = [];

    /**
     * Password admin yang diminta saat mengunci atau membuka kunci RHPP real.
     */
    public string $sandiAdmin = '';

    /**
     * Konfirmasi password admin saat password baru ditetapkan.
     */
    public string $sandiAdminUlang = '';

    /**
     * Password lama saat password admin diganti.
     */
    public string $sandiAdminLama = '';

    /**
     * Mode modal kunci: 'kunci' mengunci, 'buka' membuka kembali, 'ganti' mengganti password admin.
     */
    public string $modeKunci = 'kunci';

    public function mount(): void
    {
        $this->pilihTab($this->tab);
        $this->muatFormSimulasi();
        $this->muatFormBagiHasil();
        $this->muatFormReal();
    }

    public function updatedPeriodeId(): void
    {
        unset($this->periodeKandangKedua, $this->simulasi, $this->real, $this->sapronak);
        $this->muatFormSimulasi();
        $this->muatFormBagiHasil();
        $this->muatFormReal();
    }

    public function updatedFarmId(): void
    {
        unset($this->periodeKandangKedua, $this->simulasi, $this->real, $this->sapronak);
        $this->muatFormSimulasi();
        $this->muatFormBagiHasil();
        $this->muatFormReal();
    }

    public function updatedMasukanBagiHasil(mixed $value, ?string $key = null): void
    {
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function updatedAbkSimulasi(mixed $value, ?string $key = null): void
    {
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function updatedEntertainSimulasi(mixed $value, ?string $key = null): void
    {
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function updatedPemodalSimulasi(mixed $value, ?string $key = null): void
    {
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function pilihTab(string $tab): void
    {
        $this->tab = in_array($tab, self::TAB, true) ? $tab : self::TAB_AWAL;
    }

    public function tambahAbkSimulasi(): void
    {
        $this->abkSimulasi[] = ['nama' => '', 'keterangan' => '', 'jumlah' => ''];
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function hapusAbkSimulasi(int $indeks): void
    {
        unset($this->abkSimulasi[$indeks]);
        $this->abkSimulasi = array_values($this->abkSimulasi);
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function tambahEntertainSimulasi(): void
    {
        $this->entertainSimulasi[] = ['nama' => '', 'jumlah' => ''];
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function hapusEntertainSimulasi(int $indeks): void
    {
        unset($this->entertainSimulasi[$indeks]);
        $this->entertainSimulasi = array_values($this->entertainSimulasi);
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function tambahPemodalSimulasi(): void
    {
        $this->pemodalSimulasi[] = ['nama' => '', 'persen' => ''];
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function hapusPemodalSimulasi(int $indeks): void
    {
        unset($this->pemodalSimulasi[$indeks]);
        $this->pemodalSimulasi = array_values($this->pemodalSimulasi);
        $this->perbaruiHasilSimulasiBagiHasil();
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
            'abk' => $this->hapusAbkSimulasi($target['indeks']),
            'entertain' => $this->hapusEntertainSimulasi($target['indeks']),
            'pemodal' => $this->hapusPemodalSimulasi($target['indeks']),
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
            'abk' => $this->abkSimulasi,
            'entertain' => $this->entertainSimulasi,
            'pemodal' => $this->pemodalSimulasi,
            default => [],
        };

        return (string) ($daftar[$target['indeks']]['nama'] ?? '');
    }

    private function perbaruiHasilSimulasiBagiHasil(): void
    {
        $this->hasilSimulasiBagiHasil = null;
        $this->resetValidation();

        $periodeKandang = $this->periodeKandangKedua;
        $simulasi = $this->simulasi;
        if (! $periodeKandang || ! ($simulasi['hasil'] ?? null)) {
            return;
        }

        $this->rapikanMasukanBagiHasil();

        $validator = Validator::make([
            'masukanBagiHasil' => $this->masukanBagiHasil,
            'abkSimulasi' => $this->abkSimulasi,
            'entertainSimulasi' => $this->entertainSimulasi,
            'pemodalSimulasi' => $this->pemodalSimulasi,
        ], [
            'masukanBagiHasil.controller' => ['nullable', 'string', 'max:150'],
            'masukanBagiHasil.operasional' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanBagiHasil.tarif_gaji_abk_per_kg' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanBagiHasil.premi_pemeliharaan_abk' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanBagiHasil.premi_controller' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanBagiHasil.persen_upah_controller' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukanBagiHasil.persen_bonus_pasar_abk' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukanBagiHasil.persen_bonus_pasar_controller' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukanBagiHasil.persen_zakat' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'abkSimulasi' => ['required', 'array', 'min:1'],
            'abkSimulasi.*.nama' => ['required', 'string', 'max:150'],
            'abkSimulasi.*.keterangan' => ['nullable', 'string', 'max:150'],
            'abkSimulasi.*.jumlah' => ['nullable', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'entertainSimulasi' => ['present', 'array'],
            'entertainSimulasi.*.nama' => ['required', 'string', 'max:150'],
            'entertainSimulasi.*.jumlah' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'pemodalSimulasi' => ['required', 'array', 'min:1'],
            'pemodalSimulasi.*.nama' => ['required', 'string', 'max:150'],
            'pemodalSimulasi.*.persen' => ['required', 'numeric', 'decimal:0,3', 'gt:0', 'max:100'],
        ], [
            'masukanBagiHasil.*.required' => 'Bagian ini wajib diisi.',
            'masukanBagiHasil.*.integer' => 'Masukkan angka bulat yang valid.',
            'masukanBagiHasil.*.numeric' => 'Masukkan angka persentase yang valid.',
            'abkSimulasi.min' => 'Minimal satu ABK harus tercantum.',
            'abkSimulasi.*.nama.required' => 'Nama ABK wajib diisi.',
            'entertainSimulasi.*.nama.required' => 'Nama penerima entertain wajib diisi.',
            'entertainSimulasi.*.jumlah.required' => 'Jumlah entertain wajib diisi.',
            'pemodalSimulasi.min' => 'Minimal satu pemodal harus tercantum.',
            'pemodalSimulasi.*.nama.required' => 'Nama pemodal wajib diisi.',
            'pemodalSimulasi.*.persen.required' => 'Porsi pemodal wajib diisi.',
        ]);

        if ($validator->fails()) {
            $this->setErrorBag($validator->errors());

            return;
        }

        $data = $validator->validated();
        $jumlahPorsiPemodal = (int) collect($data['pemodalSimulasi'])
            ->sum(fn (array $satu): int => (int) round((float) $satu['persen'] * 1000));
        if ($jumlahPorsiPemodal !== 100_000) {
            $this->addError('pemodalSimulasi', 'Jumlah porsi seluruh pemodal harus tepat 100%.');

            return;
        }

        $this->hasilSimulasiBagiHasil = LembarBagiHasil::simulasi(
            $periodeKandang,
            $simulasi,
            [
                ...$data['masukanBagiHasil'],
                'penerima' => [
                    ...collect($data['abkSimulasi'])->map(fn (array $satu): array => [
                        'peran' => PeranBagiHasil::Abk,
                        'nama' => $satu['nama'],
                        'keterangan' => $satu['keterangan'] ?: null,
                        'jumlah' => $satu['jumlah'] === '' ? null : $satu['jumlah'],
                        'dijumlahkan' => true,
                    ])->all(),
                    ...collect($data['entertainSimulasi'])->map(fn (array $satu): array => [
                        'peran' => PeranBagiHasil::Entertain,
                        'nama' => $satu['nama'],
                        'jumlah' => $satu['jumlah'],
                        'dijumlahkan' => true,
                    ])->all(),
                    ...collect($data['pemodalSimulasi'])->map(fn (array $satu): array => [
                        'peran' => PeranBagiHasil::Pemodal,
                        'nama' => $satu['nama'],
                        'persen' => $satu['persen'],
                        'dijumlahkan' => true,
                    ])->all(),
                ],
            ],
        );

    }

    public function simpanSimulasi(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode ?? abort(404);
        $data = $this->validate([
            'tarifEfisiensiPerKg' => ['required', 'integer', 'min:0', 'max:4294967295'],
        ]);
        $hargaDoc = HargaDoc::query()->findOrFail(HargaDoc::GLOBAL_ID);
        $sapronak = LembarRhpp::sapronakSimulasi($periode);

        RhppSimulasi::query()->updateOrCreate(
            ['periode_id' => $periode->id],
            [
                'tarif_efisiensi_per_kg' => $data['tarifEfisiensiPerKg'],
                'harga_doc' => $hargaDoc->harga_per_ekor,
                'biaya_pakan' => $sapronak['pakan']['total'],
                'biaya_ovk' => $sapronak['ovk']['total'],
            ],
        );

        $this->pesan = 'Input simulasi RHPP '.$periode->nama.' tersimpan.';
        unset($this->simulasi, $this->real, $this->sapronak, $this->periode);
        $this->perbaruiHasilSimulasiBagiHasil();
    }

    public function simpanReal(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode ?? abort(404);

        if ($periode->rhppReal?->terkunci()) {
            throw ValidationException::withMessages([
                'masukanReal' => 'Dokumen RHPP real sedang dikunci. Buka kuncinya dengan password admin sebelum mengubah.',
            ]);
        }

        $notaPanen = $periode->notaPanen()->orderBy('id')->get();

        if ($notaPanen->isEmpty()) {
            throw ValidationException::withMessages([
                'hargaPanenReal' => 'Catat nota panen periode ini sebelum menyimpan RHPP real.',
            ]);
        }

        $docDiklaim = (int) ($this->masukanReal['doc_diklaim_ekor'] ?? 0);
        $this->pastikanKlaimDocWajar($periode, $docDiklaim);
        $dataProduksi = LembarRhpp::dataProduksiReal($periode, $docDiklaim);
        unset($dataProduksi['peringatan']);

        foreach ($dataProduksi as $kolom => $nilai) {
            if ($nilai === null) {
                throw ValidationException::withMessages([
                    'masukanReal.'.$kolom => 'Data sumber untuk bagian ini belum lengkap pada periode terpilih.',
                ]);
            }

            $this->masukanReal[$kolom] = (string) $nilai;
        }

        $aturan = [
            'masukanReal' => ['required', 'array'],
            'masukanReal.kantor' => ['required', 'string', 'max:100'],
            'masukanReal.no_siklus' => ['required', 'string', 'max:100'],
            'masukanReal.ppl' => ['required', 'string', 'max:150'],
            'masukanReal.tanggal_proses' => ['required', 'date'],
            'masukanReal.doc_diklaim_ekor' => ['required', 'integer', 'min:0', 'max:1000000'],
            'masukanReal.doc_ekor' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'masukanReal.doc_total' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanReal.pakan_kg' => ['required', 'numeric', 'decimal:0,2', 'min:0'],
            'masukanReal.pakan_total' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanReal.ovk_jumlah' => ['required', 'numeric', 'decimal:0,2', 'min:0'],
            'masukanReal.ovk_satuan' => ['required', 'string', 'max:30'],
            'masukanReal.ovk_total' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'masukanReal.fcr_aktual' => ['required', 'numeric', 'decimal:0,3', 'min:0'],
            'masukanReal.fcr_standar' => ['required', 'numeric', 'decimal:0,3', 'min:0'],
            'masukanReal.deplesi_persen' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukanReal.deplesi_standar_persen' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:100'],
            'masukanReal.umur_rata' => ['required', 'numeric', 'decimal:0,2', 'min:0'],
            'masukanReal.ip' => ['required', 'integer', 'min:0', 'max:65535'],
            'masukanReal.tarif_efisiensi_per_kg' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'masukanReal.subsidi_harga_pasar' => ['required', 'integer', 'min:0', 'max:'.PHP_INT_MAX],
            'hargaPanenReal' => ['required', 'array', 'size:'.$notaPanen->count()],
        ];

        foreach ($notaPanen as $nota) {
            $aturan['hargaPanenReal.'.$nota->id] = ['required', 'integer', 'min:0', 'max:4294967295'];
        }

        $data = $this->validate($aturan, [
            'masukanReal.*.required' => 'Bagian ini wajib diisi.',
            'masukanReal.*.integer' => 'Masukkan angka bulat yang valid.',
            'masukanReal.*.numeric' => 'Masukkan angka desimal yang valid.',
            'hargaPanenReal.*.required' => 'Harga real tiap nota wajib diisi.',
            'hargaPanenReal.*.integer' => 'Harga real harus berupa angka bulat.',
        ]);

        DB::transaction(function () use ($periode, $notaPanen, $data, $dataProduksi): void {
            RhppReal::query()->updateOrCreate(
                ['periode_id' => $periode->id],
                [
                    'status' => 'sementara',
                    ...$data['masukanReal'],
                    ...$dataProduksi,
                ],
            );

            foreach ($notaPanen as $nota) {
                $nota->update([
                    'harga_real_per_kg' => $data['hargaPanenReal'][$nota->id],
                ]);
            }
        });

        unset($this->real);
        $this->muatFormReal();
        $this->pesan = 'Input RHPP real '.$periode->nama.' tersimpan.';
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function simulasi(): ?array
    {
        return $this->periodeTermuat() ? LembarRhpp::simulasi($this->periodeTermuat()) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function real(): ?array
    {
        return $this->periodeTermuat() ? LembarRhpp::real($this->periodeTermuat()) : null;
    }

    /**
     * Apakah dokumen RHPP real periode ini dikunci sehingga tidak dapat diubah.
     */
    #[Computed]
    public function rhppTerkunci(): bool
    {
        $dokumen = $this->periode?->rhppReal()->first();

        return $dokumen !== null && $dokumen->terkunci();
    }

    /**
     * Apakah password admin untuk RHPP sudah pernah ditetapkan.
     */
    #[Computed]
    public function sandiRhppTeratur(): bool
    {
        return Pengaturan::passwordAdminTeratur();
    }

    /**
     * Siapkan modal untuk mengunci RHPP real.
     */
    public function bukaModalKunciRhpp(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->modeKunci = 'kunci';
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        $this->sandiAdminLama = '';
    }

    /**
     * Siapkan modal untuk membuka kembali kunci RHPP real.
     */
    public function bukaModalBukaKunciRhpp(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->modeKunci = 'buka';
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        $this->sandiAdminLama = '';
    }

    /**
     * Siapkan modal untuk mengganti password admin.
     */
    public function bukaModalGantiPassword(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->modeKunci = 'ganti';
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        $this->sandiAdminLama = '';
    }

    /**
     * Kunci dokumen RHPP real. Bila password admin belum pernah ditetapkan, password itu
     * ditetapkan pada langkah yang sama.
     */
    public function kunciRhpp(): void
    {
        $periode = $this->periode ?? abort(404);
        $dokumen = $periode->rhppReal;

        if (! $dokumen) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Belum ada dokumen RHPP real pada periode ini.',
            ]);
        }

        if ($dokumen->terkunci()) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Dokumen RHPP real sudah dikunci.',
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

        DB::transaction(function () use ($dokumen, $periode, $sandiBaru): void {
            if ($sandiBaru) {
                Pengaturan::setPasswordAdmin($this->sandiAdmin);
            }

            $dokumen->update(['status' => RhppReal::DIKUNCI]);
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::Rhpp,
                'RHPP real '.$periode->nama,
                $sandiBaru ? 'Dokumen dikunci, password admin ditetapkan' : 'Dokumen dikunci',
            );
        });

        $this->pesan = 'RHPP real '.$periode->nama.' dikunci.';
        $this->dispatch('tutup-modal-kunci-rhpp');
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        unset($this->real, $this->rhppTerkunci);
    }

    /**
     * Buka kembali kunci RHPP real setelah password admin yang benar diberikan.
     */
    public function bukaKunciRhpp(): void
    {
        $periode = $this->periode ?? abort(404);
        $dokumen = $periode->rhppReal;

        if (! $dokumen || ! $dokumen->terkunci()) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Dokumen RHPP real tidak sedang dikunci.',
            ]);
        }

        $this->validate([
            'sandiAdmin' => ['required', 'string', 'max:100'],
        ], [
            'sandiAdmin.required' => 'Password admin wajib diisi.',
        ]);

        if (! Pengaturan::cocokPasswordAdmin($this->sandiAdmin)) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Password admin salah.',
            ]);
        }

        DB::transaction(function () use ($dokumen, $periode): void {
            $dokumen->update(['status' => RhppReal::SEMENTARA]);
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::Rhpp,
                'RHPP real '.$periode->nama,
                'Dokumen dibuka kembali dengan password admin',
            );
        });

        $this->pesan = 'RHPP real '.$periode->nama.' dibuka kembali.';
        $this->dispatch('tutup-modal-kunci-rhpp');
        $this->sandiAdmin = '';
        unset($this->real, $this->rhppTerkunci);
    }

    /**
     * Ganti password admin. Meminta password lama bila password sudah pernah ditetapkan.
     */
    public function ubahPasswordAdmin(): void
    {
        $sandiAda = Pengaturan::passwordAdminTeratur();

        $aturan = [
            'sandiAdmin' => ['required', 'string', 'min:4', 'max:100'],
            'sandiAdminUlang' => ['required', 'same:sandiAdmin'],
        ];

        if ($sandiAda) {
            $aturan['sandiAdminLama'] = ['required', 'string', 'max:100'];
        }

        $this->validate($aturan, [
            'sandiAdmin.required' => 'Password admin wajib diisi.',
            'sandiAdmin.min' => 'Password admin minimal 4 karakter.',
            'sandiAdminUlang.required' => 'Ulangi password admin.',
            'sandiAdminUlang.same' => 'Pengulangan password tidak sama.',
            'sandiAdminLama.required' => 'Password lama wajib diisi.',
        ]);

        if ($sandiAda && ! Pengaturan::cocokPasswordAdmin($this->sandiAdminLama)) {
            throw ValidationException::withMessages([
                'sandiAdminLama' => 'Password lama salah.',
            ]);
        }

        Pengaturan::setPasswordAdmin($this->sandiAdmin);

        $this->pesan = 'Password admin RHPP diperbarui.';
        $this->dispatch('tutup-modal-kunci-rhpp');
        $this->sandiAdmin = '';
        $this->sandiAdminUlang = '';
        $this->sandiAdminLama = '';
    }

    /**
     * @return EloquentCollection<int, NotaPanen>
     */
    #[Computed]
    public function notaReal(): EloquentCollection
    {
        $periode = $this->periode;

        return $periode
            ? $periode->notaPanen()->orderBy('tanggal_panen')->orderBy('id')->get()
            : new EloquentCollection;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function sapronak(): ?array
    {
        return $this->periodeTermuat() ? LembarRhpp::sapronakSimulasi($this->periodeTermuat()) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function proyeksiBagiHasilSimulasi(): ?array
    {
        $periodeKandang = $this->periodeKandangKedua;
        if (! $periodeKandang) {
            return null;
        }

        return collect($this->simulasi['kandang']['baris'] ?? [])
            ->firstWhere('id', $periodeKandang->id);
    }

    #[Computed]
    public function periodeKandangKedua(): ?PeriodeKandang
    {
        return $this->periode?->kandangPeriode()
            ->whereHas('kandang', fn ($query) => $query->where('nama', 'Kandang 2'))
            ->with(['kandang', 'bagiHasil.penerima', 'transaksiKas'])
            ->first();
    }

    public function render(): View
    {
        return view('livewire.rhpp');
    }

    private function periodeTermuat(): ?Periode
    {
        return $this->periode?->loadMissing(LembarRhpp::RELASI);
    }

    private function muatFormSimulasi(): void
    {
        $masukan = $this->periode?->rhppSimulasi;

        $this->tarifEfisiensiPerKg = (string) ($masukan?->tarif_efisiensi_per_kg ?? 260);
        $this->pesan = null;
        $this->resetValidation();
    }

    private function muatFormReal(): void
    {
        $periode = $this->periode;
        // Dokumen dibaca langsung dari basis data supaya nilai klaim dan status kunci yang
        // baru saja disimpan langsung terbaca.
        $masukan = $periode ? $periode->rhppReal()->first() : null;
        $docDiklaim = (int) ($masukan?->doc_diklaim_ekor ?? 0);
        $dataProduksi = $periode ? LembarRhpp::dataProduksiReal($periode, $docDiklaim) : [];
        $nilaiProduksi = fn (string $kolom, mixed $cadangan): mixed => array_key_exists($kolom, $dataProduksi)
            ? $dataProduksi[$kolom]
            : $cadangan;

        $this->masukanReal = [
            'kantor' => (string) ($masukan?->kantor ?? ''),
            'no_siklus' => (string) ($masukan?->no_siklus ?? ''),
            'ppl' => (string) ($masukan?->ppl ?? ''),
            'tanggal_proses' => (string) ($masukan?->tanggal_proses?->format('Y-m-d') ?? ''),
            'doc_diklaim_ekor' => (string) $docDiklaim,
            'doc_ekor' => (string) ($nilaiProduksi('doc_ekor', $masukan?->doc_ekor) ?? ''),
            'doc_total' => (string) ($nilaiProduksi('doc_total', $masukan?->doc_total) ?? ''),
            'pakan_kg' => (string) ($nilaiProduksi('pakan_kg', $masukan?->pakan_kg) ?? ''),
            'pakan_total' => (string) ($nilaiProduksi('pakan_total', $masukan?->pakan_total) ?? ''),
            'ovk_jumlah' => (string) ($masukan?->ovk_jumlah ?? ''),
            'ovk_satuan' => (string) ($masukan?->ovk_satuan ?? ''),
            'ovk_total' => (string) ($nilaiProduksi('ovk_total', $masukan?->ovk_total) ?? ''),
            'fcr_aktual' => (string) ($nilaiProduksi('fcr_aktual', $masukan?->fcr_aktual) ?? ''),
            'fcr_standar' => (string) ($nilaiProduksi('fcr_standar', $masukan?->fcr_standar) ?? ''),
            'deplesi_persen' => (string) ($nilaiProduksi('deplesi_persen', $masukan?->deplesi_persen) ?? ''),
            'deplesi_standar_persen' => (string) ($nilaiProduksi('deplesi_standar_persen', $masukan?->deplesi_standar_persen) ?? ''),
            'umur_rata' => (string) ($nilaiProduksi('umur_rata', $masukan?->umur_rata) ?? ''),
            'ip' => (string) ($nilaiProduksi('ip', $masukan?->ip) ?? ''),
            'tarif_efisiensi_per_kg' => (string) ($masukan?->tarif_efisiensi_per_kg ?? '260'),
            'subsidi_harga_pasar' => (string) ($masukan?->subsidi_harga_pasar ?? ''),
        ];

        $this->hargaPanenReal = $periode
            ? $periode->notaPanen()
                ->orderBy('id')
                ->pluck('harga_real_per_kg', 'id')
                ->map(fn ($harga): string => (string) ($harga ?? ''))
                ->all()
            : [];
    }

    /**
     * DOC yang diklaim kembali ke inti tidak boleh membuat DOC yang dibesarkan lebih kecil dari
     * kematian yang sudah tercatat, dan tidak boleh melebihi DOC periode.
     */
    private function pastikanKlaimDocWajar(Periode $periode, int $docDiklaim): void
    {
        if ($docDiklaim <= 0) {
            return;
        }

        $periode->loadMissing('kandangPeriode.recordings');
        $docAwal = (int) $periode->kandangPeriode->sum(fn (PeriodeKandang $satu): int => $satu->populasiAktual());

        if ($docDiklaim >= $docAwal) {
            throw ValidationException::withMessages([
                'masukanReal.doc_diklaim_ekor' => 'DOC diklaim tidak boleh melebihi DOC periode ('.Format::angka($docAwal).' ekor).',
            ]);
        }

        $mati = (int) $periode->kandangPeriode->sum(fn (PeriodeKandang $satu): int => $satu->kematianTercatat());

        if ($docAwal - $docDiklaim < $mati) {
            throw ValidationException::withMessages([
                'masukanReal.doc_diklaim_ekor' => 'DOC diklaim membuat DOC yang dibesarkan ('
                    .Format::angka($docAwal - $docDiklaim).' ekor) lebih kecil dari kematian tercatat '
                    .Format::angka($mati).' ekor.',
            ]);
        }
    }

    /**
     * Perubahan jumlah DOC diklaim langsung mengubah DOC, biaya DOC, deplesi, dan IP pada form.
     */
    public function updatedMasukanReal(mixed $value, ?string $key = null): void
    {
        if ($key !== 'doc_diklaim_ekor' || ! is_numeric($value)) {
            return;
        }

        $periode = $this->periode;
        if (! $periode) {
            return;
        }

        $dataProduksi = LembarRhpp::dataProduksiReal($periode, (int) $value);

        foreach (['doc_ekor', 'doc_total', 'deplesi_persen', 'ip'] as $kolom) {
            if (array_key_exists($kolom, $dataProduksi) && $dataProduksi[$kolom] !== null) {
                $this->masukanReal[$kolom] = (string) $dataProduksi[$kolom];
            }
        }
    }

    private function muatFormBagiHasil(): void
    {
        $this->hasilSimulasiBagiHasil = null;
        $this->resetValidation();

        $periodeKandang = $this->periodeKandangKedua;
        if (! $periodeKandang) {
            $this->masukanBagiHasil = [];
            $this->abkSimulasi = [];
            $this->entertainSimulasi = [];
            $this->pemodalSimulasi = [];
            $this->sumberAsumsiBagiHasil = null;

            return;
        }

        $masukan = $periodeKandang->bagiHasil;
        $this->sumberAsumsiBagiHasil = null;
        if (! $masukan) {
            $masukan = BagiHasil::query()
                ->whereHas('periodeKandang', fn ($query) => $query->where('kandang_id', $periodeKandang->kandang_id))
                ->with(['penerima', 'periodeKandang.periode'])
                ->latest('id')
                ->first();
            $this->sumberAsumsiBagiHasil = $masukan?->periodeKandang?->periode?->nama;
        }

        $this->masukanBagiHasil = [
            'controller' => (string) ($masukan?->controller ?? ''),
            'operasional' => (string) (BukuKas::buat($periodeKandang)['ringkasan']['biaya'] ?? 0),
            'tarif_gaji_abk_per_kg' => (string) ($masukan?->tarif_gaji_abk_per_kg ?? 500),
            'premi_pemeliharaan_abk' => (string) ($masukan?->premi_pemeliharaan_abk ?? 0),
            'premi_controller' => (string) ($masukan?->premi_controller ?? 0),
            'persen_upah_controller' => (string) ($masukan?->persen_upah_controller ?? 3),
            'persen_bonus_pasar_abk' => (string) ($masukan?->persen_bonus_pasar_abk ?? 30),
            'persen_bonus_pasar_controller' => (string) ($masukan?->persen_bonus_pasar_controller ?? 10),
            'persen_zakat' => (string) ($masukan?->persen_zakat ?? 2.5),
        ];
        $this->abkSimulasi = $masukan
            ? $masukan->penerimaBerperan(PeranBagiHasil::Abk)
                ->map(fn ($satu): array => [
                    'nama' => $satu->nama,
                    'keterangan' => (string) ($satu->keterangan ?? ''),
                    'jumlah' => (string) ($satu->jumlah ?? ''),
                ])->all()
            : [];
        $this->entertainSimulasi = $masukan
            ? $masukan->penerimaBerperan(PeranBagiHasil::Entertain)
                ->map(fn ($satu): array => ['nama' => $satu->nama, 'jumlah' => (string) ($satu->jumlah ?? 0)])->all()
            : [];
        $this->pemodalSimulasi = $masukan
            ? $masukan->penerimaBerperan(PeranBagiHasil::Pemodal)
                ->map(fn ($satu): array => ['nama' => $satu->nama, 'persen' => (string) ($satu->persen ?? '')])->all()
            : [];

        if ($this->pemodalSimulasi === []) {
            $this->pemodalSimulasi = $periodeKandang->kandang->pemodal
                ->map(fn ($satu): array => ['nama' => $satu->nama, 'persen' => (string) $satu->pivot->persen])
                ->all();
        }

        $this->perbaruiHasilSimulasiBagiHasil();
    }

    private function rapikanMasukanBagiHasil(): void
    {
        $this->masukanBagiHasil['controller'] = trim($this->masukanBagiHasil['controller'] ?? '');

        foreach ($this->abkSimulasi as $indeks => $satu) {
            $this->abkSimulasi[$indeks]['nama'] = trim($satu['nama'] ?? '');
            $this->abkSimulasi[$indeks]['keterangan'] = trim($satu['keterangan'] ?? '');
        }

        foreach (['entertainSimulasi', 'pemodalSimulasi'] as $daftar) {
            foreach ($this->{$daftar} as $indeks => $satu) {
                $this->{$daftar}[$indeks]['nama'] = trim($satu['nama'] ?? '');
            }
        }
    }
}
