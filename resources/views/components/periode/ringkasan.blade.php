@props(['periode'])

{{-- Identitas periode terpilih: judul dengan tag status, angka utama , dan pintasan ke modul periode. --}}
<section class="card basalt-box db-card mb-4">
<div class="db-card-body">
<header class="db-card-head">
<div class="d-flex align-items-center flex-wrap gap-2">
            <h2 class="db-card-title">{{ $periode->nama }}</h2>
            <span class="badge bg-primary-subtle text-primary m-0">Periode aktif</span>
            <span @class(['badge  m-0', 'bg-success-subtle text-success' => $periode->berjalan(), 'bg-info-subtle text-info' => ! $periode->berjalan()])>{{ $periode->labelStatus() }}</span>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-2">
            @unless ($periode->tertutup())
                <x-aksi.ikon :aksi="[
                    ['kelas' => 'edit', 'label' => 'Ubah periode '.$periode->nama, 'click' => 'ubahPeriode('.$periode->id.')', 'modal' => '#modal-periode'],
                    ['kelas' => 'remove', 'label' => 'Hapus periode '.$periode->nama, 'click' => 'mintaHapusPeriode('.$periode->id.')', 'modal' => '#konfirmasi-hapus-periode'],
                ]" />
            @else
                <span class="badge bg-info-subtle text-info m-0">Tutup RHPP · baca saja</span>
            @endunless
        </div>
</header>
        <p class="text-body-secondary mb-3">
            Siklus {{ $periode->labelSiklus() }} · Inti {{ $periode->inti ?: 'belum ditetapkan' }} · PPL {{ $periode->ppl ?: 'belum ditetapkan' }}
            <span class="d-block">Chick-in {{ $periode->tanggal_chick_in->translatedFormat('j M Y') }} · standar {{ $periode->strain }}</span>
        </p>

        <div class="d-flex flex-wrap gap-3 mb-4">
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Kandang</span>
                <p class="h5 mb-0">{{ $periode->kandangPeriode->count() }}</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">DOC chick-in</span>
                <p class="h5 mb-0">@angka($periode->totalDocChickIn()) ekor</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Berat DOC</span>
                <p class="h5 mb-0">{{ $periode->beratDocTampil() }}</p>
            </div>
            <div class="border rounded p-3 h-100">
                <span class="d-block small text-body-secondary">Umur ayam</span>
                <p class="h5 mb-0">{{ $periode->umurPada(today()) }} hari</p>
            </div>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary btn-sm" href="{{ route('laporan.harian', ['periode' => $periode->id]) }}">Laporan harian</a>
            <a class="btn btn-outline-primary text-primary btn-sm" href="{{ route('rhpp', ['periode' => $periode->id]) }}">RHPP</a>
            <a class="btn btn-outline-primary text-primary btn-sm" href="{{ route('panen.rekap', ['periode' => $periode->id]) }}">Panen</a>
            <a class="btn btn-outline-primary text-primary btn-sm" href="{{ route('payroll.pemanen', ['periode' => $periode->id]) }}">Payroll pemanen</a>
            <a class="btn btn-outline-primary text-primary btn-sm" href="{{ route('pakan.log', ['periode' => $periode->id]) }}">Pakan dan stok</a>
        </div>
    
</div>
</section>
