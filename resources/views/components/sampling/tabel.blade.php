@props(['lantai', 'kelamin', 'kelompok', 'bacaSaja' => false])

{{-- Tabel satu lantai untuk satu kelamin: dua sampel per line, total line, lalu ringkasan kelompok. Dengan bacaSaja sampel tampil sebagai angka, bukan isian. --}}
<table class="table table-bordered tabel-sampling mb-0">
    <thead>
        <tr>
            <th>Line</th>
            <th>Sampel 1 (gram)</th>
            <th>Sampel 2 (gram)</th>
            <th>Total line (gram)</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($kelompok['baris'] as $line => $baris)
            <tr wire:key="sampel-{{ $lantai }}-{{ $kelamin }}-{{ $line }}">
                <th scope="row">{{ $line }}</th>
                @foreach ($baris['sampel'] as $urutan => $nilai)
                    <td>
                        @if ($bacaSaja)
                            <span class="nilai-sampel">@angka($nilai)</span>
                        @else
                            <label class="visually-hidden" for="berat-{{ $lantai }}-{{ $kelamin }}-{{ $line }}-{{ $urutan }}">Line {{ $line }} sampel {{ $urutan }}</label>
                            <input
                                id="berat-{{ $lantai }}-{{ $kelamin }}-{{ $line }}-{{ $urutan }}"
                                type="text"
                                inputmode="numeric"
                                autocomplete="off"
                                x-data="isianRibuan('berat.{{ $lantai }}.{{ $kelamin }}.{{ $line }}.{{ $urutan }}')"
                                x-on:input="format"
                                x-on:blur="kirim"
                                @class(['form-control form-control-sm input-sampel', 'is-invalid' => $errors->has("berat.{$lantai}.{$kelamin}.{$line}.{$urutan}")])
                            >
                        @endif
                    </td>
                @endforeach
                <td class="fw-600">@angka($baris['total'])</td>
            </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <th colspan="3">Subtotal (gram)</th>
            <td class="fw-600">@angka($kelompok['subtotal'])</td>
        </tr>
        <tr>
            <th colspan="3">ABW per ekor (gram)</th>
            <td class="fw-600">@angka($kelompok['abw'])</td>
        </tr>
        <tr>
            <th colspan="3">DG aktual</th>
            <td>@angka($kelompok['dg'])</td>
        </tr>
        <tr>
            <th colspan="3">DG standar</th>
            <td>@angka($kelompok['dg_standar'])</td>
        </tr>
        <tr>
            <th colspan="3">Selisih DG</th>
            <td @class(['color-danger' => $kelompok['selisih_dg'] < 0, 'color-success' => $kelompok['selisih_dg'] > 0])>
                @isset($kelompok['selisih_dg'])
                    @kurung($kelompok['selisih_dg'])
                @else
                    -
                @endisset
            </td>
        </tr>
    </tfoot>
</table>
