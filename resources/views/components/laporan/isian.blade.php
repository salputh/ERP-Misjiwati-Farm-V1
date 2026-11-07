@props(['label', 'model', 'langkah' => '1'])

{{-- Isian angka form laporan harian bergaya form template. Model adalah nama properti Livewire, sekaligus kunci pesan galatnya. --}}
<div class="mb-3 mb-4">
    <label for="{{ $model }}" class="form-label fw-medium mb-2">{{ $label }}</label>
    <input
        type="number"
        inputmode="decimal"
        min="0"
        step="{{ $langkah }}"
        id="{{ $model }}"
        wire:model="{{ $model }}"
        @class(['form-control     px-3', 'is-invalid' => $errors->has($model)])
        @error($model) aria-invalid="true" aria-describedby="{{ $model }}-galat" @enderror
    >
    @error($model)
        <div class="invalid-feedback d-block" id="{{ $model }}-galat">{{ $message }}</div>
    @enderror
</div>
