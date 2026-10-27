@props(['label'])

{{-- Satu butir identitas: label color-light fs-12 dan nilai fs-14 fw-500 color-dark (HexaDash: Project, media-ui__start). --}}
<div {{ $attributes }}>
    <span class="d-block color-light fs-12">{{ $label }}</span>
    <p class="fs-14 fw-500 color-dark mb-0">{{ $slot }}</p>
</div>
