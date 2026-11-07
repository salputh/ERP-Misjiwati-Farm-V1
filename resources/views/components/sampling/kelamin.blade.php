@props(['kelamin'])

{{-- Label kelamin sampel memakai tag berwarna template; slot menggantikan teks bawaan. --}}
<p class="mb-2">
    <span @class(['badge  m-0', 'bg-warning-subtle text-warning' => $kelamin === 'jantan', 'bg-info-subtle text-info' => $kelamin === 'betina', 'bg-success-subtle text-success' => $kelamin === 'gabungan'])>{{ $slot->isEmpty() ? ucfirst($kelamin) : $slot }}</span>
</p>
