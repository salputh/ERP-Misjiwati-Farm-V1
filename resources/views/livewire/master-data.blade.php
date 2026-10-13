<div>
    <div class="container-fluid">
        <div class="row">
            <x-breadcrumb judul="Master data" :jejak="['Master data']" />

            <livewire:master-jenis-pakan wire:key="master-jenis-pakan" />
            <livewire:master-harga-kontrak wire:key="master-harga-kontrak" />
            <livewire:master-pemodal wire:key="master-pemodal" />
            <livewire:master-pemanen wire:key="master-pemanen" />
        </div>
    </div>
</div>
