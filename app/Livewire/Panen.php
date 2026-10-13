<?php

namespace App\Livewire;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Concerns\MemilihPeriode;
use App\Models\Aktivitas;
use App\Models\NotaPanen as ModelNotaPanen;
use App\Support\RekapPanen;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Panen')]
class Panen extends Component
{
    use MemilihPeriode;

    #[Locked]
    public ?int $notaId = null;

    #[Locked]
    public ?int $notaHapusId = null;

    #[Locked]
    public ?string $noBtpaDihapus = null;

    public string $tanggalPanen = '';

    public string $noSpa = '';

    public string $noBtpa = '';

    public string $noPolisi = '';

    public string $pembeli = '';

    public string $tukangTangkap = '';

    public string $mulai = '';

    public string $selesai = '';

    public string $jumlahKrat = '';

    public string $ekor = '';

    public string $beratKg = '';

    public string $nettoNotaKg = '';

    public ?string $pesan = null;

    public function mount(): void
    {
        $this->bersihkanForm();
    }

    public function updatedPeriodeId(): void
    {
        $this->bersihkanForm();
        $this->notaHapusId = null;
        $this->noBtpaDihapus = null;
        unset($this->rekap);
    }

    public function tambah(): void
    {
        $this->bersihkanForm();
    }

    /**
     * @return array<string, mixed>|null
     */
    #[Computed]
    public function rekap(): ?array
    {
        return $this->periode
            ? RekapPanen::buat($this->periode->loadMissing(['notaPanen', 'kandangPeriode.kandang', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan']))
            : null;
    }

    public function ubah(int $id): void
    {
        $nota = $this->notaUntukPeriode($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->notaId = $nota->id;
        $this->tanggalPanen = $nota->tanggal_panen->toDateString();
        $this->noSpa = $nota->no_spa ?? '';
        $this->noBtpa = $nota->no_btpa;
        $this->noPolisi = $nota->no_polisi;
        $this->pembeli = $nota->pembeli;
        $this->tukangTangkap = $nota->tukang_tangkap ?? '';
        $this->mulai = $nota->mulai->format('Y-m-d\TH:i');
        $this->selesai = $nota->selesai->format('Y-m-d\TH:i');
        $this->jumlahKrat = (string) $nota->jumlah_krat;
        $this->ekor = (string) $nota->ekor;
        $this->beratKg = (string) $nota->berat_kg;
        $this->nettoNotaKg = (string) $nota->netto_nota_kg;
    }

    public function batalUbah(): void
    {
        $this->bersihkanForm();
    }

    public function simpan(): void
    {
        $periode = $this->periode ?? abort(404);
        $data = $this->validate([
            'tanggalPanen' => ['required', 'date_format:Y-m-d'],
            'noSpa' => ['nullable', 'string', 'max:255'],
            'noBtpa' => [
                'required',
                'string',
                'max:255',
                Rule::unique('nota_panens', 'no_btpa')
                    ->where('periode_id', $periode->id)
                    ->ignore($this->notaId),
            ],
            'noPolisi' => ['required', 'string', 'max:255'],
            'pembeli' => ['required', 'string', 'max:255'],
            'tukangTangkap' => ['nullable', 'string', 'max:2000'],
            'mulai' => ['required', 'date_format:Y-m-d\TH:i'],
            'selesai' => ['required', 'date_format:Y-m-d\TH:i', 'after_or_equal:mulai'],
            'jumlahKrat' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'ekor' => ['required', 'integer', 'min:1', 'max:4294967295'],
            'beratKg' => ['required', 'numeric', 'gt:0', 'max:99999999.99'],
            'nettoNotaKg' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ], [
            'tanggalPanen.required' => 'Tanggal panen wajib diisi.',
            'tanggalPanen.date_format' => 'Tanggal panen tidak valid.',
            'noBtpa.required' => 'Nomor BTPA wajib diisi.',
            'noBtpa.unique' => 'Nomor BTPA sudah digunakan di periode ini.',
            'noPolisi.required' => 'Nomor polisi wajib diisi.',
            'pembeli.required' => 'Nama pembeli wajib diisi.',
            'mulai.required' => 'Waktu mulai timbang wajib diisi.',
            'mulai.date_format' => 'Waktu mulai timbang tidak valid.',
            'selesai.required' => 'Waktu selesai timbang wajib diisi.',
            'selesai.date_format' => 'Waktu selesai timbang tidak valid.',
            'selesai.after_or_equal' => 'Waktu selesai harus sama atau setelah waktu mulai.',
            'jumlahKrat.required' => 'Jumlah krat wajib diisi.',
            'jumlahKrat.integer' => 'Jumlah krat harus berupa bilangan bulat.',
            'jumlahKrat.min' => 'Jumlah krat minimal 1.',
            'ekor.required' => 'Jumlah ekor wajib diisi.',
            'ekor.integer' => 'Jumlah ekor harus berupa bilangan bulat.',
            'ekor.min' => 'Jumlah ekor minimal 1.',
            'beratKg.required' => 'Berat panen wajib diisi.',
            'beratKg.numeric' => 'Berat panen harus berupa angka.',
            'beratKg.gt' => 'Berat panen harus lebih dari 0.',
            'nettoNotaKg.required' => 'Netto nota wajib diisi.',
            'nettoNotaKg.numeric' => 'Netto nota harus berupa angka.',
            'nettoNotaKg.min' => 'Netto nota tidak boleh kurang dari 0.',
        ]);

        $mulai = Carbon::createFromFormat('Y-m-d\TH:i', $data['mulai']);
        $selesai = Carbon::createFromFormat('Y-m-d\TH:i', $data['selesai']);
        $baru = $this->notaId === null;
        $noBtpa = $data['noBtpa'];

        DB::transaction(function () use ($data, $periode, $mulai, $selesai, $baru, $noBtpa): void {
            $nota = $this->notaId
                ? $periode->notaPanen()->whereKey($this->notaId)->lockForUpdate()->firstOrFail()
                : $periode->notaPanen()->make();

            $nota->fill([
                'tanggal_panen' => $data['tanggalPanen'],
                'no_spa' => $data['noSpa'] ?: null,
                'no_btpa' => $noBtpa,
                'no_polisi' => $data['noPolisi'],
                'pembeli' => $data['pembeli'],
                'tukang_tangkap' => $data['tukangTangkap'] ?: null,
                'mulai' => $mulai,
                'selesai' => $selesai,
                'jumlah_krat' => (int) $data['jumlahKrat'],
                'ekor' => (int) $data['ekor'],
                'berat_kg' => $data['beratKg'],
                'netto_nota_kg' => $data['nettoNotaKg'],
            ])->save();

            Aktivitas::catat(
                $baru ? JenisAktivitas::Tambah : JenisAktivitas::Ubah,
                ModulAktivitas::Panen,
                'Nota panen '.$noBtpa,
                $periode->nama,
            );
        });

        $this->bersihkanForm();
        $this->pesan = 'Nota panen '.$noBtpa.($baru ? ' ditambahkan.' : ' diperbarui.');
        unset($this->periode, $this->rekap);
        $this->dispatch('nota-panen-disimpan');
    }

    public function mintaHapus(int $id): void
    {
        $nota = $this->notaUntukPeriode($id);
        $this->resetErrorBag('nota_hapus');
        $this->pesan = null;
        $this->notaHapusId = $nota->id;
        $this->noBtpaDihapus = $nota->no_btpa;
    }

    public function hapus(): void
    {
        $id = $this->notaHapusId ?? abort(404);
        $periode = $this->periode ?? abort(404);
        $noBtpa = DB::transaction(function () use ($id, $periode): string {
            $nota = $periode->notaPanen()->whereKey($id)->lockForUpdate()->firstOrFail();
            $noBtpa = $nota->no_btpa;

            Aktivitas::catat(
                JenisAktivitas::Hapus,
                ModulAktivitas::Panen,
                'Nota panen '.$noBtpa,
                $periode->nama,
            );
            $nota->delete();

            return $noBtpa;
        });

        if ($this->notaId === $id) {
            $this->bersihkanForm();
        }

        $this->notaHapusId = null;
        $this->noBtpaDihapus = null;
        $this->pesan = 'Nota panen '.$noBtpa.' dihapus.';
        unset($this->periode, $this->rekap);
    }

    public function render(): View
    {
        return view('livewire.panen');
    }

    private function notaUntukPeriode(int $id): ModelNotaPanen
    {
        return ($this->periode ?? abort(404))
            ->notaPanen()
            ->whereKey($id)
            ->firstOrFail();
    }

    private function bersihkanForm(): void
    {
        $now = now();
        $this->resetValidation();
        $this->notaId = null;
        $this->tanggalPanen = $now->toDateString();
        $this->noSpa = '';
        $this->noBtpa = '';
        $this->noPolisi = '';
        $this->pembeli = '';
        $this->tukangTangkap = '';
        $this->mulai = $now->format('Y-m-d\TH:i');
        $this->selesai = $now->copy()->addMinutes(30)->format('Y-m-d\TH:i');
        $this->jumlahKrat = '';
        $this->ekor = '';
        $this->beratKg = '';
        $this->nettoNotaKg = '';
        $this->pesan = null;
    }
}
