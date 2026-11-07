<div class="container-fluid">
    <div class="row">
        <x-breadcrumb judul="Kasbon ABK" :jejak="['Keuangan', 'Kasbon ABK']">
            @if ($this->periode && ! $this->periode->tertutup())
                <x-tombol.kepala ikon="bi bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-kasbon">Catat kasbon</x-tombol.kepala>
            @endif
        </x-breadcrumb>

        <x-periode-tertutup :periode="$this->periode" />

        @if ($pesan)
            <div class="col-12">
                <x-peringatan warna="success" bisaDitutup="true" class="mb-4">{{ $pesan }}</x-peringatan>
            </div>
        @endif

        @error('potongan_batal')
            <div class="col-12">
                <x-peringatan warna="warning" bisaDitutup="true" class="mb-4">{{ $message }}</x-peringatan>
            </div>
        @enderror

        @error('kasbon_hapus')
            <div class="col-12">
                <x-peringatan warna="danger" bisaDitutup="true" class="mb-4">{{ $message }}</x-peringatan>
            </div>
        @enderror

        @if ($this->baris)
            <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::angka($this->ringkasan['berjalan']).' kasbon'" label="Kasbon berjalan" ikon="bi-receipt-cutoff" warna="primary">
                <small>milik @angka($this->ringkasan['jumlah_abk']) ABK, belum lunas</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::juta($this->ringkasan['sisa'])" label="Sisa kasbon" ikon="bi-wallet2" warna="warning">
                <small>Rp @angka($this->ringkasan['sisa']) belum dipotong dari gaji</small>
            </x-dashboard.kartu>

            <x-dashboard.kartu lebar="col-lg-4 col-sm-6" :nilai="\App\Support\Format::juta($this->ringkasan['terpotong_periode_ini'])" :label="'Dipotong di '.$this->periode?->nama" ikon="bi-dash-circle" warna="success">
                <small>Rp @angka($this->ringkasan['terpotong_periode_ini']) dari slip gaji periode ini</small>
            </x-dashboard.kartu>

            <div class="col-12 mb-4">
                <x-kartu judul="Daftar kasbon" subjudul="Kasbon tidak dipotong otomatis. Setelah ABK setuju, tekan Potong untuk memotongnya dari slip gaji periode ini; satu slip paling banyak sekali potongan. Nominalnya disarankan dari nilai potongan per slip atau dibagi rata, dan dapat diubah saat memotong." badan="p-0">
                    <div class="tabel-data">
                        <div class="table-responsive">
                            <table class="table tabel-laporan mb-0 db-table">
                                <thead>
                                    <tr>
                                        <th>ABK</th>
                                        <th>Keperluan</th>
                                        <th class="text-end">Kasbon</th>
                                        <th>Potongan gaji</th>
                                        <th class="text-end">Sudah dipotong</th>
                                        <th class="text-end">Sisa</th>
                                        <th class="text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($this->baris as $kasbon)
                                        <tr wire:key="kasbon-{{ $kasbon['id'] }}">
                                            <td>
                                                <span class="fw-medium text-body">{{ $kasbon['nama'] }}</span>
                                                <span class="d-block small text-body-secondary">{{ $kasbon['kandang'] ?? 'Belum ditempatkan' }}</span>
                                            </td>
                                            <td>
                                                {{ $kasbon['keperluan'] }}
                                                <span class="d-block small text-body-secondary">{{ $kasbon['tanggal']->translatedFormat('j M Y') }}, {{ $kasbon['periode'] }}</span>
                                                <span class="d-block small text-body-secondary">{{ $kasbon['dari_kas'] ?? 'Di luar kas kandang' }}</span>
                                            </td>
                                            <td class="text-end">@angka($kasbon['jumlah'])</td>
                                            <td>
                                                @angka($kasbon['kali_dipotong']) dari @angka($kasbon['jumlah_potongan']) kali
                                                @if ($kasbon['nilai_potongan'])
                                                    <span class="d-block small text-body-secondary">Rp @angka($kasbon['nilai_potongan']) per slip</span>
                                                @endif
                                                @foreach ($kasbon['riwayat'] as $potongan)
                                                    <span class="d-block small text-body-secondary">{{ $potongan['periode'] }}: Rp @angka($potongan['jumlah'])</span>
                                                @endforeach
                                                @if ($kasbon['potong']['status'] ?? null)
                                                    @switch($kasbon['potong']['status'])
                                                        @case('sudah')
                                                            <span class="d-block small text-success">Sudah dipotong di slip periode ini</span>
                                                            @break
                                                        @case('tanpa_slip')
                                                            <span class="d-block small text-body-secondary">Belum dapat dipotong: slip gaji periode ini belum dibuat</span>
                                                            @break
                                                        @default
                                                            <span class="d-block small text-warning">Belum dipotong di periode ini</span>
                                                    @endswitch
                                                @endif
                                            </td>
                                            <td class="text-end">@angka($kasbon['terpotong'] ?: null)</td>
                                            <td class="text-end">
                                                @if ($kasbon['lunas'])
                                                    <span class="badge bg-success-subtle text-success m-0">Lunas</span>
                                                @else
                                                    <span class="fw-medium text-body">@angka($kasbon['sisa'])</span>
                                                @endif
                                            </td>
                                            <td class="text-end">
                                                <div class="d-flex justify-content-end align-items-center gap-2">
                                                @if (($kasbon['potong']['status'] ?? null) === 'bisa')
                                                    <x-tombol ukuran="xs" ikon="bi-scissors" wire:click="mintaPotong({{ $kasbon['id'] }})" data-bs-toggle="modal" data-bs-target="#modal-potong-kasbon" aria-label="Potong kasbon {{ $kasbon['keperluan'] }} {{ $kasbon['nama'] }} dari slip gaji periode ini">Potong</x-tombol>
                                                @elseif (($kasbon['potong']['status'] ?? null) === 'sudah')
                                                    <x-tombol ukuran="xs" warna="light" variasi="outlined" ikon="bi-arrow-clockwise" wire:click="mintaBatalkanPotongan({{ $kasbon['potong']['potongan_id'] }})" data-bs-toggle="modal" data-bs-target="#konfirmasi-batal-potongan" aria-label="Batalkan potongan kasbon {{ $kasbon['keperluan'] }} {{ $kasbon['nama'] }} di periode ini">Batalkan potongan</x-tombol>
                                                @endif
                                                @if ($kasbon['bisa_diubah'])
                                                    <x-aksi.ikon :aksi="[
                                                        ['kelas' => 'edit', 'label' => 'Ubah kasbon '.$kasbon['keperluan'].' '.$kasbon['nama'], 'click' => 'ubah('.$kasbon['id'].')', 'modal' => '#modal-kasbon'],
                                                        ['kelas' => 'remove', 'label' => 'Hapus kasbon '.$kasbon['keperluan'].' '.$kasbon['nama'], 'click' => 'mintaHapus('.$kasbon['id'].')', 'modal' => '#konfirmasi-hapus-kasbon'],
                                                    ]" />
                                                @endif
                                                </div>
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                        <p class="small text-body-secondary mt-3 mb-0">Kasbon hanya dapat diubah atau dihapus dari periode saat kasbon diambil, selama periode itu belum ditutup.</p>
                    </div>
                </x-kartu>
            </div>
        @elseif ($this->periode)
            <x-kosong judul="Belum ada kasbon ABK">
                Catat kasbon ABK seperti pembelian HP atau sepeda motor, lalu tentukan berapa kali kasbon itu dipotong dari slip gaji.
                @unless ($this->periode->tertutup())
                    <x-slot:aksi>
                        <x-tombol ikon="bi-plus-lg" wire:click="tambah" data-bs-toggle="modal" data-bs-target="#modal-kasbon">Catat kasbon</x-tombol>
                    </x-slot:aksi>
                @endunless
            </x-kosong>
        @else
            <x-kosong judul="Belum ada periode">Kasbon dicatat per periode. Halaman ini terisi setelah periode pertama dibuat.</x-kosong>
        @endif
    </div>

    <x-memuat target="simpan" teks="Menyimpan kasbon" />
    <x-memuat target="hapus" teks="Menghapus kasbon" />
    <x-memuat target="potong" teks="Memotong kasbon dari slip gaji" />
    <x-memuat target="batalkanPotongan" teks="Membatalkan potongan kasbon" />

    @if ($this->periode && ! $this->periode->tertutup())
        <x-modal
            id="modal-kasbon"
            :judul="$kasbonId ? 'Ubah kasbon' : 'Catat kasbon'"
            submit="simpan"
            aksi-tutup="batal"
            x-on:tutup-modal-kasbon.window="bootstrap.Modal.getInstance($el)?.hide()"
        >
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">ABK</label>
                        <x-pilih bentuk="isian" nama="ABK yang mengambil kasbon" :label="$this->karyawanTerpilih?->nama ?? 'Pilih ABK'" :kesalahan="$errors->has('karyawanId')">
                            @foreach ($this->daftarKaryawan as $pilihan)
                                <button type="button" wire:click="pilihKaryawan({{ $pilihan->id }})" @class(['dropdown-item', 'active' => $karyawanId === $pilihan->id])>{{ $pilihan->nama }}<span class="text-body-secondary"> · {{ $pilihan->kandang?->nama ?? 'Belum ditempatkan' }}</span></button>
                            @endforeach
                        </x-pilih>
                        @error('karyawanId')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">Tanggal kasbon</label>
                        <x-pilih-tanggal id="kasbon-tanggal" ukuran="medium" :nilai="$tanggal" :kesalahan="$errors->has('tanggal')" x-on:tanggal-dipilih="$wire.set('tanggal', $event.detail)" />
                        @error('tanggal')<div class="invalid-feedback d-block">{{ $message }}</div>@enderror
                    </div>
                </div>
                <div class="col-12">
                    <x-masukan id="kasbon-keperluan" label="Keperluan" maxlength="100" placeholder="Contoh: HP, sepeda motor" wire:model="keperluan" :kesalahan="$errors->first('keperluan')" autocomplete="off" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="kasbon-jumlah" properti="jumlah" langsung label="Jumlah kasbon (Rp)" placeholder="Contoh: 3.000.000" :kesalahan="$errors->first('jumlah')" wire:key="kasbon-jumlah-{{ $kasbonId ?? 'baru' }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan.ribuan id="kasbon-nilai-potongan" properti="nilaiPotongan" langsung label="Nilai potongan per slip (Rp)" placeholder="Kosongkan bila dibagi rata" keterangan="Isi bila nominal potongannya sudah disepakati." :kesalahan="$errors->first('nilaiPotongan')" wire:key="kasbon-nilai-potongan-{{ $kasbonId ?? 'baru' }}" />
                </div>
                <div class="col-md-4">
                    <x-masukan id="kasbon-jumlah-potongan" tipe="number" min="1" max="{{ \App\Models\Kasbon::MAKS_POTONGAN }}" step="1" label="Dipotong berapa kali" :keterangan="$nilaiPotongan ? 'Dihitung dari nilai potongan per slip.' : 'Satu kali = satu slip gaji periode.'" :readonly="(bool) $nilaiPotongan" wire:model.live.debounce.400ms="jumlahPotongan" :kesalahan="$errors->first('jumlahPotongan')" />
                </div>
                <div class="col-12">
                    <div class="mb-3 mb-4">
                        <label class="form-label fw-medium mb-2">Sumber uang</label>
                        <x-pilih bentuk="isian" nama="Sumber uang kasbon" :label="$dariKas ? 'Kas operasional '.($this->periodeKandangKas?->kandang->nama ?? 'kandang ABK') : 'Di luar kas kandang (misalnya dari pemilik)'" :kesalahan="$errors->has('dariKas')">
                            <button type="button" wire:click="$set('dariKas', false)" @class(['dropdown-item', 'active' => ! $dariKas])>Di luar kas kandang (misalnya dari pemilik)</button>
                            <button type="button" wire:click="$set('dariKas', true)" @class(['dropdown-item', 'active' => $dariKas])>Kas operasional {{ $this->periodeKandangKas?->kandang->nama ?? 'kandang ABK' }}</button>
                        </x-pilih>
                        @error('dariKas')
                            <div class="invalid-feedback d-block">{{ $message }}</div>
                        @else
                            <small class="d-block mt-1 small text-body-secondary">Bila dari kas, transaksi Pinjaman ABK ikut tercatat di buku kas dan diubah dari halaman ini saja. Pinjaman itu tidak dipotong lagi sebagai pinjaman biasa.</small>
                        @enderror
                    </div>
                </div>
                @if ($this->rencanaPotongan)
                    <div class="col-12">
                        <x-peringatan warna="info" judul="Rencana potongan gaji">
                            @foreach ($this->rencanaPotongan as $potongan)
                                Slip ke-{{ $loop->iteration }}: Rp @angka($potongan){{ $loop->last ? '.' : ';' }}
                            @endforeach
                            Rencana ini belum memotong gaji; potongan dibuat lewat tombol Potong setelah disepakati.
                        </x-peringatan>
                    </div>
                @endif
            </div>

            <x-slot:footer>
                <x-tombol.batal wire:click="batal" />
                @if ($kasbonId)
                    <x-tombol wire:key="tombol-simpan-perubahan-kasbon" data-bs-toggle="modal" data-bs-target="#konfirmasi-simpan-kasbon" wire:loading.attr="disabled" wire:target="simpan">Simpan perubahan</x-tombol>
                @else
                    <x-tombol tipe="submit" wire:key="tombol-simpan-kasbon" wire:loading.attr="disabled" wire:target="simpan">Simpan</x-tombol>
                @endif
            </x-slot:footer>
        </x-modal>

        @if ($kasbonId)
            <x-konfirmasi id="konfirmasi-simpan-kasbon" judul="Simpan perubahan kasbon?" aksi="simpan" tombol="Ya, simpan perubahan">
                Potongan yang sudah dibuat tidak berubah. Saran potongan berikutnya mengikuti jumlah dan jumlah potongan yang baru.
            </x-konfirmasi>
        @endif

        <x-modal
            id="modal-potong-kasbon"
            :judul="$judulPotong ?: 'Potong kasbon'"
            submit="potong"
            aksi-tutup="batalPotong"
            x-on:tutup-modal-potong-kasbon.window="bootstrap.Modal.getInstance($el)?.hide()"
        >
            <div wire:loading wire:target="mintaPotong" class="text-center py-3" role="status">
                <x-pemintal />
                <span class="visually-hidden">Memuat</span>
            </div>
            <div wire:loading.remove wire:target="mintaPotong">
                @if ($keteranganPotong)
                    <p class="text-body-secondary mb-3">{{ $keteranganPotong }}</p>
                @endif
                <x-masukan.ribuan id="potong-kasbon-nilai" properti="nilaiPotong" label="Nilai yang dipotong (Rp)" keterangan="Isi sesuai kesepakatan dengan ABK. Sisa kasbon dipotong di slip periode berikutnya." :kesalahan="$errors->first('nilaiPotong')" wire:key="potong-kasbon-nilai-{{ $potongKasbonId ?? 'kosong' }}" />
            </div>

            <x-slot:footer>
                <x-tombol.batal wire:click="batalPotong" />
                <x-tombol tipe="submit" ikon="bi-scissors" wire:loading.attr="disabled" wire:target="mintaPotong, potong">Potong dari gaji</x-tombol>
            </x-slot:footer>
        </x-modal>

        <x-konfirmasi id="konfirmasi-batal-potongan" judul="Batalkan potongan kasbon?" aksi="batalkanPotongan" tombol="Ya, batalkan" warna="danger" memuat="mintaBatalkanPotongan">
            @error('potongan_batal')
                {{ $message }}
            @else
                {{ $namaBatal ?: 'Potongan ini' }} dihapus dari slip gaji periode ini, dan sisa kasbonnya bertambah lagi.
            @enderror
        </x-konfirmasi>

        <x-konfirmasi id="konfirmasi-hapus-kasbon" judul="Hapus kasbon?" aksi="hapus" tombol="Ya, hapus" warna="danger" memuat="mintaHapus">
            {{ $namaHapus ?: 'Kasbon ini' }} dihapus permanen, bersama potongannya di slip gaji periode berjalan dan transaksinya di kas operasional bila ada.
        </x-konfirmasi>
    @endif
</div>
