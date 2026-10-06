import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private task photos are restricted to actual board members', async () => {
  const db = new PGlite();
  const member = '00000000-0000-4000-a000-000000000001';
  const outsider = '00000000-0000-4000-a000-000000000002';
  const board = '10000000-0000-4000-a000-000000000001';
  const other = '10000000-0000-4000-a000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, unique(bucket_id,name));
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth,public,storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      grant execute on function auth.uid(),storage.foldername(text) to anon,authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609280001_secure_kanban.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261006214032_task_images.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1),($2)', [member, outsider]);
    await db.query('insert into public.kanban_boards(id,name) values ($1,$3),($2,$4)', [board, other, 'Board', 'Other']);
    await db.query('insert into public.kanban_members(board_id,user_id,display_name) values ($1,$2,$3)', [board, member, 'Member']);
    await db.query("insert into storage.objects(bucket_id,name) values ('kanban-task-images',$1),('kanban-task-images',$2)", [board + '/task-a/photo-a.jpg', other + '/task-b/photo-b.jpg']);
    const as = async (role: string, user: string, action: () => Promise<void>) => {
      await db.exec('begin');
      try { await db.exec('set local role ' + role); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]); await action(); }
      finally { await db.exec('rollback'); }
    };
    const upload = (name: string, bucket = 'kanban-task-images') => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', [bucket, name]);
    const denied = (promise: Promise<unknown>) => assert.rejects(promise, (error: any) => error.code === '42501');
    for (const [role, user] of [['anon',''], ['authenticated', outsider], ['authenticated','']]) {
      await as(role, user, async () => { assert.equal((await db.query('select name from storage.objects')).rows.length, 0); });
      await as(role, user, () => denied(upload(board + '/task-a/new.jpg')));
    }
    await as('authenticated', member, async () => {
      assert.deepEqual((await db.query('select name from storage.objects')).rows, [{ name: board + '/task-a/photo-a.jpg' }]);
      await upload(board + '/task-a/new.png');
    });
    await as('authenticated', member, () => denied(upload(other + '/task-a/new.jpg')));
    await as('authenticated', member, () => denied(upload(board + '/task-a/../../escape.jpg')));
    await as('authenticated', member, () => denied(upload(board + '/task-a/new.svg')));
    await as('authenticated', member, () => denied(upload(board + '/task-a/new.jpg', 'other-bucket')));
    await as('authenticated', member, async () => { assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0); assert.equal((await db.query("update storage.objects set name='tampered' returning id")).rows.length, 0); });
    assert.deepEqual((await db.query<any>("select public,file_size_limit,allowed_mime_types from storage.buckets where id='kanban-task-images'")).rows[0], { public: false, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg','image/png','image/webp'] });
    await db.query('delete from public.kanban_members where user_id=$1', [member]);
    await as('authenticated', member, async () => { assert.equal((await db.query('select name from storage.objects')).rows.length, 0); });
  } finally { await db.close(); }
});
