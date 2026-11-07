<?php

namespace App\Http\Controllers;

use App\Support\ImporSampelKandangSuite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Pintu masuk sampling bobot dari Kandang Suite. Hanya isian mentah yang diterima; hitungannya dilakukan ERP.
 */
class IntegrasiSampelController extends Controller
{
    public function simpan(Request $request, ImporSampelKandangSuite $impor): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'idEksternal' => ['required', 'string', 'max:64'],
            'kandang' => ['required', 'string', 'max:100'],
            'tanggal' => ['required', 'date_format:Y-m-d'],
            'jenis' => ['required', 'in:campuran,sexing'],
            'titik' => ['required', 'array', 'min:1', 'max:500'],
            'titik.*.lantai' => ['required', 'string', 'max:20'],
            'titik.*.kelamin' => ['required', 'in:campuran,jantan,betina'],
            'titik.*.line' => ['required', 'string', 'max:4'],
            'titik.*.urutan' => ['required', 'integer', 'min:1', 'max:10'],
            'titik.*.beratGram' => ['required', 'integer', 'min:1', 'max:1000000'],
            'titik.*.ekor' => ['required', 'integer', 'min:1', 'max:500'],
        ], [
            'titik.*.beratGram.integer' => 'Berat harus bilangan bulat (gram).',
            'titik.*.beratGram.min' => 'Berat harus lebih dari 0.',
            'titik.*.ekor.min' => 'Ekor harus lebih dari 0.',
            'titik.*.ekor.max' => 'Ekor paling banyak 500.',
        ]);

        if ($validator->fails()) {
            return response()->json(['pesan' => 'Data tidak valid.', 'rincian' => array_slice($validator->errors()->all(), 0, 20)], 422);
        }

        $hasil = $impor->simpan($validator->validated());

        return response()->json($hasil['isi'], $hasil['status']);
    }
}
