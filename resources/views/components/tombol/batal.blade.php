{{-- Tombol batal di kaki modal, persis tombol Cancel pada modal konfirmasi template (btn-light  btn-sm). --}}
<button type="button" {{ $attributes->class(['btn btn-light  btn-sm']) }} data-bs-dismiss="modal">{{ $slot->isEmpty() ? 'Batal' : $slot }}</button>
