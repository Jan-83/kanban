<?php

namespace App\Http\Controllers;

use App\Services\CrmAutomations;
use App\Services\CrmRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CrmController extends Controller
{
    public function __construct(private CrmRecords $records, private CrmAutomations $automations) {}

    public function index(Request $request, string $board): JsonResponse
    {
        return response()->json($this->records->bootstrap($board, $request->user()));
    }

    public function show(Request $request, string $board, string $record): JsonResponse
    {
        return response()->json($this->records->details($board, $record, $request->user()));
    }

    public function store(Request $request, string $board): JsonResponse
    {
        return $this->persist($request, $board);
    }

    public function update(Request $request, string $board, string $record): JsonResponse
    {
        return $this->persist($request, $board, $record);
    }

    private function persist(Request $request, string $board, ?string $record = null): JsonResponse
    {
        $this->records->membership($board, $request->user());
        $result = DB::transaction(function () use ($request, $board, $record): array {
            DB::table('boards')->where('id', $board)->lockForUpdate()->firstOrFail();
            $previous = $record ? $this->records->data($this->records->accessible($board, $record, $request->user())) : [];
            $saved = $this->records->save($board, $request->user(), $request->all(), $record);
            $this->automations->changed($board, $saved, $previous);

            return $saved;
        });

        return response()->json($result, $record ? 200 : 201);
    }

    public function destroy(Request $request, string $board, string $record): JsonResponse
    {
        $input = $request->validate(['revision' => ['required', 'integer:strict', 'min:1']]);
        $this->records->archive($board, $record, $request->user(), $input['revision']);

        return response()->json(['archived' => true]);
    }

    public function settings(Request $request, string $board): JsonResponse
    {
        $input = $request->validate(['revision' => ['required', 'integer:strict', 'min:0'], 'data' => ['required', 'array']]);

        return response()->json($this->records->saveSettings($board, $request->user(), $input['data'], $input['revision']));
    }

    public function version(Request $request, string $board, string $record): JsonResponse
    {
        $input = $request->validate(['revision' => ['required', 'integer:strict', 'min:1']]);

        return response()->json($this->records->version($board, $record, $request->user(), $input['revision']), 201);
    }

    public function task(Request $request, string $board, string $record): JsonResponse
    {
        $input = $request->validate(['revision' => ['required', 'integer:strict', 'min:1'], 'taskId' => ['present', 'nullable', 'string', 'regex:/^[a-zA-Z0-9_-]{1,120}$/D']]);

        return response()->json($this->records->linkTask($board, $record, $request->user(), $input['revision'], $input['taskId']));
    }

    public function notifications(Request $request, string $board): JsonResponse
    {
        $this->records->membership($board, $request->user());
        $input = $request->validate(['ids' => ['required', 'array', 'max:100'], 'ids.*' => ['required', 'uuid']]);
        DB::table('crm_notifications')->where('board_id', $board)->where('user_id', $request->user()->id)->whereIn('id', $input['ids'])->update(['read_at' => now()]);

        return response()->json(['read' => true]);
    }
}
