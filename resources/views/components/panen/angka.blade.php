@props(['jumlah', 'sel' => 'td'])

{{-- Tujuh kolom angka satu baris rekap panen: nota, subtotal hari, atau total. --}}
<{{ $sel }} class="text-end">@angka($jumlah['krat'])</{{ $sel }}>
<{{ $sel }} class="text-end">@angka($jumlah['ekor'])</{{ $sel }}>
<{{ $sel }} class="text-end">@angka($jumlah['berat'], 2)</{{ $sel }}>
<{{ $sel }} class="text-end">@angka($jumlah['bw'], 2)</{{ $sel }}>
<{{ $sel }} class="text-end">@angka($jumlah['per_krat'], 2)</{{ $sel }}>
<{{ $sel }} class="text-end">@angka($jumlah['netto'], 2)</{{ $sel }}>
<{{ $sel }} @class(['text-end', 'color-danger' => $jumlah['selisih'] != 0])>@angka($jumlah['selisih'], 2)</{{ $sel }}>
