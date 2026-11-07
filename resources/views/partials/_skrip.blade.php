{{-- Urutan skrip Basalt: Bootstrap, tampilan (mode terang/gelap), menu, komponen bersama, lalu pemilih tampilan. Livewire memuat Alpine sendiri. --}}
<script src="{{ asset('assets/vendor/bootstrap/js/bootstrap.bundle.min.js') }}"></script>
<script src="{{ asset('assets/vendor/chart.js/chart.umd.min.js') }}"></script>
<script src="{{ asset('assets/basalt/js/appearance.js') }}"></script>
<script src="{{ asset('assets/basalt/js/menu.js') }}"></script>
<script src="{{ asset('assets/basalt/js/basalt.js') }}"></script>
<script src="{{ asset('assets/basalt/js/components/datepicker.js') }}"></script>
<script src="{{ asset('assets/basalt/js/theme-picker.js') }}"></script>
@livewireScripts
