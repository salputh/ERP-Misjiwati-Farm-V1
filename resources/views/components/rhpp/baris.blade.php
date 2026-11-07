@props(['label', 'angka', 'desimal' => 0, 'akhiran' => '', 'satuan' => null, 'sorot' => false, 'tebal' => false, 'masukan' => false, 'menjorok' => false, 'kurung' => false])

{{-- Satu baris rincian (RHPP, kas operasional): label, angka, lalu satuan atau keterangan. Angka ungu (masukan) adalah input manual.
     Dengan kurung, nilai negatif ditulis dalam kurung dan berwarna merah. --}}
<tr @class(['bg-primary-subtle' => $sorot])>
    <td @class(['fw-semibold' => $tebal || $sorot, 'ps-4' => $menjorok])>{{ $label }}</td>
    <td @class(['text-end', 'fw-semibold' => $tebal || $sorot, 'recording-masukan' => $masukan, 'text-danger' => $kurung && $angka < 0])>
        @if ($kurung)
            @kurung($angka, (int) $desimal){{ $akhiran }}
        @else
            @angka($angka, (int) $desimal){{ $akhiran }}
        @endif
    </td>
    <td class="small text-body-secondary">{{ $satuan }}</td>
</tr>
