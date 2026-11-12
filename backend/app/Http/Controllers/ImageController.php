<?php

namespace App\Http\Controllers;

use App\Services\PrivateImages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ImageController extends Controller
{
    public function store(Request $request, string $board, PrivateImages $images): JsonResponse
    {
        abort_unless(Gate::allows('board-access', $board), 404);
        $input = $request->validate(['taskId' => ['required', 'string', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D'],
            'file' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']]);
        $file = $request->file('file');
        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$file->getMimeType()] ?? null;
        abort_unless($extension, 422);
        $path = $board.'/'.$input['taskId'].'/'.Str::uuid().'.'.$extension;

        return response()->json($images->store($board, $path, $file->getClientOriginalName(), $file->getContent()), 201);
    }

    public function copy(Request $request, string $board, PrivateImages $images): JsonResponse
    {
        abort_unless(Gate::allows('board-access', $board), 404);
        $input = $request->validate(['source' => ['required', 'string', 'max:400'], 'target' => ['required', 'string', 'max:400'],
            'name' => ['required', 'string', 'max:200']]);
        [$record, $bytes] = $images->read($board, $input['source']);

        return response()->json($images->store($board, $input['target'], $input['name'], $bytes), 201);
    }

    public function show(Request $request, string $board, PrivateImages $images): Response
    {
        abort_unless(Gate::allows('board-access', $board), 404);
        $input = $request->validate(['path' => ['required', 'string', 'max:400']]);
        [$record, $bytes] = $images->read($board, $input['path']);

        return response($bytes, 200, ['Content-Type' => $record->mime,
            'Content-Disposition' => 'inline; filename="image.'.pathinfo($record->path, PATHINFO_EXTENSION).'"',
            'Content-Length' => strlen($bytes)]);
    }
}
