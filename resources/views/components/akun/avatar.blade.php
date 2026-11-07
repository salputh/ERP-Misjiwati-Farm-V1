@props(['akun', 'status' => null])

{{-- Avatar inisial akun dengan titik status di pojok bawah. --}}
<div class="position-relative flex-shrink-0 me-3">
    <span class="rounded-circle lingkar-38 d-flex align-items-center justify-content-center bg-primary-subtle text-primary fw-medium" aria-hidden="true">{{ $akun->inisial() }}</span>
    @if ($status?->kelasTitik())
        <span class="position-absolute bottom-0 end-0 rounded-circle border border-2 border-body lingkar-titik {{ $status->kelasTitik() }}" title="{{ $status->label() }}"></span>
    @endif
</div>
