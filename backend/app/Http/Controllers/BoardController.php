<?php

namespace App\Http\Controllers;

use App\Services\BoardDocuments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BoardController extends Controller
{
    public function show(string $board, string $kind, BoardDocuments $documents): JsonResponse
    {
        abort_unless(Gate::allows('board-access', $board), 404);

        return response()->json($documents->load($board, $kind));
    }

    public function update(Request $request, string $board, string $kind, BoardDocuments $documents): JsonResponse
    {
        abort_unless(Gate::allows('board-access', $board), 404);
        $input = $request->validate(['revision' => ['required', 'integer', 'min:0', 'max:9007199254740990'], 'data' => ['required', 'array']]);

        return response()->json($documents->save($board, $kind, $input['data'], (int) $input['revision']));
    }
}
