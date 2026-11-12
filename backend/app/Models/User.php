<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, HasUuids, Notifiable;

    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token', 'mfa_secret', 'recovery_hashes'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'active' => 'boolean', 'mfa_confirmed_at' => 'datetime',
            'mfa_secret' => 'encrypted', 'recovery_hashes' => 'encrypted:array', 'mfa_last_step' => 'integer',
            'auth_version' => 'integer'];
    }
}
