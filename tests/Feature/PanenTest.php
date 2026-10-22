<?php

namespace Tests\Feature;

use App\Enums\JenisAktivitas;
use App\Enums\ModulAktivitas;
use App\Livewire\Panen as HalamanPanen;
use App\Models\NotaPanen;
use App\Models\Periode;
use App\Support\RekapPanen;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PanenSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\TestCase;

class PanenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    /**
     * Angka dari lembar "Rekapitulasi Panen Gabungan — Semua Kandang (K1 + K2)".
     */
    public function test_daily_subtotals_and_grand_total_match_the_original_sheet(): void
    {
        $rekap = $this->rekap('Periode Juli 2026');

        $this->assertCount(6, $rekap['hari']);
        $this->assertSame([4, 3, 10, 15, 14, 7], array_column(array_column($rekap['hari'], 'subtotal'), 'jumlah_nota'));
        $this->assertSame([239, 249, 665, 1027, 953, 454], array_column(array_column($rekap['hari'], 'subtotal'), 'krat'));
        $this->assertSame([4418, 3292, 8781, 12605, 10062, 4920], array_column(array_column($rekap['hari'], 'subtotal'), 'ekor'));
        $this->assertSame([6071.3, 5097.3, 14900.0, 23198.4, 20025.0, 10529.2], array_column(array_column($rekap['hari'], 'subtotal'), 'berat'));

        $hariEmpat = $rekap['hari'][3];
        $this->assertSame(['2026-08-14 19:39', '2026-08-15 08:39'], [$hariEmpat['dari']->format('Y-m-d H:i'), $hariEmpat['sampai']->format('Y-m-d H:i')]);
        $this->assertSame('1,84', number_format($hariEmpat['subtotal']['bw'], 2, ','));
        $this->assertSame('22,59', number_format($hariEmpat['subtotal']['per_krat'], 2, ','));

        $total = $rekap['total'];
        $this->assertSame([53, 3587, 44078, 79821.2, 79821.2, 0.0], [$total['jumlah_nota'], $total['krat'], $total['ekor'], $total['berat'], $total['netto'], $total['selisih']]);
        $this->assertSame('1,81', number_format($total['bw'], 2, ','));
        $this->assertSame('22,25', number_format($total['per_krat'], 2, ','));
    }

    public function test_each_note_carries_its_own_averages(): void
    {
        $nota = $this->rekap('Periode Juli 2026')['hari'][0]['nota'];

        // Diurutkan menurut jam mulai timbang: BTPA 15881 (21:59) sebelum 15882 (23:09).
        $this->assertSame(['15881', '15882', '15883', '15884'], array_column($nota, 'no_btpa'));
        $this->assertSame(['CHIKO MAJU BERSAMA. CV', 'BM 8742 RH', 61, 1147, 1598.6], [$nota[0]['pembeli'], $nota[0]['no_polisi'], $nota[0]['krat'], $nota[0]['ekor'], $nota[0]['berat']]);
        $this->assertSame('1,39', number_format($nota[0]['bw'], 2, ','));
        $this->assertSame('26,21', number_format($nota[0]['per_krat'], 2, ','));
    }

    /**
     * Angka dari tabel "Perhitungan FCR & IP" di lembar yang sama.
     */
    public function test_fcr_and_ip_match_the_original_sheet(): void
    {
        $rekap = $this->rekap('Periode Juli 2026');
        $performa = $rekap['performa'];

        $this->assertSame([2238.0, true, 111900.0], [$performa['pakan_zak'], $performa['pakan_manual'], $performa['pakan_kg']]);
        $this->assertSame([45000, 1025, true], [$performa['doc'], $performa['deplesi'], $performa['deplesi_manual']]);
        $this->assertSame('1,811', number_format($rekap['total']['bw'], 3, ','));
        $this->assertSame('1,402', number_format($performa['fcr'], 3, ','));
        $this->assertSame('2,3', number_format($performa['deplesi_persen'], 1, ','));
        $this->assertSame('30,1', number_format($performa['umur_rata'], 1, ','));
        $this->assertSame('97,95', number_format($performa['hidup_terpanen'], 2, ','));
        $this->assertSame('97,7', number_format($performa['hidup_deplesi'], 1, ','));
        $this->assertSame([421, 420], [(int) round($performa['ip_terpanen']), (int) round($performa['ip_hidup'])]);
    }

    public function test_harvest_age_is_grouped_by_weighing_date(): void
    {
        $umur = $this->rekap('Periode Juli 2026')['umur'];

        $this->assertSame([24, 25, 28, 29, 30, 31, 32, 33], array_column($umur, 'umur'));
        $this->assertSame([2669, 1749, 734, 6251, 10242, 11385, 8222, 2826], array_column($umur, 'ekor'));
        $this->assertSame('2026-08-08', $umur[0]['tanggal']->format('Y-m-d'));
    }

    public function test_feed_and_depletion_fall_back_to_recordings_without_manual_figures(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $periode->update(['rekap_pakan_zak' => null, 'rekap_deplesi_ekor' => null]);

        $performa = $this->rekap('Periode Juli 2026')['performa'];

        // Jumlah pakan dan kematian umur 1 sampai 24 dari lembar "Data Record Kandang 1" dan "Kandang 2".
        $this->assertSame([1540.0, false], [$performa['pakan_zak'], $performa['pakan_manual']]);
        $this->assertSame([770, false], [$performa['deplesi'], $performa['deplesi_manual']]);
    }

    public function test_seeding_the_harvest_twice_does_not_duplicate_notes(): void
    {
        $this->seed(PanenSeeder::class);

        $this->assertSame(53, NotaPanen::count());
    }

    public function test_page_shows_the_recap_for_a_harvested_period(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('panen.rekap', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Rekapitulasi panen gabungan')
            ->assertSee('Masa panen')
            ->assertSee('CHIKO MAJU BERSAMA. CV')
            ->assertSee('Tambah data panen')
            ->assertSeeHtml('data-bs-target="#modal-form-nota-panen"')
            ->assertSeeHtml('id="modal-form-nota-panen"')
            ->assertSee('BM 8591 DT')
            ->assertSee('SPA 1890115910')
            ->assertSee('Subtotal hari 6')
            ->assertSee('79.821,20')
            ->assertSee('1,402')
            ->assertSee('421');
    }

    public function test_page_offers_exports_for_all_harvest_days_and_each_day(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('panen.rekap', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Salin gambar semua')
            ->assertSee('Export PDF')
            ->assertSee('Semua hari panen')
            ->assertSee('Hari 1')
            ->assertSee(route('panen.export', ['periode' => $periode->id]))
            ->assertSee(route('panen.export', ['periode' => $periode->id, 'hari' => 1]));
    }

    public function test_pdf_export_downloads_all_days_or_one_day(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        foreach ([null, 1] as $hari) {
            $parameter = ['periode' => $periode->id];
            $namaRuangLingkup = 'semua';
            if ($hari !== null) {
                $parameter['hari'] = $hari;
                $namaRuangLingkup = 'hari-'.$hari;
            }

            $response = $this->get(route('panen.export', $parameter));

            $response->assertOk()->assertDownload(Str::slug("nota-panen-{$periode->nama}-{$namaRuangLingkup}").'.pdf');
            $this->assertStringStartsWith('%PDF-', $response->getContent());
        }
    }

    public function test_pdf_export_rejects_a_day_without_harvest_notes(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        $this->get(route('panen.export', ['periode' => $periode->id, 'hari' => 99]))
            ->assertNotFound();
    }

    public function test_page_explains_when_a_period_has_no_harvest_yet(): void
    {
        $periode = Periode::where('nama', 'Periode September 2026')->firstOrFail();

        $this->assertNull($this->rekap('Periode September 2026'));
        $this->get(route('panen.rekap', ['periode' => $periode->id]))
            ->assertOk()
            ->assertSee('Belum ada panen')
            ->assertDontSee('Masa panen');
    }

    public function test_harvest_notes_can_be_created_updated_and_deleted_from_the_page(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $nota = NotaPanen::where('periode_id', $periode->id)->firstOrFail();
        $komponen = Livewire::test(HalamanPanen::class)->set('periodeId', $periode->id);

        $komponen->set('tanggalPanen', '2026-08-17')
            ->set('noSpa', '1890119999')
            ->set('noBtpa', '18001')
            ->set('noPolisi', 'BM 1234 AA')
            ->set('pembeli', 'Pembeli Baru')
            ->set('tukangTangkap', 'Budi, Andi, Caca')
            ->set('mulai', '2026-08-17T20:00')
            ->set('selesai', '2026-08-17T20:30')
            ->set('jumlahKrat', '50')
            ->set('detailPemanen', [
                hash('sha256', 'andi') => ['kratMulai' => '21', 'beratTimbang' => '300.25'],
                hash('sha256', 'caca') => ['kratMulai' => '41', 'beratTimbang' => ''],
            ])
            ->set('ekor', '650')
            ->set('beratKg', '1100.50')
            ->set('nettoNotaKg', '1098.50')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertDispatched('nota-panen-disimpan')
            ->assertSee('Nota panen 18001 ditambahkan.')
            ->assertSee('18001');

        $baru = NotaPanen::where('periode_id', $periode->id)->where('no_btpa', '18001')->firstOrFail();
        $komponen->assertSeeHtml('wire:key="nota-panen-'.$baru->id.'"');
        $this->assertSame('2026-08-17', $baru->tanggal_panen->toDateString());
        $this->assertSame('Budi, Andi, Caca', $baru->tukang_tangkap);
        $this->assertDatabaseHas('nota_panen_pemanens', [
            'nota_panen_id' => $baru->id,
            'nama' => 'Andi',
            'krat_mulai' => 21,
            'berat_timbang_kg' => 300.25,
        ]);
        $komponen->assertSee('Tukang Tangkap: Budi (mulai krat 1)')
            ->assertSee('Tukang Tangkap: Andi (mulai krat 21)')
            ->assertSee('300,25 kg')
            ->assertSee('Tukang Tangkap: Caca (mulai krat 41)');
        $this->assertDatabaseHas('aktivitas', [
            'jenis' => JenisAktivitas::Tambah->value,
            'modul' => ModulAktivitas::Panen->value,
            'subjek' => 'Nota panen 18001',
        ]);

        $komponen->call('ubah', $nota->id)
            ->assertSet('notaId', $nota->id)
            ->assertSet('noBtpa', $nota->no_btpa)
            ->set('tukangTangkap', 'Dedi, Eko')
            ->set('detailPemanen.'.hash('sha256', 'eko'), ['kratMulai' => '2', 'beratTimbang' => ''])
            ->set('noBtpa', '18002')
            ->set('beratKg', '1111.25')
            ->call('simpan')
            ->assertHasNoErrors()
            ->assertDispatched('nota-panen-disimpan')
            ->assertSee('Nota panen 18002 diperbarui.')
            ->assertSee('18002');

        $this->assertDatabaseHas('nota_panens', [
            'id' => $nota->id,
            'no_btpa' => '18002',
            'berat_kg' => 1111.25,
            'tukang_tangkap' => 'Dedi, Eko',
        ]);
        $this->assertDatabaseHas('nota_panen_pemanens', [
            'nota_panen_id' => $nota->id,
            'nama' => 'Eko',
            'krat_mulai' => 2,
        ]);
        $this->assertDatabaseHas('aktivitas', [
            'jenis' => JenisAktivitas::Ubah->value,
            'modul' => ModulAktivitas::Panen->value,
            'subjek' => 'Nota panen 18002',
        ]);

        $komponen->call('mintaHapus', $baru->id)
            ->assertSet('noBtpaDihapus', '18001')
            ->call('hapus')
            ->assertSet('notaHapusId', null)
            ->assertSee('Nota panen 18001 dihapus.')
            ->assertDontSeeHtml('wire:key="nota-panen-'.$baru->id.'"');

        $this->assertDatabaseMissing('nota_panens', ['id' => $baru->id]);
        $this->assertDatabaseHas('aktivitas', [
            'jenis' => JenisAktivitas::Hapus->value,
            'modul' => ModulAktivitas::Panen->value,
            'subjek' => 'Nota panen 18001',
        ]);
    }

    public function test_harvest_note_validation_prevents_duplicate_numbers_and_invalid_times(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $nota = NotaPanen::where('periode_id', $periode->id)->firstOrFail();

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->call('ubah', $nota->id)
            ->set('noBtpa', NotaPanen::where('periode_id', $periode->id)->where('id', '!=', $nota->id)->value('no_btpa'))
            ->set('mulai', '2026-08-17T20:30')
            ->set('selesai', '2026-08-17T20:00')
            ->call('simpan')
            ->assertHasErrors(['noBtpa', 'selesai']);

        $this->assertDatabaseHas('nota_panens', ['id' => $nota->id, 'no_btpa' => $nota->no_btpa]);
    }

    public function test_multiple_harvesters_can_start_at_the_same_crate_and_start_must_be_within_note(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $nota = NotaPanen::where('periode_id', $periode->id)->firstOrFail();

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->call('ubah', $nota->id)
            ->set('tukangTangkap', 'Rizal, David')
            ->set('detailPemanen.'.hash('sha256', 'david'), ['kratMulai' => '', 'beratTimbang' => '20'])
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('nota_panen_pemanens', [
            'nota_panen_id' => $nota->id,
            'nama' => 'Rizal',
            'krat_mulai' => 1,
        ]);

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->call('ubah', $nota->id)
            ->set('tukangTangkap', 'Rizal')
            ->set('detailPemanen.'.hash('sha256', 'rizal'), [
                'kratMulai' => (string) ($nota->jumlah_krat + 1),
                'beratTimbang' => '',
            ])
            ->call('simpan')
            ->assertHasErrors(['detailPemanen.'.hash('sha256', 'rizal').'.kratMulai']);

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->call('ubah', $nota->id)
            ->set('tukangTangkap', 'Rizal')
            ->set('detailPemanen.'.hash('sha256', 'rizal'), [
                'kratMulai' => '',
                'beratTimbang' => (string) ((float) $nota->berat_kg + 1),
            ])
            ->call('simpan')
            ->assertHasErrors(['detailPemanen']);
    }

    public function test_names_stay_in_the_main_field_with_optional_per_harvester_details(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->set('tukangTangkap', 'Rizal, David')
            ->assertSee('Tukang Tangkap')
            ->assertSee('Detail pemanen')
            ->assertSee('Rizal')
            ->assertSee('David')
            ->assertSee('Krat mulai (default 1)')
            ->assertSee('Berat timbang (kg, opsional)');
    }

    public function test_legacy_harvester_names_remain_editable_without_crate_allocations(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();
        $nota = NotaPanen::factory()
            ->for($periode)
            ->create(['tukang_tangkap' => 'Budi, Andi']);

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->call('ubah', $nota->id)
            ->assertSet('tukangTangkap', 'Budi, Andi')
            ->set('tukangTangkap', 'Budi, Caca')
            ->call('simpan')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('nota_panens', [
            'id' => $nota->id,
            'tukang_tangkap' => 'Budi, Caca',
        ]);
    }

    public function test_harvest_note_actions_cannot_access_a_note_from_another_period(): void
    {
        $nota = NotaPanen::firstOrFail();
        $periodeLain = Periode::where('id', '!=', $nota->periode_id)->firstOrFail();

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periodeLain->id)
            ->call('ubah', $nota->id)
            ->assertStatus(404);
    }

    public function test_harvest_note_page_has_loading_indicators_for_database_actions(): void
    {
        $periode = Periode::where('nama', 'Periode Juli 2026')->firstOrFail();

        Livewire::test(HalamanPanen::class)
            ->set('periodeId', $periode->id)
            ->assertSeeHtml('wire:target="ubah, simpan, mintaHapus, hapus"')
            ->assertSeeHtml('wire:click.prevent="ubah(')
            ->assertSeeHtml('wire:click.prevent="mintaHapus(');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function rekap(string $namaPeriode): ?array
    {
        $periode = Periode::where('nama', $namaPeriode)
            ->with(['notaPanen', 'kandangPeriode.recordings', 'kandangPeriode.pemberianPakan'])
            ->firstOrFail();

        return RekapPanen::buat($periode);
    }
}
