<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Seluruh halaman aplikasi wajib masuk, jadi test berjalan sebagai pengguna yang sudah masuk.
     * Test autentikasi memanggil keluarkanPengguna() untuk menguji keadaan tamu.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::factory()->make());
    }

    protected function keluarkanPengguna(): void
    {
        $this->app['auth']->guard()->forgetUser();
    }
}
