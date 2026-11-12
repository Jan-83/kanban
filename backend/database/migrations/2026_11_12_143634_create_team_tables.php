<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->text('name');
            $table->timestamps();
        });
        Schema::create('memberships', function (Blueprint $table): void {
            $table->foreignUuid('board_id')->constrained('boards');
            $table->foreignUuid('user_id')->constrained('users');
            $table->string('display_name', 120);
            $table->string('role', 16);
            $table->primary(['board_id', 'user_id']);
            $table->index('user_id');
        });
        Schema::create('documents', function (Blueprint $table): void {
            $table->foreignUuid('board_id')->constrained('boards');
            $table->string('kind', 16);
            $table->unsignedBigInteger('revision');
            $table->longText('ciphertext');
            $table->timestamp('updated_at');
            $table->primary(['board_id', 'kind']);
        });
        Schema::create('document_versions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('board_id');
            $table->string('kind', 16);
            $table->unsignedBigInteger('revision');
            $table->longText('ciphertext');
            $table->timestamp('created_at');
            $table->unique(['board_id', 'kind', 'revision']);
        });
        Schema::create('private_images', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->foreignUuid('board_id')->constrained('boards');
            $table->string('path', 400);
            $table->text('name');
            $table->string('mime', 32);
            $table->unsignedInteger('bytes');
            $table->string('sha256', 64);
            $table->timestamp('created_at');
        });
        Schema::create('audit_events', function (Blueprint $table): void {
            $table->id();
            $table->string('event', 64);
            $table->uuid('user_id')->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->timestamp('created_at')->index();
        });
    }

    public function down(): void
    {
        foreach (['audit_events', 'private_images', 'document_versions', 'documents', 'memberships', 'boards'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
