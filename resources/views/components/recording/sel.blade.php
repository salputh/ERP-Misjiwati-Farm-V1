@props(['nilai' => null, 'desimal' => 0, 'akhiran' => '', 'masukan' => false])

{{-- Satu sel angka lembar recording. Kosong bila belum ada nilai; negatif ditulis dalam kurung dan berwarna merah. --}}
<td {{ $attributes->class(['recording-masukan' => $masukan, 'color-danger' => $nilai < 0]) }}>@isset($nilai)@kurung($nilai, $desimal){{ $akhiran }}@endisset</td>
