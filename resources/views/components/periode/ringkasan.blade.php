@props(['periode'])

{{-- Identitas periode terpilih: judul dengan tag status, angka utama (HexaDash: Statistics), dan pintasan ke modul periode. --}}
<div class="card card-default card-md mb-25">
    <div class="card-header">
        <div class="d-flex align-items-center flex-wrap gap-2">
            <h6>{{ $periode->nama }}</h6>
            <span class="dm-tag tag-primary tag-transparented m-0">Periode aktif</span>
            <span @class(['dm-tag tag-transparented m-0', 'tag-success' => $periode->berjalan(), 'tag-info' => ! $periode->berjalan()])>{{ $periode->labelStatus() }}</span>
        </div>
        <div class="card-extra">
            @unless ($periode->tertutup())
                <x-aksi.ikon :aksi="[
                    ['kelas' => 'edit', 'label' => 'Ubah periode '.$periode->nama, 'click' => 'ubahPeriode('.$periode->id.')', 'modal' => '#modal-periode'],
                    ['kelas' => 'remove', 'label' => 'Hapus periode '.$periode->nama, 'click' => 'mintaHapusPeriode('.$periode->id.')', 'modal' => '#konfirmasi-hapus-periode'],
                ]" />
            @else
                <span class="dm-tag tag-info tag-transparented m-0">Tutup RHPP · baca saja</span>
            @endunless
        </div>
    </div>
    <div class="card-body">
        <p class="fs-14 color-gray mb-20">
            Siklus {{ $periode->nomor_siklus ?? 'belum ditetapkan' }} · Inti {{ $periode->inti ?: 'belum ditetapkan' }} · PPL {{ $periode->ppl ?: 'belum ditetapkan' }}
            <span class="d-block">Chick-in {{ $periode->tanggal_chick_in->translatedFormat('j M Y') }} · standar {{ $periode->strain }}</span>
        </p>

        <div class="dm-statistics-wrap d-flex flex-wrap gap-3 mb-25">
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Kandang</span>
                <p class="statistics-item__number">{{ $periode->kandangPeriode->count() }}</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">DOC chick-in</span>
                <p class="statistics-item__number">@angka($periode->totalDocChickIn()) ekor</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Berat DOC</span>
                <p class="statistics-item__number">{{ $periode->beratDocTampil() }}</p>
            </div>
            <div class="statistics-item statistics-default">
                <span class="statistics-item__title">Umur ayam</span>
                <p class="statistics-item__number">{{ $periode->umurPada(today()) }} hari</p>
            </div>
        </div>

        <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary btn-sm btn-squared" href="{{ route('laporan.harian', ['periode' => $periode->id]) }}">Laporan harian</a>
            <a class="btn btn-outline-primary color-primary btn-sm btn-squared" href="{{ route('rhpp', ['periode' => $periode->id]) }}">RHPP</a>
            <a class="btn btn-outline-primary color-primary btn-sm btn-squared" href="{{ route('panen.rekap', ['periode' => $periode->id]) }}">Panen</a>
            <a class="btn btn-outline-primary color-primary btn-sm btn-squared" href="{{ route('payroll.pemanen', ['periode' => $periode->id]) }}">Payroll pemanen</a>
            <a class="btn btn-outline-primary color-primary btn-sm btn-squared" href="{{ route('pakan.log', ['periode' => $periode->id]) }}">Pakan dan stok</a>
        </div>
    </div>
</div>
