<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\JenisPakan;
use App\Models\PemberianPakan;
use App\Models\PenerimaanPakan;
use App\Models\PeriodeKandang;
use App\Support\LogPakan;
use App\Support\Standar;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Pakan dan stok')]
class LogPemberianPakan extends Component
{
    use MemilihPeriode;

    public bool $formTerbuka = false;

    public string $tipeForm = '';

    #[Locked]
    public ?int $catatanId = null;

    public string $tanggal = '';

    public string $jenisPakanId = '';

    public string $periodeKandangId = '';

    public string $zak = '';

    #[Locked]
    public ?int $catatanHapusId = null;

    #[Locked]
    public string $tipeHapus = '';

    public string $catatanHapus = '';

    public ?string $pesan = null;

    /**
     * @return Collection<int, JenisPakan>
     */
    #[Computed]
    public function daftarJenisPakan(): Collection
    {
        return JenisPakan::query()->orderBy('kode')->get();
    }

    /**
     * @return Collection<int, PeriodeKandang>
     */
    #[Computed]
    public function daftarKandang(): Collection
    {
        return $this->periode
            ? $this->periode->kandangPeriode()->with('kandang', 'pemberianPakan')->get()
                ->filter(fn (PeriodeKandang $kandang): bool => $kandang->populasiAktual() > 0 || $kandang->pemberianPakan->isNotEmpty())
                ->sortBy('kandang.nama')
                ->values()
            : new Collection;
    }

    /**
     * @return Collection<int, PenerimaanPakan>
     */
    #[Computed]
    public function daftarPenerimaan(): Collection
    {
        return $this->periode
            ? $this->periode->penerimaanPakan()->with('jenisPakan')->orderByDesc('tanggal')->orderByDesc('id')->get()
            : new Collection;
    }

