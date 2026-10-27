@props(['id', 'premi' => null])

{{-- Premi pemeliharaan ABK tidak diketik: diambil dari tabel Premi ABK di Master data menurut total budidaya per ekor populasi.
     $premi adalah bagian premi_abk dari LembarBagiHasil; null bila lembar belum dapat dihitung. --}}
<x-masukan
    :id="$id"
    label="Premi pemeliharaan ABK (Rp)"
    readonly
    value="{{ $premi ? \App\Support\Format::angka($premi['premi']) : '—' }}" />
<span class="fs-12 color-light d-block mt-5">
    @if (! $premi)
        Otomatis dari tabel premi ABK setelah hasil budidaya dapat dihitung.
    @elseif ($premi['batas'] === null)
        Total budidaya Rp @angka($premi['hasil_per_ekor']) per ekor, di bawah batas terendah tabel premi ABK.
    @else
        Total budidaya Rp @angka($premi['hasil_per_ekor']) per ekor ≥ Rp @angka($premi['batas']) (intensif @angka($premi['intensif'])).
    @endif
    Sumber: <a href="{{ route('master-data') }}#premi-abk">Master data, Premi ABK</a>
</span>
