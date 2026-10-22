<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Nota Panen - {{ $periode->nama }}</title>
    <style>
        @page {
            size: A3 landscape;
            margin: 8mm;
        }

        body {
            color: #0a0a0a;
            font-family: DejaVu Sans, sans-serif;
            font-size: 6pt;
        }

        h1 {
            color: #8231d3;
            font-size: 14pt;
            margin: 0 0 4px;
        }

        .info {
            border-collapse: collapse;
            font-size: 7pt;
            margin-bottom: 8px;
            width: 100%;
        }

        .info td {
            padding: 2px 8px 2px 0;
        }

        .info strong {
            color: #747474;
            font-weight: normal;
        }

        .panen {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }

        .panen th,
        .panen td {
            border: 0.5px solid #b8bdc9;
            overflow-wrap: break-word;
            padding: 3px 2px;
            text-align: right;
            vertical-align: middle;
        }

        .panen thead th {
            background: #f3edf9;
            color: #282336;
            text-align: center;
        }

        .panen thead th:first-child,
        .panen tbody td:first-child {
            text-align: left;
        }

        .panen .hari th {
            background: #f7f2fc;
            color: #8231d3;
            font-size: 7pt;
            text-align: left;
        }

        .panen .subtotal td {
            background: #fafafa;
            font-weight: bold;
        }

        .panen .subtotal td:first-child,
        .panen tfoot th:first-child {
            text-align: left;
        }

        .panen tfoot th {
            background: #e8f6ea;
            font-weight: bold;
        }

        .panen .teks-kiri {
            text-align: left;
        }

        .rincian {
            color: #747474;
            display: block;
            font-size: 5.5pt;
            margin-top: 2px;
        }

        tr {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <h1>Nota Timbang Panen</h1>

    <table class="info">
        <tr>
            <td><strong>Inti</strong> PT. Indojaya Agrinusa</td>
            <td><strong>Farm</strong> Misjiwati / K0242</td>
            <td><strong>Periode</strong> {{ $periode->nama }}</td>
            <td><strong>Ruang lingkup</strong> {{ $hari ? 'Hari '.$hari['nomor'] : 'Semua hari panen' }}</td>
            <td><strong>Jumlah nota</strong> @angka($hari ? $hari['subtotal']['jumlah_nota'] : $total['jumlah_nota'])</td>
        </tr>
    </table>

    <table class="panen">
        <thead>
            <tr>
                <th>No.</th>
                <th>No. BTPA / SPA</th>
                <th>Pembeli / no. polisi</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Krat</th>
                <th>Ekor</th>
                <th>Berat (kg)</th>
                <th>BW (kg)</th>
                <th>Kg / krat</th>
                <th>Netto (kg)</th>
                <th>Selisih</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($daftarHari as $sesi)
                <tr class="hari">
                    <th colspan="12">
                        Hari {{ $sesi['nomor'] }}:
                        {{ $sesi['dari']->translatedFormat('j F') }} s/d {{ $sesi['sampai']->translatedFormat('j F Y') }}
                    </th>
                </tr>
                @foreach ($sesi['nota'] as $nota)
                    <tr>
                        <td>{{ $loop->iteration }}</td>
                        <td class="teks-kiri">
                            {{ $nota['no_btpa'] }}
                            <span class="rincian">SPA {{ $nota['no_spa'] ?? '-' }}</span>
                        </td>
                        <td class="teks-kiri">
                            {{ $nota['pembeli'] }}
                            <span class="rincian">{{ $nota['no_polisi'] }}</span>
                            @if ($nota['pemanen_krat'] !== [])
                                @foreach ($nota['pemanen_krat'] as $pemanen)
                                    <span class="rincian">
                                        Tukang Tangkap: {{ $pemanen['nama'] }} (mulai krat {{ $pemanen['krat_mulai'] }})
                                        @if ($pemanen['berat_timbang_kg'] !== null)
                                            — @angka($pemanen['berat_timbang_kg'], 2) kg
                                        @endif
                                    </span>
                                @endforeach
                            @elseif ($nota['tukang_tangkap'])
                                <span class="rincian">Tukang Tangkap: {{ $nota['tukang_tangkap'] }}</span>
                            @endif
                        </td>
                        <td>{{ $nota['mulai']->translatedFormat('j M H:i') }}</td>
                        <td>{{ $nota['selesai']->translatedFormat('j M H:i') }}</td>
                        <x-panen.angka :jumlah="$nota" />
                    </tr>
                @endforeach
                <tr class="subtotal">
                    <td colspan="5">Subtotal hari {{ $sesi['nomor'] }}</td>
                    <x-panen.angka :jumlah="$sesi['subtotal']" />
                </tr>
            @endforeach
        </tbody>
        @unless ($hari)
            <tfoot>
                <tr>
                    <th colspan="5">Total seluruh panen</th>
                    <x-panen.angka :jumlah="$total" sel="th" />
                </tr>
            </tfoot>
        @endunless
    </table>
</body>
</html>
