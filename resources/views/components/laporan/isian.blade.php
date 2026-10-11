@props(['label', 'model', 'langkah' => '1'])

{{-- Isian angka form laporan harian bergaya form template. Model adalah nama properti Livewire, sekaligus kunci pesan galatnya. --}}
<div class="form-group mb-20">
    <label for="{{ $model }}" class="il-gray fs-14 fw-500 align-center mb-10">{{ $label }}</label>
    <input
        type="number"
        inputmode="decimal"
        min="0"
        step="{{ $langkah }}"
        id="{{ $model }}"
        wire:model="{{ $model }}"
        @class(['form-control ih-medium ip-light radius-xs b-light px-15', 'is-invalid' => $errors->has($model)])
        @error($model) aria-invalid="true" aria-describedby="{{ $model }}-galat" @enderror
    >
    @error($model)
        <div class="invalid-feedback d-block" id="{{ $model }}-galat">{{ $message }}</div>
    @enderror
</div>
