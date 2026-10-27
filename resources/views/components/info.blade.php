{{-- Deretan identitas lembar (label kecil di atas nilai), seperti tanggal mulai dan selesai pada kartu Project template.
     Slot berisi <x-info.butir>. --}}
<div {{ $attributes->class(['d-flex flex-wrap gap-4']) }}>
    {{ $slot }}
</div>
