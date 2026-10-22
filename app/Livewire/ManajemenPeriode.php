<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Models\Aktivitas;
use App\Models\BagiHasil;
use App\Models\Farm;
use App\Models\HargaDoc;
use App\Models\JenisPakan;
use App\Models\Kandang;
use App\Models\Karyawan;
use App\Models\Pemodal;
use App\Models\Pengaturan;
use App\Models\Periode as ModelPeriode;
use App\Models\PeriodeKandang;
use App\Support\BagiDocChickIn;
use App\Support\Format;
use App\Support\LembarRhpp;
use App\Support\LogPakan;
use App\Support\RekapPanen;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

#[Title('Periode dan kandang')]
class ManajemenPeriode extends Component
{
    #[Url(as: 'farm')]
    public ?int $farmId = null;

    #[Url(as: 'periode')]
    public ?int $periodeId = null;

    public string $namaFarm = '';

    public string $kodeFarm = '';

    #[Locked]
    public ?int $periodeFormId = null;

    public string $nama = '';

    public string $nomorSiklus = '';

    public string $inti = '';

    public string $ppl = '';

    public string $strain = '';

    public string $tanggalChickIn = '';

    public string $beratDocGram = '';

    public ?string $jumlahDocChickIn = null;

    public string $status = 'persiapan';

    #[Locked]
    public ?int $periodeHapusId = null;

    public string $namaPeriodeHapus = '';

    #[Locked]
    public ?int $periodeKandangFormId = null;

    public string $kandangId = '';

    public string $populasiAwal = '';

    public string $tanggalChickInKandang = '';

    public string $beratDocGramKandang = '';

    public string $hargaDocPerEkor = '';

    public string $bonusDocEkor = '0';

    #[Locked]
    public ?int $periodeKandangHapusId = null;

    public string $namaKandangHapus = '';

    #[Locked]
    public ?int $kandangMasterFormId = null;

    public string $kandangMasterNama = '';

    public string $kandangMasterKapasitas = '';

    #[Locked]
    public ?int $kandangMasterHapusId = null;

    public string $kandangMasterHapusNama = '';

    /**
     * Password admin yang diminta saat membuka kunci lembar bagi hasil.
     */
    public string $sandiAdmin = '';

    /**
     * Kandang periode yang lembar bagi hasilnya sedang dibuka kuncinya.
     */
    #[Locked]
    public ?int $periodeKandangKunciId = null;

    public ?string $pesan = null;

    /**
     * @return Collection<int, Farm>
     */
    #[Computed]
    public function daftarFarm(): Collection
    {
        return Farm::query()->orderBy('nama')->get();
    }

    #[Computed]
    public function farmTerpilih(): ?Farm
    {
        $farm = $this->daftarFarm->firstWhere('id', $this->farmId);
        if ($farm) {
            return $farm;
        }

        $periode = $this->periodeId ? ModelPeriode::query()->find($this->periodeId) : null;

        return $this->daftarFarm->firstWhere('id', $periode?->farm_id) ?? $this->daftarFarm->first();
    }

    /**
     * @return Collection<int, ModelPeriode>
     */
    #[Computed]
    public function daftarPeriode(): Collection
    {
        return $this->farmTerpilih
            ? $this->farmTerpilih->periodes()
                ->withCount('kandangPeriode')
                ->withSum('kandangPeriode', 'populasi_awal')
                ->withSum('kandangPeriode', 'bonus_doc_ekor')
                ->prioritaskanAktif()
                ->get()
            : new Collection;
    }

    #[Computed]
    public function periodeTerpilih(): ?ModelPeriode
    {
        $periode = $this->periodeId
            ? $this->daftarPeriode->firstWhere('id', $this->periodeId)
            : $this->daftarPeriode->first();

        return $periode?->loadMissing([
            'kandangPeriode.kandang.karyawan',
            'kandangPeriode.recordings',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'kandangPeriode.sesiSampling',
            'kandangPeriode.transaksiKas',
            'kandangPeriode.slipGaji',
            'kandangPeriode.bagiHasil',
            'penerimaanPakan.jenisPakan',
            'notaPanen',
            'hargaKontrak',
            'rhppSimulasi',
            'rhppReal',
        ]);
    }

