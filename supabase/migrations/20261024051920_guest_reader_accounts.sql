-- Keep existing usernames; also allow normalized ASCII email identifiers.
-- This changes no grants, RLS policies, account roles, sessions or invitations.
alter table public.book_reader_accounts
  drop constraint book_reader_accounts_username_check;
alter table public.book_reader_accounts
  add constraint book_reader_accounts_username_check check (
    username = lower(btrim(username)) and (
      username ~ '^[a-z0-9][a-z0-9_.-]{2,39}$'
      or (
        length(username) <= 254
        and username ~ '^[a-z0-9][a-z0-9_.+\-]{0,63}@[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$'
      )
    )
  );
