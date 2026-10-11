@props(['kelamin'])

{{-- Label kelamin sampel memakai tag berwarna template; slot menggantikan teks bawaan. --}}
<p class="mb-10">
    <span @class(['dm-tag tag-transparented m-0', 'tag-warning' => $kelamin === 'jantan', 'tag-info' => $kelamin === 'betina', 'tag-success' => $kelamin === 'gabungan'])>{{ $slot->isEmpty() ? ucfirst($kelamin) : $slot }}</span>
</p>
