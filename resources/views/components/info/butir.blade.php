@props(['label'])

{{-- Satu butir identitas: label text-body-secondary small dan nilai  fw-medium text-body . --}}
<div {{ $attributes }}>
    <span class="d-block text-body-secondary small">{{ $label }}</span>
    <p class="fw-medium text-body mb-0">{{ $slot }}</p>
</div>
