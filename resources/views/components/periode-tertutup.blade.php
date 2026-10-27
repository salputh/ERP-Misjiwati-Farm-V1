@if ($periode?->tertutup())
    <div class="col-12">
        <x-peringatan warna="info" class="mb-25">Periode ini sudah tutup RHPP. Data dapat dilihat, tetapi tidak dapat diubah.</x-peringatan>
    </div>
@endif
