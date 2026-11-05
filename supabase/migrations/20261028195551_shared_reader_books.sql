-- Shared books use custom Me+ reader sessions; direct Data API access is denied.
create table public.book_reader_shared_books (
  id text primary key check (id ~ '^shared-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  owner_id uuid not null references public.book_reader_accounts(id),
  package jsonb not null check (jsonb_typeof(package) = 'object'),
  files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 2 and 73),
  verified jsonb not null default '{}'::jsonb check (jsonb_typeof(verified) = 'object'),
  status text not null default 'draft' check (status in ('draft','published')),
  reserved_bytes bigint not null check (reserved_bytes between 1 and 419430400),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.book_reader_shared_books enable row level security;
revoke all on public.book_reader_shared_books from public, anon, authenticated;
grant select,insert,update on public.book_reader_shared_books to service_role;
create index book_reader_shared_drafts on public.book_reader_shared_books(owner_id) where status='draft';

create function public.book_reader_shared_begin(p_id text,p_owner uuid,p_package jsonb,p_files jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare existing public.book_reader_shared_books; total bigint;
begin
  perform pg_advisory_xact_lock(hashtext('pagechime-shared-library'));
  if not exists(select 1 from public.book_reader_accounts where id=p_owner and active and role='admin') then return false; end if;
  select * into existing from public.book_reader_shared_books where id=p_id;
  if found then return existing.owner_id=p_owner and existing.package=p_package and existing.files=p_files; end if;
  if (select count(*) from public.book_reader_shared_books where owner_id=p_owner and status='draft') >= 3 then return false; end if;
  select sum((f->>'size')::bigint) into total from jsonb_array_elements(p_files) f;
  if total is null or total<1 or total + coalesce((select sum(reserved_bytes) from public.book_reader_shared_books),0)>419430400 then return false; end if;
  insert into public.book_reader_shared_books(id,owner_id,package,files,reserved_bytes) values(p_id,p_owner,p_package,p_files,total);
  return true;
end $$;
create function public.book_reader_shared_verify(p_id text,p_owner uuid,p_key text,p_hash text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  update public.book_reader_shared_books b set verified=jsonb_set(verified,array[p_key],to_jsonb(p_hash),true)
  where id=p_id and owner_id=p_owner and status='draft'
    and exists(select 1 from public.book_reader_accounts where id=p_owner and active and role='admin')
    and exists(select 1 from jsonb_array_elements(b.files) f where f->>'key'=p_key and f->>'sha256'=p_hash);
  return found;
end $$;
create function public.book_reader_shared_publish(p_id text,p_owner uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  update public.book_reader_shared_books b set status='published',published_at=now()
  where id=p_id and owner_id=p_owner and status='draft'
    and exists(select 1 from public.book_reader_accounts where id=p_owner and active and role='admin')
    and not exists(select 1 from jsonb_array_elements(b.files) f where b.verified->>(f->>'key') is distinct from f->>'sha256');
  return found;
end $$;
revoke all on function public.book_reader_shared_begin(text,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.book_reader_shared_verify(text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.book_reader_shared_publish(text,uuid) from public,anon,authenticated;
grant execute on function public.book_reader_shared_begin(text,uuid,jsonb,jsonb) to service_role;
grant execute on function public.book_reader_shared_verify(text,uuid,text,text) to service_role;
grant execute on function public.book_reader_shared_publish(text,uuid) to service_role;