    /**
     * @return array{min: string, max: string}
     */
    #[Computed]
    public function batasTanggal(): array
    {
        $periode = $this->periode ?? abort(404);
        $kandangPeriode = $this->periodeKandangId !== ''
            ? $periode->kandangPeriode()->find($this->periodeKandangId)
            : null;
        $tanggalMulai = $kandangPeriode?->tanggalChickInEfektif() ?? $periode->tanggal_chick_in;
        $beratDoc = $kandangPeriode?->beratDocGramEfektif() ?? $periode->berat_doc_gram;
        $min = $tanggalMulai->toDateString();
        $maks = $tanggalMulai->copy()
            ->addDays((new Standar($periode->strain, (float) $beratDoc))->umurMaksimal())
            ->min(today());

        return ['min' => $min, 'max' => $maks->lt($min) ? $min : $maks->toDateString()];
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function log(): ?array
    {
        $periode = $this->periode?->fresh();
        if (! $periode) {
            return null;
        }

        return LogPakan::buat($periode->load([
            'kandangPeriode.kandang',
            'kandangPeriode.pemberianPakan.jenisPakan',
            'penerimaanPakan.jenisPakan',
        ]));
    }

    /**
     * Ringkasan singkat halaman: pakan yang masuk, terpakai, dan tersisa, serta banyaknya hari pemberian.
     *
     * @return array{masuk: float, masuk_kg: float, terpakai: float, terpakai_kg: float, sisa: ?float, sisa_kg: ?float, hari: int, catatan: int}
     */
    #[Computed]
    public function ringkasan(): array
    {
        $log = $this->log;

        if (! $log) {
            return [
                'masuk' => 0.0,
                'masuk_kg' => 0.0,
                'terpakai' => 0.0,
                'terpakai_kg' => 0.0,
                'sisa' => null,
                'sisa_kg' => null,
                'hari' => 0,
                'catatan' => 0,
            ];
        }

        $hari = collect($log['hari'])->filter(fn (array $satu): bool => $satu['jenis'] !== []);
        $catatan = $hari->sum(fn (array $satu): int => collect($satu['jenis'])->sum(
            fn (array $jenis): int => collect($jenis['catatan'])->sum(fn (array $daftar): int => count($daftar)),
        ));

        return [
            'masuk' => $log['total_stok']['masuk'],
            'masuk_kg' => $log['total_stok']['masuk_kg'],
            'terpakai' => $log['total_stok']['terpakai'],
            'terpakai_kg' => $log['total_stok']['terpakai_kg'],
            'sisa' => $log['total_stok']['sisa'],
            'sisa_kg' => $log['total_stok']['sisa_kg'],
            'hari' => $hari->count(),
            'catatan' => $catatan,
        ];
    }

    public function tambahPenerimaan(): void
    {
        $this->bukaForm('penerimaan');
    }

    public function ubahPenerimaan(int $id): void
    {
        $penerimaan = $this->penerimaanUntukPeriode($id);
        $this->bukaForm('penerimaan');
        $this->catatanId = $penerimaan->id;
        $this->tanggal = $penerimaan->tanggal->toDateString();
        $this->jenisPakanId = (string) $penerimaan->jenis_pakan_id;
        $this->zak = (string) $penerimaan->zak;
    }

    public function tambahPemberian(): void
    {
        $this->bukaForm('pemberian');
    }

    public function ubahPemberian(int $id): void
    {
        $pemberian = $this->pemberianUntukPeriode($id);
        $this->bukaForm('pemberian');
        $this->catatanId = $pemberian->id;
        $this->tanggal = $pemberian->tanggal->toDateString();
        $this->jenisPakanId = (string) ($pemberian->jenis_pakan_id ?? '');
        $this->periodeKandangId = (string) $pemberian->periode_kandang_id;
        $this->zak = (string) $pemberian->zak;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->formTerbuka = false;
        $this->tipeForm = '';
        $this->catatanId = null;
        $this->tanggal = '';
        $this->jenisPakanId = '';
        $this->periodeKandangId = '';
        $this->zak = '';
    }

    public function simpan(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $periode = $this->periode ?? abort(404);
        $aturanTanggal = [
            'required',
            'date_format:Y-m-d',
            'after_or_equal:'.$this->batasTanggal['min'],
            'before_or_equal:'.$this->batasTanggal['max'],
        ];
        $data = $this->validate([
            'tipeForm' => ['required', Rule::in(['penerimaan', 'pemberian'])],
            'tanggal' => $aturanTanggal,
            'jenisPakanId' => [
                'nullable',
                'integer',
                Rule::exists('jenis_pakans', 'id'),
            ],
            'periodeKandangId' => [
                Rule::requiredIf($this->tipeForm === 'pemberian'),
                'nullable',
                'integer',
                Rule::exists('periode_kandangs', 'id')->where('periode_id', $periode->id),
            ],
            'zak' => ['required', 'numeric', 'decimal:0,1', 'gt:0', 'max:9999999.9'],
        ], [
            'tanggal.required' => 'Tanggal wajib diisi.',
            'tanggal.date_format' => 'Tanggal tidak valid.',
            'tanggal.after_or_equal' => 'Tanggal tidak boleh sebelum chick-in.',
            'tanggal.before_or_equal' => 'Tanggal tidak boleh melewati batas umur periode atau hari ini.',
            'jenisPakanId.exists' => 'Jenis pakan tidak ditemukan.',
            'periodeKandangId.required' => 'Kandang wajib dipilih.',
            'periodeKandangId.exists' => 'Kandang tersebut tidak terdaftar pada periode ini.',
            'zak.required' => 'Jumlah zak wajib diisi.',
            'zak.numeric' => 'Jumlah zak harus berupa angka.',
            'zak.decimal' => 'Jumlah zak maksimal satu angka di belakang koma.',
            'zak.gt' => 'Jumlah zak harus lebih dari 0.',
        ]);

        $mengubah = $this->catatanId !== null;
        $tanggal = Carbon::parse($data['tanggal']);
        $periodeKandang = $this->tipeForm === 'pemberian'
            ? $periode->kandangPeriode()->findOrFail($data['periodeKandangId'])
            : null;
        if ($periodeKandang && $tanggal->lt($periodeKandang->tanggalChickInEfektif())) {
            $this->addError('tanggal', 'Tanggal pemberian tidak boleh sebelum chick-in kandang.');

            return;
        }
        $jenisPakan = $data['jenisPakanId'] ? JenisPakan::findOrFail($data['jenisPakanId']) : null;
        $subjek = $this->tipeForm === 'penerimaan'
            ? 'Pakan masuk '.($jenisPakan?->kode ?? 'tanpa jenis')
            : 'Pemberian pakan '.($jenisPakan?->kode ?? 'tanpa jenis').' '.($this->daftarKandang->firstWhere('id', (int) $data['periodeKandangId'])?->kandang->nama ?? abort(404));

        if ($this->tipeForm === 'penerimaan') {
            $catatan = $mengubah
                ? $this->penerimaanUntukPeriode($this->catatanId)
                : $periode->penerimaanPakan()->make();
            $catatan->fill([
                'jenis_pakan_id' => $data['jenisPakanId'] ?: null,
                'tanggal' => $tanggal,
                'zak' => $data['zak'],
            ]);
        } else {
            $catatan = $mengubah
                ? $this->pemberianUntukPeriode($this->catatanId)
                : new PemberianPakan;
            $catatan->fill([
                'periode_kandang_id' => $data['periodeKandangId'],
                'jenis_pakan_id' => $data['jenisPakanId'] ?: null,
                'tanggal' => $tanggal,
                'umur' => (int) $periodeKandang->tanggalChickInEfektif()->diffInDays($tanggal, false),
                'zak' => $data['zak'],
            ]);
        }

        DB::transaction(function () use ($catatan, $mengubah, $subjek, $periode): void {
            $catatan->save();
            Aktivitas::catat(
                $mengubah ? JenisAktivitas::Ubah : JenisAktivitas::Tambah,
                ModulAktivitas::PakanDanStok,
                $subjek,
                $periode->nama,
            );
        });

        $this->pesan = $subjek.($mengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->dispatch('tutup-modal-pakan');
        $this->batal();
        $periode->unsetRelation('kandangPeriode')->unsetRelation('penerimaanPakan');
        unset($this->daftarPeriode, $this->periode, $this->log, $this->daftarPenerimaan);
        $this->dispatch('pakan-disimpan');
    }

    public function mintaHapusPenerimaan(int $id): void
    {
        $penerimaan = $this->penerimaanUntukPeriode($id);
        $this->siapkanHapus('penerimaan', $penerimaan->id, 'Pakan masuk '.($penerimaan->jenisPakan?->kode ?? 'tanpa jenis').' '.$penerimaan->tanggal->translatedFormat('j M Y'));
    }

    public function mintaHapusPemberian(int $id): void
    {
        $pemberian = $this->pemberianUntukPeriode($id);
        $this->siapkanHapus('pemberian', $pemberian->id, 'Pemberian '.($pemberian->jenisPakan?->kode ?? 'tanpa jenis').' '.$pemberian->periodeKandang->kandang->nama.' '.$pemberian->tanggal->translatedFormat('j M Y'));
    }

    public function hapus(): void
    {
        $this->pastikanPeriodeDapatDiubah();
        $id = $this->catatanHapusId ?? abort(404);
        if ($this->tipeHapus === 'penerimaan') {
            $catatan = $this->penerimaanUntukPeriode($id);
            $subjek = 'Pakan masuk '.($catatan->jenisPakan?->kode ?? 'tanpa jenis');
        } elseif ($this->tipeHapus === 'pemberian') {
            $catatan = $this->pemberianUntukPeriode($id);
            $subjek = 'Pemberian pakan '.($catatan->jenisPakan?->kode ?? 'tanpa jenis').' '.$catatan->periodeKandang->kandang->nama;
        } else {
            abort(404);
        }

        DB::transaction(function () use ($catatan, $subjek): void {
            $catatan->delete();
            Aktivitas::catat(JenisAktivitas::Hapus, ModulAktivitas::PakanDanStok, $subjek, $this->periode->nama);
        });
        $this->catatanHapusId = null;
        $this->tipeHapus = '';
        $this->catatanHapus = '';
        $this->pesan = $subjek.' dihapus.';
        $this->resetValidation();
        $this->periode->unsetRelation('kandangPeriode')->unsetRelation('penerimaanPakan');
        unset($this->daftarPeriode, $this->periode, $this->log, $this->daftarPenerimaan);
    }

    public function render(): View
    {
        return view('livewire.log-pemberian-pakan');
    }

    private function bukaForm(string $tipe): void
    {
        abort_unless($this->periode, 404);
        $this->resetValidation();
        $this->pesan = null;
        $this->formTerbuka = true;
        $this->tipeForm = $tipe;
        $this->catatanId = null;
        $this->tanggal = today()->toDateString();
        if ($this->tanggal < $this->batasTanggal['min']) {
            $this->tanggal = $this->batasTanggal['min'];
        } elseif ($this->tanggal > $this->batasTanggal['max']) {
            $this->tanggal = $this->batasTanggal['max'];
        }
        $this->jenisPakanId = '';
        $this->periodeKandangId = (string) $this->daftarKandang->first()?->id;
        $this->zak = '';
    }

    private function siapkanHapus(string $tipe, int $id, string $subjek): void
    {
        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->tipeHapus = $tipe;
        $this->catatanHapusId = $id;
        $this->catatanHapus = $subjek;
    }

    private function penerimaanUntukPeriode(int $id): PenerimaanPakan
    {
        return ($this->periode ?? abort(404))
            ->penerimaanPakan()
            ->with('jenisPakan')
            ->whereKey($id)
            ->firstOrFail();
    }

    private function pemberianUntukPeriode(int $id): PemberianPakan
    {
        return PemberianPakan::query()
            ->whereIn('periode_kandang_id', ($this->periode ?? abort(404))->kandangPeriode()->select('id'))
            ->with(['jenisPakan', 'periodeKandang.kandang'])
            ->whereKey($id)
            ->firstOrFail();
    }
}
