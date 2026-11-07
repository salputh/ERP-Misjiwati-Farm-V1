{{-- Paginasi Livewire bergaya Bootstrap/Basalt (ul.pagination). --}}
@if ($paginator->hasPages())
    <nav aria-label="Navigasi halaman">
        <ul class="pagination pagination-sm mb-0">
            <li @class(['page-item', 'disabled' => $paginator->onFirstPage()])>
                @if ($paginator->onFirstPage())
                    <span class="page-link" aria-disabled="true" aria-label="Halaman sebelumnya"><i class="bi bi-chevron-left" aria-hidden="true"></i></span>
                @else
                    <a href="#" class="page-link" wire:click.prevent="previousPage('{{ $paginator->getPageName() }}')" aria-label="Halaman sebelumnya"><i class="bi bi-chevron-left" aria-hidden="true"></i></a>
                @endif
            </li>

            @foreach ($elements as $element)
                @if (is_string($element))
                    <li class="page-item disabled"><span class="page-link">{{ $element }}</span></li>
                @endif

                @if (is_array($element))
                    @foreach ($element as $halaman => $url)
                        <li @class(['page-item', 'active' => $halaman === $paginator->currentPage()]) wire:key="halaman-{{ $paginator->getPageName() }}-{{ $halaman }}">
                            <a href="#" class="page-link" wire:click.prevent="gotoPage({{ $halaman }}, '{{ $paginator->getPageName() }}')" @if ($halaman === $paginator->currentPage()) aria-current="page" @endif>{{ $halaman }}</a>
                        </li>
                    @endforeach
                @endif
            @endforeach

            <li @class(['page-item', 'disabled' => ! $paginator->hasMorePages()])>
                @if ($paginator->hasMorePages())
                    <a href="#" class="page-link" wire:click.prevent="nextPage('{{ $paginator->getPageName() }}')" aria-label="Halaman berikutnya"><i class="bi bi-chevron-right" aria-hidden="true"></i></a>
                @else
                    <span class="page-link" aria-disabled="true" aria-label="Halaman berikutnya"><i class="bi bi-chevron-right" aria-hidden="true"></i></span>
                @endif
            </li>
        </ul>
    </nav>
@endif
