@props(['properti', 'label' => null, 'keterangan' => null, 'kesalahan' => null, 'langsung' => false, 'desimal' => 0, 'teks' => false])

{{-- Isian angka yang menampilkan titik pemisah ribuan selagi diketik (Alpine isianRibuan di app.js), bergaya x-masukan.
     Properti Livewire menerima angka mentahnya saat isian ditinggalkan atau Enter ditekan, supaya ikut terkirim bersama form.
     "langsung": angka juga dikirim saat berhenti mengetik, untuk hitungan yang tampil di form (mis. total penjualan).
     "desimal": jumlah digit desimal yang boleh diketik dengan koma (1.530,25); 0 untuk angka bulat.
     "teks": kirim sebagai teks ('' bila kosong) untuk properti Livewire bertipe string, supaya mengosongkan isian
     tidak membuat properti itu kehilangan nilainya. --}}
<x-masukan
    tipe="text"
    :inputmode="$desimal > 0 ? 'decimal' : 'numeric'"
    autocomplete="off"
    :label="$label"
    :keterangan="$keterangan"
    :kesalahan="$kesalahan"
    x-data="isianRibuan('{{ $properti }}', '.', false, { desimal: {{ (int) $desimal }}, teks: {{ $teks ? 'true' : 'false' }} })"
    x-on:input="format"
    x-on:blur="kirim(true)"
    x-on:keydown.enter="kirim(true)"
    {{ $attributes->merge($langsung ? ['x-on:input.debounce.500ms' => 'kirim()'] : []) }}
/>
