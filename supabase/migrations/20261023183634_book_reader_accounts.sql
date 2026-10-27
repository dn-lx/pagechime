-- Custom reader identity is independent of auth.users and Me+ profiles.
create table public.book_reader_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_.-]{2,39}$'),
  display_name text not null check (length(display_name) between 1 and 80),
  password_hash text not null,
  role text not null default 'reader' check (role in ('reader','admin')),
  active boolean not null default true,
  session_version integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.book_reader_sessions (
  token_hash text primary key check (length(token_hash)=64),
  account_id uuid not null references public.book_reader_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  session_version integer not null,
  created_at timestamptz not null default now()
);
create index book_reader_sessions_account_idx on public.book_reader_sessions(account_id);
create index book_reader_sessions_expiry_idx on public.book_reader_sessions(expires_at);
create table public.book_reader_invites (
  token_hash text primary key check (length(token_hash)=64),
  role text not null default 'reader' check (role in ('reader','admin')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.book_reader_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.book_reader_state (
  account_id uuid not null references public.book_reader_accounts(id) on delete cascade,
  key text not null check (key ~ '^(bookmark|note|progress)\.[A-Za-z0-9_.-]{1,160}$'),
  value jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key(account_id,key),
  check (octet_length(value::text) <= 20000)
);
-- Null values are deletion tombstones, preventing stale-device resurrection.
create table public.book_reader_rate_limits (
  key text primary key,
  hits integer not null,
  window_start timestamptz not null default now()
);
alter table public.book_reader_accounts enable row level security;
alter table public.book_reader_sessions enable row level security;
alter table public.book_reader_invites enable row level security;
alter table public.book_reader_state enable row level security;
alter table public.book_reader_rate_limits enable row level security;
revoke all on public.book_reader_accounts, public.book_reader_sessions, public.book_reader_invites, public.book_reader_state, public.book_reader_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.book_reader_accounts, public.book_reader_sessions, public.book_reader_invites, public.book_reader_state, public.book_reader_rate_limits to service_role;

create function public.book_reader_consume_attempt(p_key text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  insert into public.book_reader_rate_limits as r(key,hits,window_start) values(p_key,1,now())
  on conflict(key) do update set
    hits = case when r.window_start < now()-interval '15 minutes' then 1 else r.hits+1 end,
    window_start = case when r.window_start < now()-interval '15 minutes' then now() else r.window_start end
  returning hits into n;
  return n <= p_limit;
end; $$;

create function public.book_reader_claim_invite(p_hash text,p_username text,p_name text,p_password text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare invite_role text; new_id uuid;
begin
  update public.book_reader_invites set used_at=now()
    where token_hash=p_hash and used_at is null and expires_at>now()
    returning role into invite_role;
  if invite_role is null then return null; end if;
  insert into public.book_reader_accounts(username,display_name,password_hash,role)
    values(p_username,p_name,p_password,invite_role) returning id into new_id;
  return new_id;
end; $$;

create function public.book_reader_write_state(p_account uuid,p_key text,p_value jsonb,p_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare new_revision integer;
begin
  if p_revision=0 then
    insert into public.book_reader_state(account_id,key,value) values(p_account,p_key,p_value)
    on conflict do nothing returning revision into new_revision;
  else
    update public.book_reader_state set value=p_value,revision=revision+1,updated_at=now()
      where account_id=p_account and key=p_key and revision=p_revision
      returning revision into new_revision;
  end if;
  return new_revision;
end; $$;
revoke all on function public.book_reader_consume_attempt(text,integer), public.book_reader_claim_invite(text,text,text,text), public.book_reader_write_state(uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.book_reader_consume_attempt(text,integer), public.book_reader_claim_invite(text,text,text,text), public.book_reader_write_state(uuid,text,jsonb,integer) to service_role;

-- Lock the same account row for issuance and revocation; stale logins cannot revive.
create function public.book_reader_issue_session(p_account uuid,p_hash text,p_expires timestamptz,p_version integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_version integer; enabled boolean;
begin
  select session_version,active into current_version,enabled from public.book_reader_accounts where id=p_account for update;
  if enabled is distinct from true or current_version<>p_version then return false; end if;
  insert into public.book_reader_sessions(token_hash,account_id,expires_at,session_version) values(p_hash,p_account,p_expires,p_version);
  return true;
end; $$;
create function public.book_reader_set_access(p_account uuid,p_active boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.book_reader_accounts set active=p_active,session_version=session_version+1 where id=p_account;
  delete from public.book_reader_sessions where account_id=p_account;
end; $$;
revoke all on function public.book_reader_issue_session(uuid,text,timestamptz,integer),public.book_reader_set_access(uuid,boolean) from public,anon,authenticated;
grant execute on function public.book_reader_issue_session(uuid,text,timestamptz,integer),public.book_reader_set_access(uuid,boolean) to service_role;
