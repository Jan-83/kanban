<?php

namespace App\Http\Controllers;

use App\Services\CrmFiles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CrmFileController extends Controller
{
    public function store(Request $request, string $board, string $record, CrmFiles $files): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'max:5120']]);

        return response()->json($files->store($board, $record, $request->user(), $request->file('file')), 201);
    }

    public function show(Request $request, string $board, string $file, CrmFiles $files): StreamedResponse
    {
        [$row, $bytes] = $files->read($board, $file, $request->user());

        return response()->streamDownload(function () use ($bytes): void {
            echo $bytes;
        }, Crypt::decryptString($row->name),
            ['Content-Type' => $row->mime, 'Content-Length' => strlen($bytes), 'X-Content-Type-Options' => 'nosniff']);
    }

    public function destroy(Request $request, string $board, string $file, CrmFiles $files): JsonResponse
    {
        $files->archive($board, $file, $request->user());

        return response()->json(['archived' => true]);
    }
}
