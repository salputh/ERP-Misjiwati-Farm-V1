<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#6d3fe0">
    <title>{{ $title ?? 'Ringkasan' }} | Misjiwati Farm</title>

    {{-- Template Basalt: Bootstrap 5.3, Bootstrap Icons, lalu gaya bersama Basalt. Semua aset lokal di public/assets. --}}
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/bootstrap.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/vendor/bootstrap-icons/bootstrap-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/basalt.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/components/datepicker.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/components/empty-states.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/basalt/css/pages/multipurpose/index.css') }}">
    @stack('gaya-halaman')
    <link rel="icon" type="image/svg+xml" href="{{ asset('assets/basalt/icons/basalt-mark.svg') }}">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
