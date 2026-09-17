alter table social_accounts drop constraint social_accounts_provider_check;
alter table social_accounts add constraint social_accounts_provider_check check(provider in ('linkedin','x'));
create function public.store_x_account(org uuid,person uuid,provider_person text,person_name text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Membership no longer eligible';end if;
 insert into social_accounts(organization_id,user_id,provider,provider_user_id,display_name,token_encrypted,expires_at) values(org,person,'x',provider_person,person_name,encrypted,expiry)
 on conflict(organization_id,user_id,provider) do update set provider_user_id=excluded.provider_user_id,display_name=excluded.display_name,token_encrypted=excluded.token_encrypted,expires_at=excluded.expires_at;
end $$;
create function public.disconnect_channel(org uuid,channel_name text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 delete from social_accounts where organization_id=org and user_id=auth.uid() and provider=channel_name;
end $$;
create function public.save_channel_draft(org uuid,draft uuid,content text,expected_revision integer,target_channel text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if target_channel not in ('linkedin','x') or (target_channel='x' and length(content)>280) then raise exception 'Check channel and length';end if;
 result=save_draft(org,draft,content,expected_revision);
 update drafts set channel=target_channel where id=result;return result;
end $$;
-- Guard channel at the database boundary for every publication path, including legacy RPCs.
create function public.guard_channel_draft() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.channel='x' and length(new.body)>280 and new.status in ('approved','publishing','published') then raise exception 'X post too long';end if;
 if new.status='published' and new.channel='x' and new.linkedin_url is not null and new.linkedin_url !~ '^https://x\.com/(i/status|[A-Za-z0-9_]+/status)/[0-9]+$' then raise exception 'X URL required';end if;
 if new.status='published' and new.channel='linkedin' and new.linkedin_url is not null and new.linkedin_url !~ '^https://(www\.)?linkedin\.com/' then raise exception 'LinkedIn URL required';end if;
 return new;
end $$;
create trigger enforce_draft_channel before insert or update on drafts for each row execute function guard_channel_draft();
create function public.claim_channel_publish(draft uuid,expected_revision integer,target_channel text) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.channel is distinct from target_channel or target_channel not in ('linkedin','x') then raise exception 'Channel mismatch';end if;
 return claim_publish(draft,expected_revision);
end $$;
create function public.complete_x_publish(draft uuid,post_id text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.id is null or d.status<>'publishing' or d.channel<>'x' or post_id !~ '^[0-9]+$' then raise exception 'Invalid publication';end if;
 update drafts set status='published',publish_method='api',provider_post_id=post_id,linkedin_url='https://x.com/i/status/'||post_id,verified=true,published_at=now() where id=draft;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(d.organization_id,d.user_id,'post.published',draft);
end $$;
create function public.record_x_post(draft uuid,expected_revision integer,post_url text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or d.channel<>'x' or not can_write(d.organization_id) or d.status<>'approved' or d.revision<>expected_revision or d.approved_revision<>d.revision or not check_draft(d.organization_id,d.body) then raise exception 'Author approval required';end if;
 if post_url !~ '^https://x\.com/(i/status|[A-Za-z0-9_]+/status)/[0-9]+$' then raise exception 'X URL required';end if;
 update drafts set status='published',publish_method='manual',linkedin_url=post_url,verified=true,published_at=now() where id=draft;
end $$;
-- X access uses short-lived authorization in this pilot; scheduled X publishing is unavailable.
create function public.guard_job_channel() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from drafts where id=new.draft_id and channel<>'linkedin') then raise exception 'Only LinkedIn scheduling is enabled';end if;return new;
end $$;
create trigger enforce_job_channel before insert or update on publish_jobs for each row execute function guard_job_channel();
revoke all on function store_x_account(uuid,uuid,text,text,text,timestamptz),disconnect_channel(uuid,text),save_channel_draft(uuid,uuid,text,integer,text),guard_channel_draft(),claim_channel_publish(uuid,integer,text),complete_x_publish(uuid,text),record_x_post(uuid,integer,text),guard_job_channel() from public,anon,authenticated;
grant execute on function disconnect_channel(uuid,text),save_channel_draft(uuid,uuid,text,integer,text),claim_channel_publish(uuid,integer,text),record_x_post(uuid,integer,text) to authenticated;
grant execute on function store_x_account(uuid,uuid,text,text,text,timestamptz),complete_x_publish(uuid,text) to service_role;
