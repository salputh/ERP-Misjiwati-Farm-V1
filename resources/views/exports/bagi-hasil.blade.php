<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Bagi Hasil {{ $kandang->nama }} - {{ $periode->nama }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 2.5cm;
        }

        body {
            color: #0a0a0a;
            font-family: DejaVu Sans, sans-serif;
            font-size: 6pt;
            line-height: 1.35;
        }

        h1 {
            color: #8231d3;
            font-size: 12pt;
            line-height: 1.4;
            margin: 0 0 2px;
        }

        .sub {
            color: #747474;
            font-size: 7pt;
            line-height: 1.45;
            margin: 0 0 7px;
        }

        .info {
            border-collapse: collapse;
            font-size: 7pt;
            line-height: 1.4;
            margin-bottom: 8px;
            width: 100%;
        }

        .info td {
            padding: 2px 10px 2px 0;
        }

        .info strong {
            color: #747474;
            font-weight: normal;
        }

        .lembar {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }

        .lembar th.judul-tabel {
            background: #f3edf9;
            color: #282336;
            font-size: 7.5pt;
            font-weight: bold;
            line-height: 1.35;
            padding: 3px 5px;
            text-align: left;
        }

        .lembar th,
        .lembar td {
            border-bottom: 0.5px solid #e3e6ef;
            line-height: 1.35;
            padding: 2.5px 5px;
            vertical-align: top;
        }

        .lembar th {
            color: #747474;
            font-size: 6.5pt;
            font-weight: normal;
            text-align: left;
        }

        .lembar td.angka {
            text-align: right;
            white-space: nowrap;
        }

        .lembar td.keterangan {
            color: #747474;
            font-size: 6.5pt;
        }

        .lembar tr.tebal td {
            font-weight: bold;
        }

        .lembar tr.sorot td {
            background: #fafafa;
            font-weight: bold;
        }

        .lembar tr.negatif td.angka {
            color: #ff0f0f;
        }

        .jumlah {
            border-collapse: collapse;
            font-size: 7.5pt;
            line-height: 1.35;
            margin-top: 8px;
            page-break-inside: avoid;
            width: 100%;
        }

        .jumlah td {
            border: 0.5px solid #b8bdc9;
            line-height: 1.35;
            padding: 3px 5px;
        }

        .jumlah td.angka {
            text-align: right;
            white-space: nowrap;
        }

        .jumlah .total {
            background: #f7f2fc;
            font-weight: bold;
        }

        .kaki {
            color: #747474;
            font-size: 6.5pt;
            line-height: 1.45;
            margin-top: 8px;
        }

        /* Tabel pemodal dan ABK selalu mulai di halaman kedua agar tidak terpotong. */
        .halaman-kedua {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <h1>Bagi Hasil {{ $kandang->nama }}</h1>
    <p class="sub">Misjiwati Farm / K0242 · {{ $periode->nama }} · Periode siklus {{ $periode->nomor_siklus ?? '-' }} · Inti {{ $periode->inti }}</p>

    <table class="info">
        <tr>
            <td><strong>Kandang</strong> {{ $kandang->nama }}</td>
            <td><strong>Controller</strong> {{ $lembar['identitas']['controller'] ?: '-' }}</td>
            <td><strong>Populasi</strong> @angka($lembar['identitas']['populasi']) ekor</td>
            <td><strong>Kg terjual</strong> @angka($lembar['identitas']['kg'], 2) kg</td>
            <td><strong>Chick-in</strong> {{ $periode->tanggal_chick_in->translatedFormat('j M Y') }}</td>
        </tr>
    </table>

    @foreach ([
        ['judul' => 'Pendapatan', 'baris' => $lembar['pendapatan']],
        ['judul' => 'Pengeluaran', 'baris' => $lembar['pengeluaran']],
        ['judul' => 'Sisa diperoleh', 'baris' => $lembar['sisa']],
    ] as $bagian)
        <table class="lembar">
            <thead>
                <tr>
                    <th class="judul-tabel" colspan="3">{{ $bagian['judul'] }}</th>
                </tr>
                <tr>
                    <th style="width: 38%">Uraian</th>
                    <th style="width: 18%">Jumlah</th>
                    <th>Keterangan</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($bagian['baris'] as $baris)
                    <tr @class(['tebal' => $baris['tebal'], 'sorot' => $baris['sorot'], 'negatif' => $baris['jumlah'] < 0])>
                        <td>{{ $baris['label'] }}</td>
                        <td class="angka">@angka($baris['jumlah'])</td>
                        <td class="keterangan">{{ $baris['rumus'] }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endforeach

    <table class="jumlah">
        <tr>
            <td style="width: 46%">Pendapatan bersih</td>
            <td class="angka" style="width: 27%">@angka($lembar['ringkasan']['pendapatan'])</td>
            <td style="width: 27%"></td>
        </tr>
        <tr>
            <td>Total operasional pemeliharaan</td>
            <td class="angka">@angka($lembar['ringkasan']['pengeluaran'])</td>
            <td></td>
        </tr>
        <tr>
            <td>Entertain</td>
            <td class="angka">@angka($lembar['ringkasan']['entertain'])</td>
            <td></td>
        </tr>
        <tr>
            <td>Zakat penghasilan</td>
            <td class="angka">@angka($lembar['ringkasan']['zakat'])</td>
            <td></td>
        </tr>
        <tr class="total">
            <td>Sisa akhir untuk pemodal</td>
            <td class="angka">@angka($lembar['ringkasan']['sisa_akhir'])</td>
            <td></td>
        </tr>
    </table>

    <div class="halaman-kedua">
        <table class="lembar">
            <thead>
                <tr>
                    <th class="judul-tabel" colspan="3">Pembagian pemodal</th>
                </tr>
                <tr>
                    <th style="width: 50%; text-align: left;">Pemodal</th>
                    <th style="width: 20%; text-align: right;">Porsi</th>
                    <th style="width: 30%; text-align: right;">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($lembar['pemodal']['penerima'] as $penerima)
                    <tr>
                        <td>{{ $penerima['nama'] }}</td>
                        <td class="angka">{{ number_format($penerima['persen'], 3, ',', '.') }}%</td>
                        <td class="angka">@angka($penerima['jumlah'])</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <table class="lembar" style="margin-top: 10px">
            <thead>
                <tr>
                    <th class="judul-tabel" colspan="4">Pembagian ABK</th>
                </tr>
                <tr>
                    <th style="width: 30%; text-align: left;">ABK</th>
                    <th style="width: 20%; text-align: right;">Premi tetap</th>
                    <th style="width: 20%; text-align: right;">Rata</th>
                    <th style="width: 30%; text-align: right;">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($lembar['abk']['penerima'] as $abk)
                    <tr>
                        <td>{{ $abk['nama'] }}@if ($abk['keterangan'])<br><span class="keterangan">{{ $abk['keterangan'] }}</span>@endif</td>
                        <td class="angka">@angka($abk['premi_tetap'])</td>
                        <td class="angka">@angka($abk['rata'])</td>
                        <td class="angka">@angka($abk['jumlah'])</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <p class="kaki">
            Biaya operasional @angka($lembar['operasional']['nilai'])
            @if ($lembar['operasional']['dari_kas'])
                diambil otomatis dari total biaya operasional di buku kas, tidak termasuk pinjaman makan dan pinjaman karyawan.
            @else
                memakai nilai terakhir yang tersimpan karena buku kas belum diisi.
            @endif
            Pendapatan diambil dari RHPP real periode {{ $periode->nama }}.<br>
            Dicetak {{ now()->translatedFormat('j F Y H:i') }} WIB.
        </p>
    </div>
</body>
</html>
