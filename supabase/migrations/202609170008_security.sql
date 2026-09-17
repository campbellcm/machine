-- Prevent temporary-relation shadowing in SECURITY DEFINER functions.
revoke create on schema public from public,anon,authenticated;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop execute format('alter function %s set search_path=public,pg_temp',f.signature);end loop;end $$;
-- One member may legitimately connect the same profile in multiple companies.
alter table social_accounts drop constraint social_accounts_provider_provider_user_id_key;
create or replace function public.store_social_account(org uuid,person uuid,provider_person text,person_name text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext('linkedin:'||provider_person));
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Membership no longer eligible'; end if;
 if exists(select 1 from social_accounts where provider='linkedin' and provider_user_id=provider_person and user_id<>person) then raise exception 'Profile belongs to another account'; end if;
 insert into social_accounts(organization_id,user_id,provider,provider_user_id,display_name,token_encrypted,expires_at) values(org,person,'linkedin',provider_person,person_name,encrypted,expiry)
 on conflict(organization_id,user_id,provider) do update set provider_user_id=excluded.provider_user_id,display_name=excluded.display_name,token_encrypted=excluded.token_encrypted,expires_at=excluded.expires_at;
 insert into audit_log(organization_id,actor_user_id,action) values(org,person,'linkedin.connected');
end $$;
create function public.approved_copy(draft uuid,expected_revision integer) returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
declare d drafts;
begin
 select * into d from drafts where id=draft;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.status<>'approved' or d.approved_revision<>d.revision or d.revision<>expected_revision or not check_draft(d.organization_id,d.body) then raise exception 'Current author approval required'; end if;
 return d.body;
end $$;
revoke all on function approved_copy(uuid,integer) from public,anon,authenticated;
grant execute on function approved_copy(uuid,integer) to authenticated;
