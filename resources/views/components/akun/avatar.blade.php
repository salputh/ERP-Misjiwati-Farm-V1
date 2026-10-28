@props(['akun', 'status' => null])

{{-- Avatar inisial akun dengan titik status di pojok bawah (HexaDash: chat, avatar + badge-direction-bottom). --}}
<div class="position-relative flex-shrink-0 me-15">
    <span class="rounded-circle wh-38 d-flex align-items-center justify-content-center bg-opacity-primary color-primary fw-500 fs-14" aria-hidden="true">{{ $akun->inisial() }}</span>
    @if ($status?->kelasTitik())
        <span class="badge-direction-bottom">
            <span class="chat-badge-dot {{ $status->kelasTitik() }}" title="{{ $status->label() }}"></span>
        </span>
    @endif
</div>
