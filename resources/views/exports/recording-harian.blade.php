<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Recording harian - {{ $periodeKandang->kandang->nama }}</title>
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

        .recording {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }

        .recording th,
        .recording td {
            border: 0.5px solid #b8bdc9;
            overflow-wrap: break-word;
            padding: 2px 1px;
            text-align: right;
            vertical-align: middle;
        }

        .recording th {
            background: #f3edf9;
            color: #282336;
            font-size: 5.2pt;
            text-align: center;
        }

        .recording th:first-child,
        .recording td:first-child {
            text-align: left;
        }

        .recording .minggu td {
            background: #f7f2fc;
            color: #8231d3;
            font-weight: bold;
            text-align: left;
        }

        tr {
            page-break-inside: avoid;
        }

        .catatan {
            color: #747474;
            font-size: 6pt;
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <h1>Recording Harian Pemeliharaan Ayam Broiler</h1>

    <table class="info">
        <tr>
            <td><strong>Peternak</strong> Misjiwati</td>
            <td><strong>Periode</strong> {{ $periodeKandang->periode->nama }}</td>
            <td><strong>Kandang</strong> {{ $periodeKandang->kandang->nama }}</td>
            <td><strong>Populasi</strong> {{ \App\Support\Format::angka($periodeKandang->populasi_awal) }} ekor</td>
            <td><strong>Tanggal chick-in</strong> {{ $periodeKandang->periode->tanggal_chick_in->translatedFormat('j F Y') }}</td>
            <td><strong>Berat DOC</strong> {{ \App\Support\Format::angka($periodeKandang->periode->berat_doc_gram) }} g</td>
        </tr>
    </table>

    <table class="recording">
        <thead>
            <tr>
                @foreach ($kolom as $kolomLembar)
                    <th>{{ $kolomLembar['heading'] }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @foreach ($baris as $hari)
                <tr>
                    @foreach ($kolom as $kolomLembar)
                        <td>
                            @if (isset($kolomLembar['date']))
                                {{ $hari[$kolomLembar['key']]->translatedFormat('j F') }}
                            @else
                                {{ \App\Support\Format::kurung($hari[$kolomLembar['key']] ?? null, $kolomLembar['decimals']) }}{{ $kolomLembar['suffix'] }}
                            @endif
                        </td>
                    @endforeach
                </tr>

                @if ($hari['umur'] % 7 === 0)
                    <tr class="minggu">
                        <td colspan="{{ count($kolom) }}">Minggu {{ \App\Support\Format::romawi(intdiv($hari['umur'], 7)) }}</td>
                    </tr>
                @endif
            @endforeach
        </tbody>
    </table>

    <p class="catatan">
        Angka dalam kurung berarti negatif. Konversi kg pakan memakai berat per zak pada master tiap jenis pakan.
    </p>
</body>
</html>
