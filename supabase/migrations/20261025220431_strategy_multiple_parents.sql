-- Accept existing single-parent boards until their first successful v2 CAS save.
-- Never rewrite live cards or allow an old browser to erase multiple connections.
alter table public.kanban_strategy_boards alter column data set default '{"version":2,"cards":[]}'::jsonb;

create or replace function public.validate_kanban_strategy_write() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  card jsonb; parents jsonb; graph jsonb := '{}'::jsonb;
  card_count integer; ready text[];
begin
  if tg_op = 'INSERT' then
    if new.revision <> 0 then raise exception 'Initial revision must be zero' using errcode = '22023'; end if;
  else
    if new.board_id <> old.board_id or new.revision <> old.revision + 1 then
      raise exception 'Invalid strategy revision' using errcode = '40001';
    end if;
    if old.data->'version' = '2'::jsonb and new.data->'version' = '1'::jsonb then
      raise exception 'Odśwież stronę przed zapisem. Tablica obsługuje już wiele połączeń.' using errcode = '22023';
    end if;
  end if;
  if jsonb_typeof(new.data) is distinct from 'object'
    or (new.data->'version' is distinct from '1'::jsonb and new.data->'version' is distinct from '2'::jsonb)
    or jsonb_typeof(new.data->'cards') is distinct from 'array' or octet_length(new.data::text) > 2000000 then
    raise exception 'Invalid strategy payload' using errcode = '22023';
  end if;
  card_count := jsonb_array_length(new.data->'cards');
  if card_count > 1000 then raise exception 'Too many strategy cards' using errcode = '22023'; end if;
  for card in select value from jsonb_array_elements(new.data->'cards') loop
    if jsonb_typeof(card->'task') is distinct from 'object'
      or jsonb_typeof(card->'task'->'id') is distinct from 'string'
      or coalesce(card->'task'->>'id','') !~ '^[a-zA-Z0-9_-]{1,120}$'
      or jsonb_typeof(card->'task'->'title') is distinct from 'string'
      or length(btrim(card->'task'->>'title')) not between 1 and 300
      or jsonb_typeof(card->'position'->'x') is distinct from 'number'
      or jsonb_typeof(card->'position'->'y') is distinct from 'number' then
      raise exception 'Invalid strategy card' using errcode = '22023';
    end if;
    if abs((card->'position'->>'x')::numeric) > 10000000 or abs((card->'position'->>'y')::numeric) > 10000000 then raise exception 'Invalid position' using errcode = '22023'; end if;
    if new.data->'version' = '1'::jsonb then
      if not (card ? 'parentId') or card ? 'parentIds'
        or (card->'parentId' <> 'null'::jsonb and (jsonb_typeof(card->'parentId') <> 'string' or card->>'parentId' !~ '^[a-zA-Z0-9_-]{1,120}$')) then
        raise exception 'Invalid legacy parent' using errcode = '22023';
      end if;
      parents := case when card->'parentId' = 'null'::jsonb then '[]'::jsonb else jsonb_build_array(card->'parentId') end;
    else
      if jsonb_typeof(card->'parentIds') is distinct from 'array' or card ? 'parentId' then raise exception 'Invalid parents' using errcode = '22023'; end if;
      parents := card->'parentIds';
      if exists (select 1 from jsonb_array_elements(parents) p where jsonb_typeof(p) <> 'string' or (p #>> '{}') !~ '^[a-zA-Z0-9_-]{1,120}$')
        or (select count(distinct value) from jsonb_array_elements(parents)) <> jsonb_array_length(parents) then
        raise exception 'Invalid or duplicate parents' using errcode = '22023';
      end if;
    end if;
    if graph ? (card->'task'->>'id') then raise exception 'Duplicate card IDs' using errcode = '22023'; end if;
    graph := graph || jsonb_build_object(card->'task'->>'id', parents);
  end loop;
  if exists (select 1 from jsonb_each(graph) c cross join lateral jsonb_array_elements_text(c.value) p where not (graph ? p.value)) then
    raise exception 'Missing parent' using errcode = '22023';
  end if;
  -- Remove roots in batches. This does not enumerate every possible path in a DAG.
  while graph <> '{}'::jsonb loop
    select array_agg(key) into ready from jsonb_each(graph) where jsonb_array_length(value) = 0;
    if ready is null then raise exception 'Cyclic hierarchy' using errcode = '22023'; end if;
    select coalesce(jsonb_object_agg(c.key,
      (select coalesce(jsonb_agg(p.value), '[]'::jsonb) from jsonb_array_elements(c.value) p where not ((p.value #>> '{}') = any(ready)))
    ), '{}'::jsonb) into graph from jsonb_each(graph) c where not (c.key = any(ready));
  end loop;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.validate_kanban_strategy_write() from public, anon, authenticated;
