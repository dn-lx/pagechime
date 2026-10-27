-- Cover a 10,000-character Unicode note plus position metadata.
alter table public.book_reader_state drop constraint book_reader_state_value_check;
alter table public.book_reader_state add constraint book_reader_state_value_check check(octet_length(value::text)<=65536);
create index book_reader_invites_creator_idx on public.book_reader_invites(created_by);
create index book_reader_rate_limits_window_idx on public.book_reader_rate_limits(window_start);
create index book_reader_invites_expiry_idx on public.book_reader_invites(expires_at);
create or replace function public.book_reader_consume_attempt(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  delete from public.book_reader_rate_limits where key in (select key from public.book_reader_rate_limits where window_start<now()-interval '1 day' order by window_start limit 500);
  delete from public.book_reader_sessions where token_hash in (select token_hash from public.book_reader_sessions where expires_at<now() order by expires_at limit 500);
  delete from public.book_reader_invites where token_hash in (select token_hash from public.book_reader_invites where expires_at<now()-interval '7 days' order by expires_at limit 500);
  insert into public.book_reader_rate_limits as r(key,hits,window_start) values(p_key,1,now())
  on conflict(key) do update set
    hits=case when r.window_start<now()-interval '15 minutes' then 1 else r.hits+1 end,
    window_start=case when r.window_start<now()-interval '15 minutes' then now() else r.window_start end
  returning hits into n;
  return n<=p_limit;
end; $$;
-- CREATE OR REPLACE preserves privileges; restate the intended contract.
revoke all on function public.book_reader_consume_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.book_reader_consume_attempt(text,integer) to service_role;
