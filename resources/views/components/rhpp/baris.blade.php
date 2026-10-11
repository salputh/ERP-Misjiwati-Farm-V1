@props(['label', 'angka', 'desimal' => 0, 'akhiran' => '', 'satuan' => null, 'sorot' => false, 'tebal' => false, 'masukan' => false, 'menjorok' => false, 'kurung' => false])

{{-- Satu baris rincian (RHPP, kas operasional): label, angka, lalu satuan atau keterangan. Angka ungu (masukan) adalah input manual.
     Dengan kurung, nilai negatif ditulis dalam kurung dan berwarna merah. --}}
<tr @class(['baris-sorot' => $sorot])>
    <td @class(['fw-600' => $tebal || $sorot, 'ps-4' => $menjorok])>{{ $label }}</td>
    <td @class(['text-end', 'fw-600' => $tebal || $sorot, 'recording-masukan' => $masukan, 'color-danger' => $kurung && $angka < 0])>
        @if ($kurung)
            @kurung($angka, (int) $desimal){{ $akhiran }}
        @else
            @angka($angka, (int) $desimal){{ $akhiran }}
        @endif
    </td>
    <td class="fs-12 color-gray text-start">{{ $satuan }}</td>
</tr>
