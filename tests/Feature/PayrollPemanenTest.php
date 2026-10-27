<?php

namespace Tests\Feature;

use App\Enums\Jabatan;
use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\PayrollPemanen;
use App\Models\Aktivitas;
use App\Models\Karyawan;
use App\Models\NotaPanen;
use App\Models\Pemanen;
use App\Models\PembayaranPemanen;
use App\Models\Periode;
use App\Support\LembarPayrollPemanen;
use App\Support\Notifikasi;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class PayrollPemanenTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_harvester_is_paid_for_the_full_weight_of_each_note_that_lists_them(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 40]);
        $this->buatNota($periode, 'BT001', '2000.00', "Rizal, David\nRizal");
        $this->buatNota($periode, 'BT002', '500.00', 'rizal');

        $this->get(route('payroll.pemanen', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Payroll pemanen')
            ->assertSee(route('payroll.pemanen'), false)
            ->assertSee('Rincian upah pemanen')
            ->assertSee('Pembagian tonase upah');

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Rizal')
            ->assertSee('David')
            ->assertSee('2.500,00 kg')
            ->assertSee('2.000,00 kg')
            ->assertSee('Rp 50.000')
            ->assertSee('Rp 80.000')
            ->assertSee('Rp 130.000');
    }

    public function test_note_weight_is_allocated_by_each_harvesters_starting_crate(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 40]);
        $nota = $this->buatNota($periode, 'BT003', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1],
            ['nama' => 'David', 'krat_mulai' => 4],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('30,00 kg')
            ->assertSee('70,00 kg')
            ->assertSee('Rp 600')
            ->assertSee('Rp 2.800')
            ->assertSee('Rp 3.400');
    }

    public function test_krat_before_the_first_harvesters_start_remain_unallocated(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT004', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->create([
            'nama' => 'Rizal',
            'krat_mulai' => 3,
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('80,00 kg')
            ->assertSee('Rp 1.600')
            ->assertDontSee('Rp 2.000');

        $this->assertSame(
            ['Berat panen belum teralokasi'],
            array_column(Notifikasi::untukPeriode($periode), 'judul'),
        );
    }

    public function test_manual_harvester_weights_are_used_and_the_remaining_note_weight_is_split_by_crates(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'Budi', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT005', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1, 'berat_timbang_kg' => 20],
            ['nama' => 'David', 'krat_mulai' => 4],
            ['nama' => 'Budi', 'krat_mulai' => 8],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('20,00 kg')
            ->assertSee('45,71 kg')
            ->assertSee('34,29 kg')
            ->assertSee('Rp 400')
            ->assertSee('Rp 914')
            ->assertSee('Rp 686')
            ->assertSee('Rp 2.000');
    }

    public function test_all_entered_harvester_weights_override_the_crate_proportions(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 20]);
        $nota = $this->buatNota($periode, 'BT006', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1, 'berat_timbang_kg' => 25.25],
            ['nama' => 'David', 'krat_mulai' => 4, 'berat_timbang_kg' => 74.75],
        ]);

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('25,25 kg')
            ->assertSee('74,75 kg')
            ->assertSee('Rp 505')
            ->assertSee('Rp 1.495')
            ->assertSee('Rp 2.000');
    }

    public function test_unregistered_and_unassigned_harvest_weight_is_reported_not_paid(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $this->buatNota($periode, 'BT001', '12.03', 'Rizal, Pemanen Asing');
        $this->buatNota($periode, 'BT002', '10.00', '');

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Rp 241')
            ->assertDontSee('Rp 480')
            ->assertDontSee('Pemanen Asing');

        $notifikasi = Notifikasi::untukPeriode($periode);
        $this->assertSame(['Pemanen Pemanen Asing belum terdaftar', 'Berat panen belum teralokasi'], array_column($notifikasi, 'judul'));
        $this->assertStringStartsWith('12,03 kg panen belum masuk payroll pemanen', $notifikasi[0]['isi']);
        $this->assertStringStartsWith('10,00 kg belum punya nama pemanen', $notifikasi[1]['isi']);
        $this->assertSame(route('master-data', ['periode' => $periode->id]).'#pemanen', $notifikasi[0]['tautan']);

        // Notifikasi tampil di lonceng header halaman mana pun, bukan sebagai peringatan tetap di halaman payroll.
        $this->get(route('dashboard', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Pemanen Pemanen Asing belum terdaftar')
            ->assertSee('10,00 kg belum punya nama pemanen');
    }

    public function test_abk_who_join_the_harvest_are_not_paid_or_reported_as_unregistered(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'Rifi ABK', 'upah_per_kg' => 20]);
        Karyawan::create(['nama' => 'Frengky', 'jabatan' => Jabatan::Abk]);
        $this->buatNota($periode, 'BT001', '100.00', 'Rizal, Rifi ABK, ABK K2, frengky');
        $nota = $this->buatNota($periode, 'BT002', '100.00', '');
        $nota->update(['jumlah_krat' => 10]);
        $nota->pemanenKrat()->createMany([
            ['nama' => 'Rizal', 'krat_mulai' => 1],
            ['nama' => 'ABK', 'krat_mulai' => 6],
        ]);

        $lembar = LembarPayrollPemanen::buat($periode);

        $this->assertSame(['Rizal'], array_column($lembar['pemanen'], 'nama'));
        $this->assertSame(3_000, $lembar['total_upah']);
        $this->assertSame([], $lembar['nama_belum_terdaftar']);
        $this->assertSame(
            [['nama' => 'ABK', 'berat_kg' => 50], ['nama' => 'ABK K2', 'berat_kg' => 100], ['nama' => 'frengky', 'berat_kg' => 100], ['nama' => 'Rifi ABK', 'berat_kg' => 100]],
            $lembar['abk'],
        );
        $this->assertEquals(0, $lembar['berat_tanpa_nama']);
        $this->assertSame([], Notifikasi::untukPeriode($periode));
        $this->assertFalse(LembarPayrollPemanen::abk('Kabkab'));

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Dipanen ABK')
            ->assertSee('ABK yang ikut memanen');
    }

    public function test_notification_bell_says_when_nothing_needs_attention(): void
    {
        $periode = $this->buatPeriode();
        Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $this->buatNota($periode, 'BT001', '12.03', 'Rizal');

        $this->assertSame([], Notifikasi::untukPeriode($periode));
        $this->get(route('payroll.pemanen', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Tidak ada yang perlu ditindaklanjuti');
    }

    public function test_payroll_page_explains_when_the_selected_period_has_no_harvest(): void
    {
        $periode = $this->buatPeriode();

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Belum ada panen di periode ini');
    }

    public function test_wages_can_be_marked_paid_and_back_to_unpaid(): void
    {
        $periode = $this->buatPeriode();
        $periode->update(['status' => 'berjalan']);
        $rizal = Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        Pemanen::create(['nama' => 'David', 'upah_per_kg' => 40]);
        $this->buatNota($periode, 'BT001', '2000.00', 'Rizal, David');

        $halaman = Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->assertSee('Belum dibayar')
            ->call('tandaiDibayar', $rizal->id)
            ->assertSet('pesan', 'Upah Rizal Rp 40.000 ditandai sudah dibayar.')
            ->assertSee('Sudah dibayar')
            ->assertSee('Rp 40.000 sudah dibayar, Rp 80.000 belum')
            ->assertSee('1 dari 2 dibayar');

        $this->assertDatabaseHas('pembayaran_pemanens', ['periode_id' => $periode->id, 'pemanen_id' => $rizal->id, 'nama' => 'Rizal', 'jumlah' => 40_000]);

        // Menandai dua kali tidak membuat catatan ganda.
        $halaman->call('tandaiDibayar', $rizal->id);
        $this->assertSame(1, PembayaranPemanen::count());

        $halaman->call('mintaBatalBayar', $rizal->id)
            ->assertSet('namaBatalBayar', 'Rizal (Rp 40.000)')
            ->call('batalBayar')
            ->assertSet('pesan', 'Upah Rizal dikembalikan menjadi belum dibayar.');

        $this->assertSame(0, PembayaranPemanen::count());
        $this->assertSame(
            [JenisAktivitas::Tambah, JenisAktivitas::Hapus],
            Aktivitas::where('modul', ModulAktivitas::PayrollPemanen)->orderBy('id')->pluck('jenis')->all(),
        );
    }

    public function test_a_paid_wage_that_changes_later_is_flagged(): void
    {
        $periode = $this->buatPeriode();
        $periode->update(['status' => 'berjalan']);
        $rizal = Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $this->buatNota($periode, 'BT001', '2000.00', 'Rizal');

        $halaman = Livewire::test(PayrollPemanen::class)->set('periodeId', $periode->id)->call('tandaiDibayar', $rizal->id);
        $this->buatNota($periode, 'BT002', '500.00', 'Rizal');

        $halaman->call('$refresh')->assertSee('Dibayar Rp 40.000; upah sekarang berubah');
    }

    public function test_payment_status_of_a_closed_period_cannot_change(): void
    {
        $periode = $this->buatPeriode();
        $rizal = Pemanen::create(['nama' => 'Rizal', 'upah_per_kg' => 20]);
        $this->buatNota($periode, 'BT001', '2000.00', 'Rizal');

        Livewire::test(PayrollPemanen::class)
            ->set('periodeId', $periode->id)
            ->call('tandaiDibayar', $rizal->id)
            ->assertForbidden();

        $this->assertSame(0, PembayaranPemanen::count());
    }

    private function buatPeriode(): Periode
    {
        return Periode::create([
            'nama' => 'Periode Uji Payroll',
            'strain' => 'Ross',
            'tanggal_chick_in' => '2026-10-01',
            'berat_doc_gram' => 40,
            'status' => 'tutup_rhpp',
        ]);
    }

    private function buatNota(Periode $periode, string $noBtpa, string $beratKg, string $tukangTangkap): NotaPanen
    {
        return NotaPanen::factory()
            ->for($periode)
            ->create([
                'no_btpa' => $noBtpa,
                'tukang_tangkap' => $tukangTangkap,
                'berat_kg' => $beratKg,
                'netto_nota_kg' => $beratKg,
            ]);
    }
}
