{{-- Tautan halaman Livewire bergaya pagination template (HexaDash: dm-pagination__link), dipakai lewat paginationView().
     Isinya hanya tautan; pembungkus nav.dm-page dan pilihan jumlah per halaman ada di halaman pemakainya. --}}
@if ($paginator->hasPages())
    @if ($paginator->onFirstPage())
        <span class="dm-pagination__link pagination-control color-lighten" aria-disabled="true" aria-label="Halaman sebelumnya"><span class="la la-angle-left"></span></span>
    @else
        <a href="#" class="dm-pagination__link pagination-control" wire:click.prevent="previousPage('{{ $paginator->getPageName() }}')" aria-label="Halaman sebelumnya"><span class="la la-angle-left"></span></a>
    @endif

    @foreach ($elements as $element)
        @if (is_string($element))
            <span class="dm-pagination__link pagination-control"><span class="page-number">{{ $element }}</span></span>
        @endif

        @if (is_array($element))
            @foreach ($element as $halaman => $url)
                <a
                    href="#"
                    @class(['dm-pagination__link', 'active' => $halaman === $paginator->currentPage()])
                    wire:click.prevent="gotoPage({{ $halaman }}, '{{ $paginator->getPageName() }}')"
                    wire:key="halaman-{{ $paginator->getPageName() }}-{{ $halaman }}"
                    @if ($halaman === $paginator->currentPage()) aria-current="page" @endif
                ><span class="page-number">{{ $halaman }}</span></a>
            @endforeach
        @endif
    @endforeach

    @if ($paginator->hasMorePages())
        <a href="#" class="dm-pagination__link pagination-control" wire:click.prevent="nextPage('{{ $paginator->getPageName() }}')" aria-label="Halaman berikutnya"><span class="la la-angle-right"></span></a>
    @else
        <span class="dm-pagination__link pagination-control color-lighten" aria-disabled="true" aria-label="Halaman berikutnya"><span class="la la-angle-right"></span></span>
    @endif
@endif
