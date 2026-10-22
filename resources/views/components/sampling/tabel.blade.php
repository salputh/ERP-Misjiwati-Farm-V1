@props(['lantai', 'kelamin', 'kelompok', 'bacaSaja' => false])

{{-- Tabel satu lantai untuk satu kelamin: dua sampel per line, jumlah ekor tiap titik, total line, lalu ringkasan kelompok.
     Dengan bacaSaja sampel tampil sebagai angka, bukan isian. --}}
<table class="table table-bordered tabel-sampling mb-0">
    <thead>
        <tr>
            <th>Line</th>
            <th>Sampel 1 (gram)</th>
            <th>Ekor</th>
            <th>Sampel 2 (gram)</th>
            <th>Ekor</th>
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
                    <td>
                        @if ($bacaSaja)
                            <span class="nilai-ekor">@angka($baris['ekor_titik'][$urutan] ?? null)</span>
                        @else
                            <label class="visually-hidden" for="ekor-{{ $lantai }}-{{ $kelamin }}-{{ $line }}-{{ $urutan }}">Ekor line {{ $line }} sampel {{ $urutan }}</label>
                            <input
                                id="ekor-{{ $lantai }}-{{ $kelamin }}-{{ $line }}-{{ $urutan }}"
                                type="number"
                                min="1"
                                step="1"
                                autocomplete="off"
                                class="form-control form-control-sm input-ekor-titik @error("ekorTitik.{$lantai}.{$kelamin}.{$line}.{$urutan}") is-invalid @enderror"
                                wire:model.blur="ekorTitik.{{ $lantai }}.{{ $kelamin }}.{{ $line }}.{{ $urutan }}"
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
            <th colspan="5">Subtotal (gram)</th>
            <td class="fw-600">@angka($kelompok['subtotal'])</td>
        </tr>
        <tr>
            <th colspan="5">Total ekor tersampel</th>
            <td class="fw-600">@angka($kelompok['ekor'])</td>
        </tr>
        <tr>
            <th colspan="5">ABW per ekor (gram)</th>
            <td class="fw-600">@angka($kelompok['abw'])</td>
        </tr>
        <tr>
            <th colspan="5">DG aktual</th>
            <td>@angka($kelompok['dg'])</td>
        </tr>
        <tr>
            <th colspan="5">DG per hari</th>
            <td>
                @angka($kelompok['dg_per_hari'])
                @if ($kelompok['hari'] > 1)
                    <span class="d-block fs-12 color-gray">jarak {{ $kelompok['hari'] }} hari</span>
                @endif
            </td>
        </tr>
        <tr>
            <th colspan="5">DG standar</th>
            <td>@angka($kelompok['dg_standar'])</td>
        </tr>
        <tr>
            <th colspan="5">Selisih DG</th>
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