    /**
     * Ringkasan level farm untuk periode terpilih.
     *
     * @return array{panen: ?array, pakan: array<string, float|null>, rhpp: ?array}
     */
    #[Computed]
    public function ringkasanGabungan(): array
    {
        $periode = $this->periodeTerpilih;
        if (! $periode) {
            return ['panen' => null, 'pakan' => [], 'rhpp' => null];
        }

        return [
            'panen' => RekapPanen::buat($periode),
            'pakan' => LogPakan::buat($periode)['total_stok'],
            'rhpp' => LembarRhpp::real($periode),
        ];
    }

    /**
     * @return Collection<int, Kandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        return $this->farmTerpilih
            ? $this->farmTerpilih->kandangs()->with('karyawan')->withCount('periodeKandang')->orderBy('nama')->get()
            : new Collection;
    }

    /**
     * Jadikan periode terpilih sebagai periode aktif yang dikerjakan di halaman ini.
     */
    public function pilihPeriode(int $id): void
    {
        $periode = $this->periodeDiFarm($id);
        $this->resetValidation();
        $this->pesan = null;
        $this->periodeId = $periode->id;
        $this->batalPeriode();
        $this->batalKandang();
        unset(
            $this->farmTerpilih,
            $this->daftarPeriode,
            $this->periodeTerpilih,
            $this->daftarKandang,
            $this->masterData,
            $this->ringkasanGabungan,
        );
    }

