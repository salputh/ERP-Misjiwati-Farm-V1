<?php

namespace App\Livewire;

use App\Livewire\Concerns\MemilihPeriode;
use App\Models\JenisPakan;
use App\Models\PeriodeKandang;
use App\Support\IsianLaporanHarian;
use App\Support\RingkasanHarian;
use App\Support\Standar;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Title;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Form laporan harian satu tanggal: tambah laporan baru, ubah yang sudah tersimpan, atau hapus.
 */
#[Title('Form laporan harian')]
class FormLaporanHarian extends Component
{
    use MemilihPeriode;

    /** Tanggal laporan (Y-m-d). Kosong berarti hari setelah laporan terakhir. */
    #[Url(as: 'tanggal')]
    public string $tanggal = '';

    /**
     * Pakan masuk (zak) per jenis: "j{id}" => isian.
     *
     * @var array<string, string|int|float|null>
     */
    public array $masuk = [];

    /**
     * Isian tiap kandang: "k{id}" => [mati, afkir, abw, catatan, pakan => ["j{id}" => zak]].
     *
     * @var array<string, array<string, mixed>>
     */
    public array $isian = [];

    public function mount(): void
    {
        if (! $this->periode) {
            return;
        }

        if (! $this->tanggalSah($this->tanggal)) {
            $this->tanggal = $this->tanggalAwal()->format('Y-m-d');
        }

        $this->muat();
    }

    public function updatedTanggal(): void
    {
        if (! $this->tanggalSah($this->tanggal)) {
            $this->tanggal = $this->tanggalAwal()->format('Y-m-d');
        }

        unset($this->tersimpan, $this->sisaSebelum, $this->umur, $this->labelTanggal);
        $this->muat();
    }

    /**
     * Rentang tanggal yang bisa dilaporkan: dari chick-in sampai hari ini, paling jauh umur terakhir di standar strain.
     *
     * @return array{min: CarbonInterface, maks: CarbonInterface}
     */
    #[Computed]
    public function batas(): array
    {
        $min = $this->periode->tanggal_chick_in->copy()->startOfDay();
        $umurMaksimal = (new Standar($this->periode->strain, (float) $this->periode->berat_doc_gram))->umurMaksimal();
        $maks = $min->copy()->addDays($umurMaksimal)->min(today());

        return ['min' => $min, 'maks' => $maks->lt($min) ? $min : $maks];
    }

    /**
     * Kandang periode terpilih, urut nama.
     *
     * @return Collection<int, PeriodeKandang>
     */
    #[Computed]
    public function kandang(): Collection
    {
        return $this->periode
            ? $this->periode->kandangPeriode()->with(['kandang', 'recordings'])->get()->sortBy('kandang.nama')->values()
            : new Collection;
    }

    /**
     * @return Collection<int, JenisPakan>
     */
    #[Computed]
    public function jenisPakan(): Collection
    {
        return JenisPakan::orderBy('kode')->get();
    }

    #[Computed]
    public function umur(): int
    {
        return $this->periode->umurPada(Carbon::parse($this->tanggal));
    }

    /**
     * Tanggal terpilih untuk judul modal konfirmasi: 2 Oktober 2026.
     */
    #[Computed]
    public function labelTanggal(): string
    {
        return Carbon::parse($this->tanggal)->translatedFormat('j F Y');
    }

    /**
     * Tanggal terpilih sudah punya laporan, jadi form ini mengubahnya.
     */
    #[Computed]
    public function tersimpan(): bool
    {
        return IsianLaporanHarian::ada($this->periode, Carbon::parse($this->tanggal));
    }

    /**
     * Sisa ayam tiap kandang tanpa menghitung kematian pada tanggal terpilih: "k{id}" => ekor.
     *
     * @return array<string, int>
     */
    #[Computed]
    public function sisaSebelum(): array
    {
        return $this->kandang->mapWithKeys(fn (PeriodeKandang $kandang): array => [
            'k'.$kandang->id => $kandang->populasi_awal - (int) $kandang->recordings
                ->reject(fn ($rekaman): bool => $rekaman->tanggal->toDateString() === $this->tanggal)
                ->sum(fn ($rekaman): int => $rekaman->mati + $rekaman->afkir),
        ])->all();
    }

    public function simpan(): void
    {
        $data = $this->withValidator(function (Validator $validator): void {
            $validator->after(function (Validator $validator): void {
                $this->periksaSisaAyam($validator);
                $this->periksaTerisi($validator);
            });
        })->validate($this->aturan(), $this->pesanValidasi(), $this->namaIsian());

        $tanggal = Carbon::parse($this->tanggal);
        IsianLaporanHarian::simpan($this->periode, $tanggal, $data['masuk'] ?? [], $data['isian'] ?? []);

        session()->flash('pesan', 'Laporan harian '.$tanggal->translatedFormat('j F Y').' tersimpan.');
        $this->redirectRoute('laporan.harian', ['periode' => $this->periode->id, 'tanggal' => $this->tanggal]);
    }

