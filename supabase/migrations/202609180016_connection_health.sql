-- Credentials stay in the existing service-only, RLS-protected table.
alter table social_accounts
 add column refresh_token_encrypted text,
 add column refresh_claim uuid,
 add column refresh_started_at timestamptz,
 add column connection_issue text check(connection_issue in ('reconnect','permissions','rate_limit','unavailable')),
 add column last_verified_at timestamptz;

create function public.store_channel_connection(org uuid,person uuid,channel_name text,provider_person text,person_name text,encrypted text,refresh_encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if channel_name not in ('linkedin','x') or encrypted is null or expiry<=now() then raise exception 'Invalid account';end if;
 perform pg_advisory_xact_lock(hashtext(channel_name||':'||provider_person));
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Membership no longer eligible';end if;
 if exists(select 1 from social_accounts where provider=channel_name and provider_user_id=provider_person and user_id<>person) then raise exception 'Profile belongs to another account';end if;
 insert into social_accounts(organization_id,user_id,provider,provider_user_id,display_name,token_encrypted,refresh_token_encrypted,expires_at,last_verified_at)
 values(org,person,channel_name,provider_person,person_name,encrypted,refresh_encrypted,expiry,now())
 on conflict(organization_id,user_id,provider) do update set provider_user_id=excluded.provider_user_id,display_name=excluded.display_name,token_encrypted=excluded.token_encrypted,refresh_token_encrypted=excluded.refresh_token_encrypted,expires_at=excluded.expires_at,last_verified_at=now(),refresh_claim=null,refresh_started_at=null,connection_issue=null;
 insert into audit_log(organization_id,actor_user_id,action) values(org,person,channel_name||'.connected');
end $$;

create function public.claim_connection_token(org uuid,person uuid,channel_name text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a social_accounts; lease uuid;
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then return jsonb_build_object('kind','reconnect');end if;
 select * into a from social_accounts where organization_id=org and user_id=person and provider=channel_name for update;
 if a.id is null or a.connection_issue='reconnect' then return jsonb_build_object('kind','reconnect');end if;
 -- A lost rotation response is not replayed. The member must reconnect.
 if a.refresh_claim is not null then
  if a.refresh_started_at<now()-interval '2 minutes' then
   update social_accounts set connection_issue='reconnect',refresh_token_encrypted=null where id=a.id;
   return jsonb_build_object('kind','reconnect');
  end if;
  return jsonb_build_object('kind','busy');
 end if;
 if a.expires_at>now()+interval '20 minutes' or (a.expires_at>now()+interval '1 minute' and (channel_name<>'x' or a.refresh_token_encrypted is null)) then
  return jsonb_build_object('kind','ready','encrypted',a.token_encrypted,'provider_person',a.provider_user_id);
 end if;
 if channel_name<>'x' or a.refresh_token_encrypted is null then
  update social_accounts set connection_issue='reconnect' where id=a.id;
  return jsonb_build_object('kind','reconnect');
 end if;
 lease=gen_random_uuid();
 update social_accounts set refresh_claim=lease,refresh_started_at=now() where id=a.id;
 return jsonb_build_object('kind','refresh','lease',lease,'encrypted',a.refresh_token_encrypted,'provider_person',a.provider_user_id);
end $$;

create function public.finish_connection_refresh(org uuid,person uuid,channel_name text,lease uuid,encrypted text,refresh_encrypted text,expiry timestamptz) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then return false;end if;
 update social_accounts set token_encrypted=case when encrypted is null then token_encrypted else encrypted end,
 refresh_token_encrypted=refresh_encrypted,expires_at=coalesce(expiry,expires_at),refresh_claim=null,refresh_started_at=null,
 connection_issue=case when encrypted is null then 'reconnect' when connection_issue='permissions' then connection_issue else null end
 where organization_id=org and user_id=person and provider=channel_name and refresh_claim=lease
 and refresh_started_at>now()-interval '2 minutes' and (encrypted is null or expiry>now());
 return found;
end $$;

create function public.record_connection_check(org uuid,person uuid,channel_name text,expected_token text,issue text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update social_accounts set connection_issue=case when issue is null and connection_issue='permissions' then connection_issue else issue end,last_verified_at=case when issue is null then now() else last_verified_at end
 where organization_id=org and user_id=person and provider=channel_name and token_encrypted=expected_token and refresh_claim is null;
end $$;

create function public.team_connection_health(org uuid) returns table(user_id uuid,provider text,state text,last_verified_at timestamptz,expires_at timestamptz,renewal_enabled boolean) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return query select a.user_id,a.provider,
 case when a.connection_issue='reconnect' or (a.refresh_claim is not null and a.refresh_started_at<now()-interval '2 minutes') or (a.expires_at<=now() and a.refresh_token_encrypted is null) then 'reconnect'
 when a.connection_issue is not null then a.connection_issue
 when a.expires_at<=now() or a.refresh_claim is not null then 'renewing' else 'connected' end,
 a.last_verified_at,a.expires_at,a.refresh_token_encrypted is not null from social_accounts a join memberships m on m.organization_id=a.organization_id and m.user_id=a.user_id
 where a.organization_id=org and m.removed_at is null;
end $$;
revoke all on function store_channel_connection(uuid,uuid,text,text,text,text,text,timestamptz),claim_connection_token(uuid,uuid,text),finish_connection_refresh(uuid,uuid,text,uuid,text,text,timestamptz),record_connection_check(uuid,uuid,text,text,text),team_connection_health(uuid) from public,anon,authenticated;
grant execute on function store_channel_connection(uuid,uuid,text,text,text,text,text,timestamptz),claim_connection_token(uuid,uuid,text),finish_connection_refresh(uuid,uuid,text,uuid,text,text,timestamptz),record_connection_check(uuid,uuid,text,text,text) to service_role;
grant execute on function team_connection_health(uuid) to authenticated;

-- Explicit provider rejection allows author retry; ambiguous outcomes stay locked.
create function public.reject_publish_attempt(draft uuid,expected_revision integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update drafts set status='approved',updated_at=now() where id=draft and status='publishing' and revision=expected_revision and approved_revision=expected_revision and provider_post_id is null;
 if not found then return false;end if;
 update publish_jobs set status='failed' where draft_id=draft and status in ('pending','running');
 return true;
end $$;
revoke all on function reject_publish_attempt(uuid,integer) from public,anon,authenticated;
grant execute on function reject_publish_attempt(uuid,integer) to service_role;

-- Preserve legacy callers while applying the same ownership and reset rules.
create or replace function public.store_social_account(org uuid,person uuid,provider_person text,person_name text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform store_channel_connection(org,person,'linkedin',provider_person,person_name,encrypted,null,expiry);end $$;
create or replace function public.store_x_account(org uuid,person uuid,provider_person text,person_name text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin perform store_channel_connection(org,person,'x',provider_person,person_name,encrypted,null,expiry);end $$;
