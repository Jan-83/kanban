import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createStrategySeed } from '../src/utils/strategy';

test('shared strategy database isolates tasks and enforces membership, CAS and valid hierarchy', async t => {
  const db = new PGlite();
  const alice = '00000000-0000-4000-a000-000000000001', bob = '00000000-0000-4000-a000-000000000002', stranger = '00000000-0000-4000-a000-000000000003';
  const board = '10000000-0000-4000-a000-000000000001', other = '10000000-0000-4000-a000-000000000002';
  const seed = createStrategySeed();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609280001_secure_kanban.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261025204207_kanban_strategy_board.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1),($2),($3)', [alice, bob, stranger]);
    await db.query('insert into public.kanban_boards(id,name) values ($1,$3),($2,$4)', [board, other, 'Shared', 'Other']);
    await db.query('insert into public.kanban_members(board_id,user_id,display_name) values ($1,$2,$3),($1,$4,$5)', [board, alice, 'Jan', bob, 'Darek']);
    const originalTasks = (await db.query('select data,revision from public.kanban_boards where id=$1', [board])).rows;
    const as = async (role: string, id: string, callback: () => Promise<void>) => { await db.exec('begin'); try { await db.exec('set local role ' + role); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]); await callback(); } finally { await db.exec('rollback'); } };
    const denied = (promise: Promise<unknown>, code = '42501') => assert.rejects(promise, (e: any) => e.code === code);
    const insert = (id = board, data: unknown = seed) => db.query('insert into public.kanban_strategy_boards(board_id,data,revision) values ($1,$2,0)', [id, JSON.stringify(data)]);
    await t.test('anonymous and outsiders cannot create or read a shared strategy', async () => {
      await as('anon', '', () => denied(db.query('select * from public.kanban_strategy_boards')));
      for (const id of [stranger, '']) await as('authenticated', id, () => denied(insert()));
      await as('authenticated', alice, () => denied(insert(other)));
    });
    await t.test('member initializes and second member edits; stale revision changes no rows', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]); await db.exec('set role authenticated'); await insert(); await db.exec('reset role');
      await as('authenticated', bob, async () => {
        assert.equal((await db.query('select * from public.kanban_strategy_boards')).rows.length, 1);
        const changed = structuredClone(seed); changed.cards[0].task.title = 'Wspólnie';
        const saved = await db.query('update public.kanban_strategy_boards set data=$1,revision=1 where board_id=$2 and revision=0 returning revision', [JSON.stringify(changed), board]);
        assert.equal(saved.rows.length, 1);
        assert.equal((await db.query('update public.kanban_strategy_boards set data=$1,revision=1 where board_id=$2 and revision=0 returning revision', [JSON.stringify(seed), board])).rows.length, 0);
      });
    });
    await t.test('forged revisions, ownership changes and deletes are blocked', async () => {
      await as('authenticated', alice, () => denied(db.query('update public.kanban_strategy_boards set revision=77'), '40001'));
      await as('authenticated', alice, () => denied(db.query('update public.kanban_strategy_boards set board_id=$1', [other])));
      await as('authenticated', alice, () => denied(db.query('delete from public.kanban_strategy_boards')));
    });
    await t.test('cycles, dangling parents, duplicate IDs, oversized and malformed payloads are rejected', async () => {
      const cycle = structuredClone(seed); cycle.cards[0].parentId = 'strategy-return';
      const orphan = structuredClone(seed); orphan.cards[0].parentId = 'missing';
      const duplicate = structuredClone(seed); duplicate.cards.push(duplicate.cards[0]);
      const large = structuredClone(seed); large.cards[0].task.description = 'x'.repeat(2000001);
      for (const bad of [cycle, orphan, duplicate, large, { version: 1, cards: {} }, { version: 1, cards: [{}] }]) await as('authenticated', alice, () => denied(db.query('update public.kanban_strategy_boards set data=$1,revision=1 where board_id=$2', [JSON.stringify(bad), board]), '22023'));
    });
    await t.test('membership revocation takes effect immediately and original tasks stay intact', async () => {
      await db.query('delete from public.kanban_members where user_id=$1', [bob]);
      await as('authenticated', bob, async () => { assert.equal((await db.query('select * from public.kanban_strategy_boards')).rows.length, 0); assert.equal((await db.query('update public.kanban_strategy_boards set revision=1 returning board_id')).rows.length, 0); });
      assert.deepEqual((await db.query('select data,revision from public.kanban_boards where id=$1', [board])).rows, originalTasks);
    });
  } finally { await db.close(); }
});
