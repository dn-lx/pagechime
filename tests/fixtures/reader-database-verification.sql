begin;
do $$
declare
 h text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 u text:='verify_'||substr(replace(gen_random_uuid()::text,'-',''),1,24);
 a uuid; r integer; denied boolean:=false;
begin
 insert into public.book_reader_invites(token_hash,role,expires_at) values(h,'reader',now()+interval '5 minutes');
 a:=public.book_reader_claim_invite(h,u,'Verification reader','test-only-hash');
 if a is null then raise exception 'Invite claim failed'; end if;
 if public.book_reader_claim_invite(h,u||'x','Second reader','test-only-hash') is not null then raise exception 'Invite reused'; end if;
 r:=public.book_reader_write_state(a,'note.verify','{"bookId":"demo","chapter":0,"page":1,"time":0,"body":"verification"}',0);
 if r<>1 then raise exception 'Initial state failed'; end if;
 if public.book_reader_write_state(a,'note.verify','{}',0) is not null then raise exception 'CAS conflict accepted'; end if;
 if public.book_reader_issue_session(a,h,now()+interval '5 minutes',0) is distinct from true then raise exception 'Session issue failed'; end if;
 perform public.book_reader_set_access(a,false);
 perform public.book_reader_set_access(a,true);
 if exists(select 1 from public.book_reader_sessions where account_id=a) then raise exception 'Sessions survived access change'; end if;
 if public.book_reader_issue_session(a,h,now()+interval '5 minutes',0) is distinct from false then raise exception 'Stale session accepted'; end if;
 execute 'set local role anon';
 begin execute 'select * from public.book_reader_accounts'; exception when insufficient_privilege then denied:=true; end;
 execute 'reset role';
 if not denied then raise exception 'Anon account read allowed'; end if;
 denied:=false;
 execute 'set local role authenticated';
 begin perform public.book_reader_claim_invite(h,u,'Forbidden','forbidden'); exception when insufficient_privilege then denied:=true; end;
 execute 'reset role';
 if not denied then raise exception 'Authenticated RPC allowed'; end if;
end $$;
select 'passed: invite single use, CAS, revocation version, anon read denial, authenticated RPC denial; all fixture writes rolled back' as result;
rollback;
