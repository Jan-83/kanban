-- Private, immutable task photos. Board membership also protects downloads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kanban-task-images', 'kanban-task-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy kanban_task_image_read on storage.objects
for select to authenticated
using (
  bucket_id = 'kanban-task-images'
  and exists (
    select 1 from public.kanban_members m
    where m.board_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

create policy kanban_task_image_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'kanban-task-images'
  and name ~ '^[0-9a-fA-F-]{36}/[a-zA-Z0-9_-]{1,120}/[a-zA-Z0-9_-]{1,120}\.(jpg|png|webp)$'
  and exists (
    select 1 from public.kanban_members m
    where m.board_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);
