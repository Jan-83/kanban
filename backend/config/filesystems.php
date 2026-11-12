<?php

return [
    'default' => 'local',
    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => env('TEAM_PRIVATE_STORAGE', storage_path('app/private')),
            'serve' => false,
            'throw' => true,
            'visibility' => 'private',
            'permissions' => ['file' => ['public' => 0600, 'private' => 0600], 'dir' => ['public' => 0700, 'private' => 0700]],
        ],
    ],
    'links' => [],
];
