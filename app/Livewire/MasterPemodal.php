<?php

namespace App\Livewire;

use App\Models\Kandang;
use App\Models\Pemodal;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Title;
use Livewire\Component;

#[Title('Pemodal')]
class MasterPemodal extends Component
{
    public bool $formTerbuka = false;

    #[Locked]
    public ?int $pemodalId = null;

    public string $nama = '';

    /**
     * @var array<int, string|null>
     */
    public array $porsiKandang = [];

    public ?string $pesan = null;

    #[Locked]
    public ?int $pemodalHapusId = null;

    public string $namaHapus = '';

    /**
     * @return Collection<int, Pemodal>
     */
    #[Computed]
    public function daftar(): Collection
    {
        return Pemodal::query()
            ->with('kandangs')
            ->orderBy('nama')
            ->get();
    }

    /**
     * @return Collection<int, Kandang>
     */
    #[Computed]
    public function kandangs(): Collection
    {
        return Kandang::query()
            ->orderBy('nama')
            ->get();
    }

    public function tambah(): void
    {
        $this->resetValidation();
        $this->pesan = null;
        $this->pemodalId = null;
        $this->nama = '';
        $this->porsiKandang = $this->kandangs
            ->mapWithKeys(fn (Kandang $kandang): array => [$kandang->id => ''])
            ->all();
        $this->formTerbuka = true;
    }

    public function ubah(int $id): void
    {
        $pemodal = Pemodal::query()
            ->with('kandangs')
            ->findOrFail($id);

        $this->resetValidation();
        $this->pesan = null;
        $this->pemodalId = $pemodal->id;
        $this->nama = $pemodal->nama;
        $this->porsiKandang = $this->kandangs
            ->mapWithKeys(fn (Kandang $kandang): array => [
                $kandang->id => $pemodal->kandangs->firstWhere('id', $kandang->id)?->pivot->persen ?? '',
            ])
            ->all();
        $this->formTerbuka = true;
    }

    public function batal(): void
    {
        $this->resetValidation();
        $this->pemodalId = null;
        $this->nama = '';
        $this->porsiKandang = [];
        $this->formTerbuka = false;
    }

    public function simpan(): void
    {
        $this->nama = trim($this->nama);

        $kandangIds = $this->kandangs->modelKeys();
        $rules = [
            'nama' => ['required', 'string', 'max:150', Rule::unique('pemodals', 'nama')->ignore($this->pemodalId)],
            'porsiKandang' => $kandangIds === [] ? ['array'] : ['array:'.implode(',', $kandangIds)],
        ];

        foreach ($this->kandangs as $kandang) {
            $rules['porsiKandang.'.$kandang->id] = ['nullable', 'numeric', 'decimal:0,3', 'gt:0', 'max:100'];
        }

        $data = $this->validate($rules, [
            'nama.required' => 'Nama pemodal wajib diisi.',
            'nama.max' => 'Nama pemodal maksimal 150 karakter.',
            'nama.unique' => 'Nama pemodal sudah terdaftar.',
            'porsiKandang.*.numeric' => 'Porsi harus berupa angka.',
            'porsiKandang.*.decimal' => 'Porsi maksimal tiga angka di belakang koma.',
            'porsiKandang.*.gt' => 'Porsi harus lebih dari 0%.',
            'porsiKandang.*.max' => 'Porsi maksimal 100%.',
        ]);

        $pemodalTerdaftarQuery = Pemodal::query()->with('kandangs');
        if ($this->pemodalId !== null) {
            $pemodalTerdaftarQuery->where('id', '!=', $this->pemodalId);
        }
        $pemodalTerdaftar = $pemodalTerdaftarQuery->get();

        foreach ($data['porsiKandang'] ?? [] as $kandangId => $persen) {
            if ($persen === null || $persen === '') {
                continue;
            }

            $totalTerdaftar = $pemodalTerdaftar->sum(
                fn (Pemodal $terdaftar): int => (int) round((float) ($terdaftar->kandangs->firstWhere('id', (int) $kandangId)?->pivot->persen ?? 0) * 1000),
            );

            if ($totalTerdaftar + (int) round((float) $persen * 1000) > 100_000) {
                $namaKandang = $this->kandangs->firstWhere('id', (int) $kandangId)->nama;

                throw ValidationException::withMessages([
                    'porsiKandang.'.$kandangId => "Total porsi pemodal untuk {$namaKandang} tidak boleh lebih dari 100%.",
                ]);
            }
        }

        $sedangMengubah = $this->pemodalId !== null;
        $alokasi = [];
        foreach ($data['porsiKandang'] ?? [] as $kandangId => $persen) {
            if ($persen !== null && $persen !== '') {
                $alokasi[(int) $kandangId] = ['persen' => $persen];
            }
        }

        DB::transaction(function () use ($data, $alokasi): void {
            $pemodal = $this->pemodalId
                ? Pemodal::query()->findOrFail($this->pemodalId)
                : new Pemodal;
            $pemodal->nama = $data['nama'];
            $pemodal->save();
            $pemodal->kandangs()->sync($alokasi);
        });

        $this->pesan = 'Pemodal '.$data['nama'].($sedangMengubah ? ' diperbarui.' : ' ditambahkan.');
        $this->batal();
        unset($this->daftar);
    }

    public function mintaHapus(int $id): void
    {
        $pemodal = Pemodal::query()->findOrFail($id);

        $this->resetErrorBag('hapus');
        $this->pesan = null;
        $this->pemodalHapusId = $pemodal->id;
        $this->namaHapus = $pemodal->nama;
    }

    public function hapus(): void
    {
        $id = $this->pemodalHapusId ?? abort(404);
        $pemodal = Pemodal::query()->findOrFail($id);
        $nama = $pemodal->nama;
        $pemodal->delete();

        $this->pemodalHapusId = null;
        $this->namaHapus = '';
        $this->pesan = 'Pemodal '.$nama.' dihapus.';
        $this->resetErrorBag('hapus');
        unset($this->daftar);
    }

    public function render(): View
    {
        return view('livewire.master-pemodal');
    }
}