    /**
     * Siapkan modal untuk membuka kembali kunci lembar bagi hasil seekandang.
     */
    public function bukaModalBukaKunciBagiHasil(int $idPeriodeKandang): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->periodeKandangKunciId = $idPeriodeKandang;
        $this->sandiAdmin = '';
    }

    /**
     * Buka kembali kunci lembar bagi hasil setelah password admin yang benar diberikan.
     */
    public function bukaKunciBagiHasil(): void
    {
        $periodeKandang = $this->periodeKandangTerpilih($this->periodeKandangKunciId ?? abort(404));
        $bagiHasil = $periodeKandang->bagiHasil ?? abort(404);

        if (! $bagiHasil->terkunci()) {
            throw ValidationException::withMessages([
                'sandiAdmin' => 'Lembar bagi hasil ini tidak sedang dikunci.',
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

        DB::transaction(function () use ($bagiHasil, $periodeKandang): void {
            $bagiHasil->update(['status' => BagiHasil::SEMENTARA]);
            Aktivitas::catat(
                JenisAktivitas::Ubah,
                ModulAktivitas::BagiHasil,
                'Bagi hasil '.$periodeKandang->kandang->nama.' pada '.$periodeKandang->periode->nama,
                'Lembar dibuka kembali dengan password admin',
            );
        });

        $this->pesan = 'Lembar bagi hasil '.$periodeKandang->kandang->nama.' dibuka kembali.';
        $this->dispatch('tutup-modal-buka-kunci-bagi-hasil');
        $this->sandiAdmin = '';
        $this->periodeKandangKunciId = null;
        unset($this->periodeTerpilih, $this->masterData);
    }

    public function tambahFarm(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->namaFarm = '';
        $this->kodeFarm = '';
    }

    public function simpanFarm(): void
    {
        $this->namaFarm = trim($this->namaFarm);
        $this->kodeFarm = trim($this->kodeFarm);
        $data = $this->validate([
            'namaFarm' => ['required', 'string', 'max:150', Rule::unique('farms', 'nama')],
            'kodeFarm' => ['nullable', 'string', 'max:40', Rule::unique('farms', 'kode')],
        ], [
            'namaFarm.required' => 'Nama farm wajib diisi.',
            'namaFarm.unique' => 'Nama farm sudah digunakan.',
            'kodeFarm.unique' => 'Kode farm sudah digunakan.',
        ]);

        $farm = DB::transaction(function () use ($data): Farm {
            $farm = Farm::query()->create([
                'nama' => $data['namaFarm'],
                'kode' => filled($data['kodeFarm']) ? $data['kodeFarm'] : null,
            ]);

            Aktivitas::catat(JenisAktivitas::Tambah, ModulAktivitas::Farm, 'Farm '.$farm->nama);

            return $farm;
        });

        $this->farmId = $farm->id;
        $this->periodeId = null;
        $this->pesan = 'Farm '.$farm->nama.' ditambahkan.';
        $this->namaFarm = '';
        $this->kodeFarm = '';
        $this->dispatch('tutup-modal-farm');
        unset($this->daftarFarm, $this->farmTerpilih, $this->daftarPeriode, $this->periodeTerpilih, $this->daftarKandang, $this->masterData, $this->ringkasanGabungan);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    #[Computed]
    public function masterData(): array
    {
        return [
            'standar' => array_keys(config('standar.strain', [])),
            'pakan' => JenisPakan::query()->orderBy('kode')->get(['id', 'kode']),
            'harga' => $this->periodeTerpilih?->hargaKontrak ?? new Collection,
            'karyawan' => Karyawan::query()
                ->whereHas('kandang', fn ($query) => $query->where('farm_id', $this->farmTerpilih?->id))
                ->with('kandang')
                ->orderBy('nama')
                ->get(),
            'pemodal' => Pemodal::query()
                ->whereHas('kandangs', fn ($query) => $query->where('farm_id', $this->farmTerpilih?->id))
                ->orderBy('nama')
                ->get(),
        ];
    }

    public function tambahPeriode(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->periodeFormId = null;
        $this->nama = '';
        $this->nomorSiklus = '';
        $this->inti = '';
        $this->ppl = '';
        $this->strain = (string) array_key_first(config('standar.strain', []));
        $this->tanggalChickIn = today()->toDateString();
        $this->beratDocGram = '37';
        $this->jumlahDocChickIn = null;
        $this->status = 'persiapan';
    }

    public function ubahPeriode(int $id): void
    {
        $periode = $this->periodeDiFarm($id);
        $periode->loadMissing('kandangPeriode');

        $this->resetValidation();
        $this->pesan = null;
        $this->periodeFormId = $periode->id;
        $this->nama = $periode->nama;
        $this->nomorSiklus = (string) ($periode->nomor_siklus ?? '');
        $this->inti = (string) ($periode->inti ?? '');
        $this->ppl = (string) ($periode->ppl ?? '');
        $this->strain = $periode->strain;
        $this->tanggalChickIn = $periode->tanggal_chick_in->toDateString();
        $this->beratDocGram = (string) $periode->berat_doc_gram;
        $this->jumlahDocChickIn = $periode->kandangPeriode->isEmpty()
            ? null
            : (string) $periode->totalDocChickIn();
        $this->status = $periode->status;
    }

    public function simpanPeriode(): void
    {
        $this->nama = trim($this->nama);
        $this->jumlahDocChickIn = $this->jumlahDocChickIn === null ? null : trim($this->jumlahDocChickIn);
        if ($this->jumlahDocChickIn === '') {
            $this->jumlahDocChickIn = null;
        }
        $farm = $this->farmTerpilih ?? abort(404);
        $data = $this->validate([
            'nama' => [
                'required',
                'string',
                'max:150',
                Rule::unique('periodes', 'nama')->where('farm_id', $farm->id)->ignore($this->periodeFormId),
            ],
            'nomorSiklus' => [
                'required',
                'integer',
                'min:1',
                'max:65535',
                Rule::unique('periodes', 'nomor_siklus')->where('farm_id', $farm->id)->ignore($this->periodeFormId),
            ],
            'inti' => ['required', 'string', 'max:150'],
            'ppl' => ['required', 'string', 'max:150'],
            'strain' => ['required', 'string', Rule::in(array_keys(config('standar.strain', [])))],
            'tanggalChickIn' => ['required', 'date_format:Y-m-d'],
            'beratDocGram' => ['required', 'integer', 'min:1', 'max:1000'],
            'jumlahDocChickIn' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'status' => ['required', Rule::in(['persiapan', 'berjalan', 'panen', 'tutup_rhpp'])],
        ], [
            'nama.required' => 'Nama periode wajib diisi.',
            'nama.unique' => 'Nama periode sudah digunakan.',
            'nomorSiklus.required' => 'Nomor siklus wajib diisi.',
            'nomorSiklus.integer' => 'Nomor siklus harus berupa angka bulat.',
            'nomorSiklus.min' => 'Nomor siklus minimal 1.',
            'nomorSiklus.unique' => 'Nomor siklus sudah digunakan di farm ini.',
            'inti.required' => 'Nama inti wajib diisi.',
            'inti.max' => 'Nama inti maksimal 150 karakter.',
            'ppl.required' => 'Nama PPL wajib diisi.',
            'ppl.max' => 'Nama PPL maksimal 150 karakter.',
            'strain.required' => 'Standar strain wajib dipilih.',
            'strain.in' => 'Standar strain tidak tersedia.',
            'tanggalChickIn.required' => 'Tanggal chick-in wajib diisi.',
            'tanggalChickIn.date_format' => 'Tanggal chick-in tidak valid.',
            'beratDocGram.required' => 'Berat DOC wajib diisi.',
            'beratDocGram.integer' => 'Berat DOC harus berupa bilangan bulat.',
            'beratDocGram.min' => 'Berat DOC minimal 1 gram.',
            'beratDocGram.max' => 'Berat DOC maksimal 1.000 gram.',
            'jumlahDocChickIn.integer' => 'Jumlah DOC chick-in harus berupa bilangan bulat.',
            'jumlahDocChickIn.min' => 'Jumlah DOC chick-in minimal 1 ekor.',
            'jumlahDocChickIn.max' => 'Jumlah DOC chick-in maksimal 1.000.000 ekor.',
            'status.in' => 'Status periode tidak valid.',
        ]);

        $mengubah = $this->periodeFormId !== null;
        $periode = $mengubah ? $this->periodeDiFarm($this->periodeFormId) : new ModelPeriode;
        if ($mengubah && $periode->tertutup()) {
            $this->addError('periodeForm', 'Periode yang sudah tutup RHPP hanya dapat dibuka dalam mode baca-saja.');

            return;
        }
        if ($data['status'] === 'tutup_rhpp' && (! $mengubah || ! $periode->rhppReal()->exists())) {
            $this->addError('periodeForm', 'RHPP real harus tersedia sebelum periode dapat ditutup.');

            return;
        }

        if ($mengubah && $this->periodePunyaCatatan($periode) && $this->baselineBerubah($periode, $data)) {
            $this->addError('periodeForm', 'Nomor siklus, inti, PPL, strain, dan parameter DOC yang sudah tercatat tidak dapat diubah setelah transaksi periode dicatat. Parameter yang belum diisi masih dapat dilengkapi.');

            return;
        }

        $periode->loadMissing(['kandangPeriode.kandang', 'kandangPeriode.recordings']);
        $totalDocLama = $periode->totalDocChickIn();
        $alokasi = null;
        $rincian = null;

        if ($this->jumlahDocChickIn !== null) {
            $totalDocBaru = (int) $this->jumlahDocChickIn;

            if ($totalDocBaru !== $totalDocLama) {
                $hasil = BagiDocChickIn::alokasi($totalDocBaru, $periode->kandangPeriode);

                if ($hasil['galat'] !== null) {
                    $this->addError('jumlahDocChickIn', $hasil['galat']);

                    return;
                }

                $alokasi = $hasil['populasi_awal'];
                $rincian = 'Jumlah DOC chick-in '.Format::angka($totalDocLama).' menjadi '.Format::angka($totalDocBaru).' ekor';
            }
        }

        $periode->fill([
            'farm_id' => $farm->id,
            'nama' => $data['nama'],
            'nomor_siklus' => $data['nomorSiklus'],
            'inti' => $data['inti'],
            'ppl' => $data['ppl'],
            'strain' => $data['strain'],
            'tanggal_chick_in' => $data['tanggalChickIn'],
            'berat_doc_gram' => $data['beratDocGram'],
            'status' => $data['status'],
        ]);

        DB::transaction(function () use ($periode, $mengubah, $alokasi, $rincian): void {
            $periode->save();

            foreach ($alokasi ?? [] as $idKandang => $populasiBaru) {
                $satu = $periode->kandangPeriode->firstWhere('id', $idKandang);

                if ($satu) {
                    $satu->populasi_awal = $populasiBaru;
                    $satu->save();
                }
            }

            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::Periode,
                'Periode '.$periode->nama,
                $rincian,
            );
        });

        $this->periodeId = $periode->id;
        $this->pesan = 'Periode '.$periode->nama.($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-periode');
        $this->bersihkanFormPeriode();
        unset($this->daftarPeriode, $this->periodeTerpilih, $this->masterData, $this->ringkasanGabungan);
    }

    public function mintaHapusPeriode(int $id): void
    {
        $periode = $this->periodeDiFarm($id);
        abort_if($periode->tertutup(), 403);
        $this->resetErrorBag('hapusPeriode');
        $this->pesan = null;
        $this->periodeHapusId = $periode->id;
        $this->namaPeriodeHapus = $periode->nama;
    }

    public function hapusPeriode(): void
    {
        $periode = $this->periodeDiFarm($this->periodeHapusId ?? abort(404));
        abort_if($periode->tertutup(), 403);

        if ($this->periodePunyaCatatan($periode)) {
            $this->addError('hapusPeriode', 'Periode tidak dapat dihapus karena sudah memiliki transaksi. Tutup RHPP setelah hasil final disetujui.');

            return;
        }

        $nama = $periode->nama;
        DB::transaction(function () use ($periode, $nama): void {
            $periode->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Periode, 'Periode '.$nama);
        });

        $this->periodeHapusId = null;
        $this->namaPeriodeHapus = '';
        if ($this->periodeId === $periode->id) {
            $this->periodeId = null;
        }
        $this->pesan = 'Periode '.$nama.' dihapus.';
        $this->resetErrorBag('hapusPeriode');
        unset($this->daftarPeriode, $this->periodeTerpilih, $this->masterData, $this->ringkasanGabungan);
    }

    public function tambahKandang(): void
    {
        $periode = $this->periodeTerpilih ?? abort(404);
        abort_if($periode->tertutup(), 403);
        $this->resetValidation();
        $this->pesan = null;
        $this->periodeKandangFormId = null;
        $this->kandangId = '';
        $this->populasiAwal = '';
        $this->tanggalChickInKandang = $periode->tanggal_chick_in->toDateString();
        $this->beratDocGramKandang = (string) $periode->berat_doc_gram;
        $this->hargaDocPerEkor = (string) (HargaDoc::query()->orderBy('id')->value('harga_per_ekor') ?? '');
        $this->bonusDocEkor = '0';
    }

    public function ubahKandang(int $id): void
    {
        $periodeKandang = $this->periodeKandangUntukPeriode($id);
        abort_if($periodeKandang->periode->tertutup(), 403);
        $this->resetValidation();
        $this->pesan = null;
        $this->periodeKandangFormId = $periodeKandang->id;
        $this->kandangId = (string) $periodeKandang->kandang_id;
        $this->populasiAwal = (string) $periodeKandang->populasi_awal;
        $this->tanggalChickInKandang = $periodeKandang->tanggalChickInEfektif()->toDateString();
        $this->beratDocGramKandang = (string) $periodeKandang->beratDocGramEfektif();
        $this->hargaDocPerEkor = (string) ($periodeKandang->harga_doc_per_ekor ?? '');
        $this->bonusDocEkor = (string) ($periodeKandang->bonus_doc_ekor ?? 0);
    }

    public function simpanKandang(): void
    {
        $periode = $this->periodeTerpilih ?? abort(404);
        abort_if($periode->tertutup(), 403);
        $farm = $this->farmTerpilih ?? abort(404);
        $data = $this->validate([
            'kandangId' => [
                'required',
                'integer',
                Rule::exists('kandangs', 'id')->where('farm_id', $farm->id),
                Rule::unique('periode_kandangs', 'kandang_id')
                    ->where('periode_id', $periode->id)
                    ->ignore($this->periodeKandangFormId),
            ],
            'populasiAwal' => ['required', 'integer', 'min:1', 'max:1000000'],
            'tanggalChickInKandang' => ['required', 'date_format:Y-m-d'],
            'beratDocGramKandang' => ['required', 'integer', 'min:1', 'max:1000'],
            'hargaDocPerEkor' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'bonusDocEkor' => ['required', 'integer', 'min:0', 'max:1000000'],
        ], [
            'kandangId.required' => 'Kandang wajib dipilih.',
            'kandangId.exists' => 'Kandang tidak ditemukan.',
            'kandangId.unique' => 'Kandang ini sudah terdaftar pada periode.',
            'populasiAwal.required' => 'Populasi awal wajib diisi.',
            'populasiAwal.integer' => 'Populasi awal harus berupa bilangan bulat.',
            'populasiAwal.min' => 'Populasi awal minimal 1 ekor.',
            'populasiAwal.max' => 'Populasi awal terlalu besar.',
        ]);

        $kandang = $farm->kandangs()->findOrFail($data['kandangId']);
        if ((int) $data['populasiAwal'] > $kandang->kapasitas) {
            $this->addError('populasiAwal', 'Populasi awal melebihi kapasitas kandang ('.number_format($kandang->kapasitas, 0, ',', '.').' ekor).');

            return;
        }
        if ((int) $data['populasiAwal'] + (int) $data['bonusDocEkor'] > $kandang->kapasitas) {
            $this->addError('bonusDocEkor', 'Populasi aktual termasuk bonus DOC melebihi kapasitas kandang.');

            return;
        }

        $mengubah = $this->periodeKandangFormId !== null;
        $periodeKandang = $mengubah
            ? $this->periodeKandangUntukPeriode($this->periodeKandangFormId)
            : new PeriodeKandang;

        if ($mengubah && $periodeKandang->punyaCatatan()) {
            $terkunci = [];

            if ($periodeKandang->kandang_id !== (int) $data['kandangId']) {
                $terkunci[] = 'kandang yang dipakai';
            }

            if ($periodeKandang->tanggalChickInEfektif()->toDateString() !== $data['tanggalChickInKandang']) {
                $terkunci[] = 'tanggal chick-in';
            }

            if ($periodeKandang->beratDocGramEfektif() !== (int) $data['beratDocGramKandang']) {
                $terkunci[] = 'berat DOC';
            }

            if ($terkunci !== []) {
                $this->addError('kandangForm', 'Tidak dapat mengubah '.implode(', ', $terkunci).' setelah data produksi atau keuangan dicatat.');

                return;
            }
        }

        $populasiBaru = (int) $data['populasiAwal'] + (int) $data['bonusDocEkor'];
        $matiTercatat = $periodeKandang->kematianTercatat();
        if ($populasiBaru < $matiTercatat) {
            $this->addError('populasiAwal', 'Populasi '.Format::angka($populasiBaru).' ekor lebih kecil dari kematian tercatat '.Format::angka($matiTercatat).' ekor.');

            return;
        }

        $rincian = $mengubah ? $this->rincianPerubahanKandang($periodeKandang, $data) : null;

        $periodeKandang->fill([
            'periode_id' => $periode->id,
            'kandang_id' => $kandang->id,
            'populasi_awal' => $data['populasiAwal'],
            'tanggal_chick_in' => $data['tanggalChickInKandang'],
            'berat_doc_gram' => $data['beratDocGramKandang'],
            'harga_doc_per_ekor' => $data['hargaDocPerEkor'] === '' ? null : $data['hargaDocPerEkor'],
            'bonus_doc_ekor' => $data['bonusDocEkor'],
        ]);

        DB::transaction(function () use ($periodeKandang, $mengubah, $kandang, $periode, $rincian): void {
            $periodeKandang->save();
            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::Periode,
                'Kandang '.$kandang->nama.' pada '.$periode->nama,
                $rincian,
            );
        });

        $this->pesan = 'Kandang '.$kandang->nama.($mengubah ? ' diperbarui.' : ' ditambahkan pada periode.');
        $this->dispatch('tutup-modal-kandang-periode');
        $this->bersihkanFormKandang();
        unset($this->daftarPeriode, $this->periodeTerpilih, $this->masterData, $this->ringkasanGabungan);
    }

    public function mintaHapusKandang(int $id): void
    {
        $periodeKandang = $this->periodeKandangUntukPeriode($id);
        abort_if($periodeKandang->periode->tertutup(), 403);
        $this->resetErrorBag('hapusKandang');
        $this->pesan = null;
        $this->periodeKandangHapusId = $periodeKandang->id;
        $this->namaKandangHapus = $periodeKandang->kandang->nama;
    }

    public function hapusKandang(): void
    {
        $periodeKandang = $this->periodeKandangUntukPeriode($this->periodeKandangHapusId ?? abort(404));
        abort_if($periodeKandang->periode->tertutup(), 403);

        if ($this->kandangPunyaCatatan($periodeKandang)) {
            $this->addError('hapusKandang', 'Kandang ini tidak dapat dilepas karena sudah memiliki data terkait.');

            return;
        }

        $namaKandang = $periodeKandang->kandang->nama;
        $namaPeriode = $periodeKandang->periode->nama;
        DB::transaction(function () use ($periodeKandang, $namaKandang, $namaPeriode): void {
            $periodeKandang->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Periode, 'Kandang '.$namaKandang.' dari '.$namaPeriode);
        });

        $this->periodeKandangHapusId = null;
        $this->namaKandangHapus = '';
        $this->pesan = 'Kandang '.$namaKandang.' dilepas dari periode.';
        $this->resetErrorBag('hapusKandang');
        unset($this->daftarPeriode, $this->periodeTerpilih, $this->masterData, $this->ringkasanGabungan);
    }

    public function batalPeriode(): void
    {
        $this->bersihkanFormPeriode();
    }

    public function tambahKandangMaster(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->kandangMasterFormId = null;
        $this->kandangMasterNama = '';
        $this->kandangMasterKapasitas = '';
    }

    public function ubahKandangMaster(int $id): void
    {
        $kandang = $this->kandangDiFarm($id);
        $this->resetValidation();
        $this->pesan = null;
        $this->kandangMasterFormId = $kandang->id;
        $this->kandangMasterNama = $kandang->nama;
        $this->kandangMasterKapasitas = (string) $kandang->kapasitas;
    }

    public function simpanKandangMaster(): void
    {
        $farm = $this->farmTerpilih ?? abort(404);
        $this->kandangMasterNama = trim($this->kandangMasterNama);
        $data = $this->validate([
            'kandangMasterNama' => [
                'required',
                'string',
                'max:150',
                Rule::unique('kandangs', 'nama')->where('farm_id', $farm->id)->ignore($this->kandangMasterFormId),
            ],
            'kandangMasterKapasitas' => ['required', 'integer', 'min:1', 'max:1000000'],
        ], [
            'kandangMasterNama.required' => 'Nama kandang wajib diisi.',
            'kandangMasterNama.unique' => 'Nama kandang sudah digunakan di farm ini.',
            'kandangMasterKapasitas.required' => 'Kapasitas kandang wajib diisi.',
            'kandangMasterKapasitas.integer' => 'Kapasitas harus berupa bilangan bulat.',
            'kandangMasterKapasitas.min' => 'Kapasitas minimal 1 ekor.',
            'kandangMasterKapasitas.max' => 'Kapasitas maksimal 1.000.000 ekor.',
        ]);

        $mengubah = $this->kandangMasterFormId !== null;
        $kandang = $mengubah ? $this->kandangDiFarm($this->kandangMasterFormId) : new Kandang;
        $kapasitas = (int) $data['kandangMasterKapasitas'];

        if ($mengubah) {
            $terpakai = (int) $kandang->periodeKandang()->max('populasi_awal');
            if ($kapasitas < $terpakai) {
                $this->addError('kandangMasterKapasitas', 'Kapasitas tidak boleh lebih kecil dari populasi tercatat ('.Format::angka($terpakai).' ekor).');

                return;
            }
        }

        $kandang->fill([
            'farm_id' => $farm->id,
            'nama' => $data['kandangMasterNama'],
            'kapasitas' => $kapasitas,
        ]);

        DB::transaction(function () use ($kandang, $mengubah): void {
            $kandang->save();
            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::Periode,
                'Kandang '.$kandang->nama,
                'Kapasitas '.Format::angka($kandang->kapasitas).' ekor',
            );
        });

        $this->pesan = $kandang->nama.($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-kandang-master');
        $this->kandangMasterFormId = null;
        $this->kandangMasterNama = '';
        $this->kandangMasterKapasitas = '';
        unset($this->daftarKandang, $this->periodeTerpilih, $this->masterData);
    }

    public function mintaHapusKandangMaster(int $id): void
    {
        $kandang = $this->kandangDiFarm($id);
        $this->resetErrorBag('hapusKandangMaster');
        $this->pesan = null;
        $this->kandangMasterHapusId = $kandang->id;
        $this->kandangMasterHapusNama = $kandang->nama;
    }

    public function hapusKandangMaster(): void
    {
        $kandang = $this->kandangDiFarm($this->kandangMasterHapusId ?? abort(404));

        if ($kandang->periodeKandang()->exists()) {
            $this->addError('hapusKandangMaster', 'Kandang tidak dapat dihapus karena sudah dipakai pada sebuah periode.');

            return;
        }

        $nama = $kandang->nama;
        DB::transaction(function () use ($kandang, $nama): void {
            $kandang->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::Periode, 'Kandang '.$nama);
        });

        $this->kandangMasterHapusId = null;
        $this->kandangMasterHapusNama = '';
        $this->pesan = $nama.' dihapus.';
        $this->resetErrorBag('hapusKandangMaster');
        unset($this->daftarKandang, $this->periodeTerpilih, $this->masterData);
    }

    public function batalKandang(): void
    {
        $this->bersihkanFormKandang();
    }

    public function render()
    {
        return view('livewire.manajemen-periode');
    }

    private function bersihkanFormPeriode(): void
    {
        $this->resetValidation();
        $this->periodeFormId = null;
        $this->nama = '';
        $this->nomorSiklus = '';
        $this->inti = '';
        $this->ppl = '';
        $this->strain = '';
        $this->tanggalChickIn = '';
        $this->beratDocGram = '';
        $this->jumlahDocChickIn = null;
        $this->status = 'persiapan';
    }

    private function bersihkanFormKandang(): void
    {
        $this->resetValidation();
        $this->periodeKandangFormId = null;
        $this->kandangId = '';
        $this->populasiAwal = '';
        $this->tanggalChickInKandang = '';
        $this->beratDocGramKandang = '';
        $this->hargaDocPerEkor = '';
        $this->bonusDocEkor = '0';
    }

    private function periodeKandangUntukPeriode(int $id): PeriodeKandang
    {
        return ($this->periodeTerpilih ?? abort(404))
            ->kandangPeriode()
            ->with(['kandang', 'periode'])
            ->whereKey($id)
            ->firstOrFail();
    }

    private function periodeDiFarm(int $id): ModelPeriode
    {
        return ($this->farmTerpilih ?? abort(404))
            ->periodes()
            ->whereKey($id)
            ->firstOrFail();
    }

    private function kandangDiFarm(int $id): Kandang
    {
        return ($this->farmTerpilih ?? abort(404))
            ->kandangs()
            ->whereKey($id)
            ->firstOrFail();
    }

    /**
     * Kandang periode milik farm terpilih, dipakai untuk membuka kunci lembar bagi hasil.
     */
    private function periodeKandangTerpilih(int $id): PeriodeKandang
    {
        return PeriodeKandang::query()
            ->whereKey($id)
            ->whereHas('periode', fn ($query) => $query->where('farm_id', $this->farmTerpilih->id))
            ->with(['bagiHasil', 'kandang', 'periode'])
            ->firstOrFail();
    }

    /**
     * Ringkasan perubahan data DOC sebuah kandang, ditulis pada jejak aktivitas.
     *
     * @param  array<string, mixed>  $data
     */
    private function rincianPerubahanKandang(PeriodeKandang $periodeKandang, array $data): ?string
    {
        $perubahan = [];

        if ($periodeKandang->populasi_awal !== (int) $data['populasiAwal']) {
            $perubahan[] = 'populasi awal '.Format::angka($periodeKandang->populasi_awal)
                .' menjadi '.Format::angka((int) $data['populasiAwal']).' ekor';
        }

        if ((int) $periodeKandang->bonus_doc_ekor !== (int) $data['bonusDocEkor']) {
            $perubahan[] = 'bonus DOC '.Format::angka((int) $periodeKandang->bonus_doc_ekor)
                .' menjadi '.Format::angka((int) $data['bonusDocEkor']).' ekor';
        }

        $hargaLama = $periodeKandang->harga_doc_per_ekor;
        $hargaBaru = $data['hargaDocPerEkor'] === '' ? null : (int) $data['hargaDocPerEkor'];
        if ($hargaLama !== $hargaBaru) {
            $perubahan[] = 'harga DOC '.($hargaLama === null ? 'kosong' : 'Rp '.Format::angka($hargaLama))
                .' menjadi '.($hargaBaru === null ? 'kosong' : 'Rp '.Format::angka($hargaBaru)).'/ekor';
        }

        return $perubahan === [] ? null : implode('; ', $perubahan);
    }

    private function kandangPunyaCatatan(PeriodeKandang $periodeKandang): bool
    {
        return $periodeKandang->punyaCatatan();
    }

    /**
     * Parameter dasar periode yang sudah tercatat tidak boleh berubah lagi, karena laporan turunannya
     * (deplesi, FCR, IP) dihitung dari angka itu. Parameter yang belum pernah diisi masih boleh dilengkapi.
     *
     * @param  array<string, mixed>  $data
     */
    private function baselineBerubah(ModelPeriode $periode, array $data): bool
    {
        if ($periode->nomor_siklus !== null && $periode->nomor_siklus !== (int) $data['nomorSiklus']) {
            return true;
        }

        if ($periode->inti !== null && $periode->inti !== $data['inti']) {
            return true;
        }

        if ($periode->ppl !== null && $periode->ppl !== $data['ppl']) {
            return true;
        }

        return $periode->strain !== $data['strain']
            || $periode->tanggal_chick_in->toDateString() !== $data['tanggalChickIn']
            || $periode->berat_doc_gram !== (int) $data['beratDocGram'];
    }

    private function periodePunyaCatatan(ModelPeriode $periode): bool
    {
        return $periode->penerimaanPakan()->exists()
                || $periode->transferPakan()->exists()
                || $periode->notaPanen()->exists()
                || $periode->hargaKontrak()->exists()
                || $periode->rhppSimulasi()->exists()
                || $periode->rhppReal()->exists()
                || $periode->kandangPeriode()->where(function ($query): void {
                    $query->whereHas('recordings')
                        ->orWhereHas('pemberianPakan')
                        ->orWhereHas('sesiSampling')
                        ->orWhereHas('transaksiKas')
                        ->orWhereHas('slipGaji')
                        ->orWhereHas('bagiHasil');
                })->exists();
    }
}