    public function hapus(): void
    {
        $tanggal = Carbon::parse($this->tanggal);
        IsianLaporanHarian::hapus($this->periode, $tanggal);

        session()->flash('pesan', 'Laporan harian '.$tanggal->translatedFormat('j F Y').' dihapus.');
        $this->redirectRoute('laporan.harian', ['periode' => $this->periode->id]);
    }

    public function render(): View
    {
        return view('livewire.form-laporan-harian');
    }

    private function muat(): void
    {
        $this->resetValidation();

        ['masuk' => $this->masuk, 'isian' => $this->isian] = IsianLaporanHarian::muat($this->periode, Carbon::parse($this->tanggal), $this->jenisPakan);
    }

    private function tanggalSah(string $tanggal): bool
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggal) === 1
            && Carbon::parse($tanggal)->betweenIncluded($this->batas['min'], $this->batas['maks']);
    }

    /**
     * Tanggal untuk laporan baru: hari setelah laporan terakhir, dalam rentang yang diizinkan.
     */
    private function tanggalAwal(): CarbonInterface
    {
        $terakhir = RingkasanHarian::tanggalTerakhir($this->periode->loadMissing(['kandangPeriode.recordings', 'kandangPeriode.pemberianPakan', 'penerimaanPakan']));
        $berikutnya = $terakhir ? Carbon::parse($terakhir)->addDay() : $this->batas['min']->copy();

        return $berikutnya->min($this->batas['maks'])->max($this->batas['min']);
    }

    /**
     * @return array<string, list<string>>
     */
    private function aturan(): array
    {
        $aturan = [];
        foreach ($this->jenisPakan as $jenis) {
            $aturan["masuk.j{$jenis->id}"] = ['nullable', 'numeric', 'min:0', 'max:100000'];
        }

        foreach ($this->kandang as $kandang) {
            $kunci = "isian.k{$kandang->id}";
            $aturan["{$kunci}.mati"] = ['nullable', 'integer', 'min:0'];
            $aturan["{$kunci}.afkir"] = ['nullable', 'integer', 'min:0'];
            $aturan["{$kunci}.abw"] = ['nullable', 'numeric', 'min:1', 'max:10000'];
            $aturan["{$kunci}.catatan"] = ['nullable', 'string', 'max:1000'];
            foreach (array_keys($this->isian["k{$kandang->id}"]['pakan'] ?? []) as $pakan) {
                $aturan["{$kunci}.pakan.{$pakan}"] = ['nullable', 'numeric', 'min:0', 'max:10000'];
            }
        }

        return $aturan;
    }

    /**
     * @return array<string, string>
     */
    private function pesanValidasi(): array
    {
        return [
            'integer' => ':attribute harus angka bulat.',
            'numeric' => ':attribute harus angka.',
            'min' => ':attribute paling sedikit :min.',
            'max.numeric' => ':attribute paling banyak :max.',
            'max.string' => ':attribute paling panjang :max huruf.',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function namaIsian(): array
    {
        $nama = [];
        foreach ($this->jenisPakan as $jenis) {
            $nama["masuk.j{$jenis->id}"] = "Pakan masuk {$jenis->kode}";
        }

        foreach ($this->kandang as $kandang) {
            $kunci = "isian.k{$kandang->id}";
            $nama["{$kunci}.mati"] = 'Kematian';
            $nama["{$kunci}.afkir"] = 'Afkir';
            $nama["{$kunci}.abw"] = 'ABW';
            $nama["{$kunci}.catatan"] = 'Catatan';
            foreach (array_keys($this->isian["k{$kandang->id}"]['pakan'] ?? []) as $pakan) {
                $nama["{$kunci}.pakan.{$pakan}"] = 'Pakan diberikan';
            }
        }

        return $nama;
    }

    /**
     * Kematian dan afkir sampai tanggal ini tidak boleh menghabiskan populasi kandang.
     */
    private function periksaSisaAyam(Validator $validator): void
    {
        foreach ($this->kandang as $kandang) {
            $kunci = "k{$kandang->id}";
            $berkurang = (int) ($this->isian[$kunci]['mati'] ?? 0) + (int) ($this->isian[$kunci]['afkir'] ?? 0);

            if ($berkurang > 0 && $berkurang >= $this->sisaSebelum[$kunci]) {
                $validator->errors()->add("isian.{$kunci}.mati", 'Kematian dan afkir harus kurang dari sisa ayam ('.number_format($this->sisaSebelum[$kunci], 0, ',', '.').' ekor).');
            }
        }
    }

    /**
     * Laporan baru harus berisi sedikitnya satu angka. Laporan tersimpan boleh dikosongkan lewat tombol hapus saja.
     */
    private function periksaTerisi(Validator $validator): void
    {
        $terisi = collect($this->masuk)->merge(collect($this->isian)->flatMap(fn (array $satu): array => [...collect($satu)->except('pakan')->values(), ...array_values($satu['pakan'] ?? [])]))
            ->filter(fn (mixed $nilai): bool => filled($nilai))
            ->isNotEmpty();

        if (! $terisi) {
            $validator->errors()->add('kosong', $this->tersimpan ? 'Semua isian kosong. Untuk menghapus laporan ini, pakai tombol Hapus laporan.' : 'Isi sedikitnya satu data sebelum menyimpan.');
        }
    }
}
