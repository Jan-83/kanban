-- Strategy is isolated from kanban_boards.data: old clients cannot overwrite it.
create table public.kanban_strategy_boards (
  board_id uuid primary key references public.kanban_boards(id) on delete cascade,
  data jsonb not null default '{"version":1,"cards":[]}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.kanban_strategy_boards enable row level security;
revoke all on public.kanban_strategy_boards from public, anon, authenticated;
grant select on public.kanban_strategy_boards to authenticated;
grant insert (board_id, data, revision), update (data, revision) on public.kanban_strategy_boards to authenticated;

create policy strategy_member_read on public.kanban_strategy_boards for select to authenticated
using (exists (select 1 from public.kanban_members m where m.board_id = kanban_strategy_boards.board_id and m.user_id = (select auth.uid())));
create policy strategy_member_create on public.kanban_strategy_boards for insert to authenticated
with check (exists (select 1 from public.kanban_members m where m.board_id = kanban_strategy_boards.board_id and m.user_id = (select auth.uid())));
create policy strategy_member_update on public.kanban_strategy_boards for update to authenticated
using (exists (select 1 from public.kanban_members m where m.board_id = kanban_strategy_boards.board_id and m.user_id = (select auth.uid())))
with check (exists (select 1 from public.kanban_members m where m.board_id = kanban_strategy_boards.board_id and m.user_id = (select auth.uid())));

create function public.validate_kanban_strategy_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare card jsonb; card_count integer;
begin
  if tg_op = 'INSERT' then
    if new.revision <> 0 then raise exception 'Initial revision must be zero' using errcode = '22023'; end if;
  elsif new.board_id <> old.board_id or new.revision <> old.revision + 1 then
    raise exception 'Invalid strategy revision' using errcode = '40001';
  end if;
  if jsonb_typeof(new.data) is distinct from 'object' or new.data->'version' is distinct from '1'::jsonb or jsonb_typeof(new.data->'cards') is distinct from 'array' or octet_length(new.data::text) > 2000000 then
    raise exception 'Invalid strategy payload' using errcode = '22023';
  end if;
  card_count := jsonb_array_length(new.data->'cards');
  if card_count > 1000 then raise exception 'Too many strategy cards' using errcode = '22023'; end if;
  for card in select value from jsonb_array_elements(new.data->'cards') loop
    if jsonb_typeof(card->'task') is distinct from 'object'
      or coalesce(card->'task'->>'id','') !~ '^[a-zA-Z0-9_-]{1,120}$'
      or jsonb_typeof(card->'task'->'title') is distinct from 'string'
      or length(btrim(card->'task'->>'title')) not between 1 and 300
      or jsonb_typeof(card->'position'->'x') is distinct from 'number'
      or jsonb_typeof(card->'position'->'y') is distinct from 'number'
      or not (card ? 'parentId')
      or (card->'parentId' <> 'null'::jsonb and (jsonb_typeof(card->'parentId') <> 'string' or card->>'parentId' !~ '^[a-zA-Z0-9_-]{1,120}$')) then
      raise exception 'Invalid strategy card' using errcode = '22023';
    end if;
    if abs((card->'position'->>'x')::numeric) > 10000000 or abs((card->'position'->>'y')::numeric) > 10000000 then raise exception 'Invalid position' using errcode = '22023'; end if;
  end loop;
  if (select count(distinct value->'task'->>'id') from jsonb_array_elements(new.data->'cards')) <> card_count then raise exception 'Duplicate card IDs' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(new.data->'cards') c where c->'parentId' <> 'null'::jsonb and not exists (select 1 from jsonb_array_elements(new.data->'cards') p where p->'task'->>'id' = c->>'parentId')) then raise exception 'Missing parent' using errcode = '22023'; end if;
  if exists (
    with recursive cards as (select value->'task'->>'id' as id, value->>'parentId' as parent from jsonb_array_elements(new.data->'cards')),
    paths as (
      select id, parent, array[id] as visited, false as cycle from cards
      union all
      select c.id, c.parent, p.visited || c.id, c.id = any(p.visited) from paths p join cards c on c.id = p.parent where not p.cycle
    ) select 1 from paths where cycle
  ) then raise exception 'Cyclic hierarchy' using errcode = '22023'; end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.validate_kanban_strategy_write() from public, anon, authenticated;
create trigger validate_kanban_strategy_write before insert or update on public.kanban_strategy_boards
for each row execute function public.validate_kanban_strategy_write();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kanban_strategy_boards') then
    alter publication supabase_realtime add table public.kanban_strategy_boards;
  end if;
end $$;
