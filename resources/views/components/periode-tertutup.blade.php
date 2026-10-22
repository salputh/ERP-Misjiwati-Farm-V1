@if ($periode?->tertutup())
    <div class="col-12 mb-25">
        <div class="alert alert-info mb-0" role="status">
            Periode ini sudah tutup RHPP. Data dapat dilihat, tetapi tidak dapat diubah.
        </div>
    </div>
@endif
