-- Isolated capability keys for private development build media. No Supabase Auth dependency.
create table public.book_reader_library_keys (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  scope text not null check (scope in ('build','upload')),
  label text not null check (length(label) between 1 and 80),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (scope <> 'upload' or expires_at is not null)
);
alter table public.book_reader_library_keys enable row level security;
revoke all on public.book_reader_library_keys from public, anon, authenticated;
grant select,insert,update,delete on public.book_reader_library_keys to service_role;
