import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { emptyBoard } from '../src/utils/board';
test('Postgres authorization boundary and concurrent writes', async t => {
  const db = new PGlite();
  const alice = '00000000-0000-4000-a000-000000000001';
  const bob = '00000000-0000-4000-a000-000000000002';
  const outsider = '00000000-0000-4000-a000-000000000003';
  const board = '10000000-0000-4000-a000-000000000001';
  const other = '10000000-0000-4000-a000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609280001_secure_kanban.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1),($2),($3)', [alice, bob, outsider]);
    await db.query('insert into public.kanban_boards(id,name) values ($1,$3),($2,$4)', [board, other, 'Test board', 'Private board']);
    await db.query('insert into public.kanban_members(board_id,user_id,display_name,role) values ($1,$2,$3,$4),($5,$6,$7,$8)', [board, alice, 'Alice', 'member', other, bob, 'Bob', 'admin']);
    const as = async (role: 'anon' | 'authenticated', sub: string, callback: () => Promise<void>) => {
      await db.exec('begin');
      try { await db.exec('set local role ' + role); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [sub]); await callback(); }
      finally { await db.exec('rollback'); }
    };
    const denied = (promise: Promise<unknown>, code = '42501') => assert.rejects(promise, (e: any) => e.code === code);
    const save = (id = board, revision = 0, data: unknown = emptyBoard()) => db.query<{ revision: number }>('select public.save_kanban_board($1,$2,$3::jsonb) as revision', [id, revision, JSON.stringify(data)]);
    await t.test('anonymous cannot read rows or execute the write RPC', async () => {
      await as('anon', '', () => denied(db.query('select * from public.kanban_boards')));
      await as('anon', '', () => denied(save()));
    });
    await t.test('forged browser session / missing JWT has no access', async () => {
      await as('authenticated', '', async () => { assert.equal((await db.query('select * from public.kanban_boards')).rows.length, 0); });
      await as('authenticated', '', () => denied(save()));
    });
    await t.test('valid authenticated nonmember still cannot read or write', async () => {
      await as('authenticated', outsider, async () => { assert.equal((await db.query('select * from public.kanban_boards')).rows.length, 0); });
      await as('authenticated', outsider, () => denied(save()));
    });
    await t.test('member reads only authorized board and only own membership', async () => {
      await as('authenticated', alice, async () => {
        assert.deepEqual((await db.query('select id from public.kanban_boards')).rows, [{ id: board }]);
        assert.deepEqual((await db.query('select user_id from public.kanban_members')).rows, [{ user_id: alice }]);
      });
      await as('authenticated', alice, () => denied(save(other)));
    });
    await t.test('member can save, revision increases and stale edits are rejected', async () => {
      await as('authenticated', alice, async () => {
        const data = { ...emptyBoard(), stages: [...emptyBoard().stages, { id: 'review', title: 'Review', color: '#6366f1' }] };
        assert.equal(Number((await save(board, 0, data)).rows[0].revision), 1);
        assert.equal((await db.query<any>('select data from public.kanban_boards')).rows[0].data.stages.length, 4);
        await denied(save(board, 0), '40001');
      });
    });
    await t.test('member saves comment history and closing status through the existing revision RPC', async () => {
      await as('authenticated', alice, async () => {
        const data = { ...emptyBoard(), tasks: [{ id: 'status-task', title: 'Odbiór', description: '', status: 'done', priority: 'medium', dueDate: '', assigneeId: null, tags: [], subtasks: [],
          statusComments: [{ id: 'comment-1', text: 'Testy zakończone.', timestamp: '2026-10-05T13:15:00.000Z', author: 'Alice' }],
          closingStatus: 'Wdrożono i uzyskano akceptację.', createdAt: '2026-10-05', updatedAt: '2026-10-05' }] };
        assert.equal(Number((await save(board, 0, data)).rows[0].revision), 1);
        assert.deepEqual((await db.query<any>('select data from public.kanban_boards')).rows[0].data, data);
        const changed = structuredClone(data);
        changed.tasks[0].statusComments.push({ id: 'comment-2', text: 'Potwierdzono odbiór.', timestamp: '2026-10-05T14:00:00.000Z', author: 'Alice' });
        assert.equal(Number((await save(board, 1, changed)).rows[0].revision), 2);
        assert.deepEqual((await db.query<any>('select data from public.kanban_boards')).rows[0].data, changed);
        await denied(save(board, 1, data), '40001');
      });
    });
    await t.test('direct table writes and membership escalation are denied', async () => {
      for (const query of [
        "update public.kanban_members set role='admin'",
        'delete from public.kanban_members',
        "insert into public.kanban_members(board_id,user_id,display_name) values ('" + other + "','" + alice + "','Forged')",
        "update public.kanban_boards set data='{}'",
        'delete from public.kanban_boards',
        "insert into public.kanban_boards(name) values ('Bypass')",
      ]) await as('authenticated', alice, () => denied(db.query(query)));
    });
    await t.test('admin strings in editable board data cannot grant database access', async () => {
      await as('authenticated', alice, async () => {
        await save(board, 0, { ...emptyBoard(), role: 'admin', members: [{ id: alice, role: 'admin' }] });
        assert.equal((await db.query<any>('select role from public.kanban_members')).rows[0].role, 'member');
        await denied(save(other));
      });
    });
    await t.test('invalid payload is rejected without changing the board', async () => {
      await as('authenticated', alice, () => denied(save(board, 0, { tasks: [], members: [], stages: [] }), '22023'));
    });
    await t.test('revocation applies immediately, even with an existing session', async () => {
      await db.query('delete from public.kanban_members where user_id=$1', [alice]);
      await as('authenticated', alice, async () => { assert.equal((await db.query('select * from public.kanban_boards')).rows.length, 0); });
      await as('authenticated', alice, () => denied(save()));
    });
  } finally { await db.close(); }
});

