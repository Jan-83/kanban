<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crm_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained('boards');
            $table->string('kind', 24);
            $table->uuid('parent_id')->nullable();
            $table->foreignUuid('owner_id')->constrained('users');
            $table->string('visibility', 16)->default('team');
            $table->text('access_ids');
            $table->unsignedInteger('revision')->default(1);
            $table->longText('ciphertext');
            $table->foreignUuid('created_by')->constrained('users');
            $table->foreignUuid('updated_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['board_id', 'deleted_at', 'kind']);
            $table->index('parent_id');
        });
        Schema::create('crm_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('record_id')->constrained('crm_records');
            $table->unsignedInteger('revision');
            $table->longText('ciphertext');
            $table->foreignUuid('actor_id')->constrained('users');
            $table->timestamp('created_at');
            $table->unique(['record_id', 'revision']);
        });
        Schema::create('crm_settings', function (Blueprint $table): void {
            $table->foreignUuid('board_id')->primary()->constrained('boards');
            $table->unsignedInteger('revision')->default(1);
            $table->longText('ciphertext');
            $table->timestamp('updated_at');
        });
        Schema::create('crm_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained('boards');
            $table->foreignUuid('record_id')->constrained('crm_records');
            $table->text('name');
            $table->string('mime', 120);
            $table->unsignedInteger('bytes');
            $table->char('sha256', 64);
            $table->foreignUuid('created_by')->constrained('users');
            $table->timestamp('created_at');
            $table->softDeletes();
        });
        Schema::create('crm_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('board_id')->constrained('boards');
            $table->foreignUuid('record_id')->constrained('crm_records');
            $table->foreignUuid('user_id')->constrained('users');
            $table->text('ciphertext');
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at');
            $table->index(['user_id', 'read_at']);
        });
        Schema::create('crm_automation_runs', function (Blueprint $table): void {
            $table->char('id', 64)->primary();
            $table->foreignUuid('board_id')->constrained('boards');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['crm_automation_runs', 'crm_notifications', 'crm_files', 'crm_settings', 'crm_versions', 'crm_records'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
