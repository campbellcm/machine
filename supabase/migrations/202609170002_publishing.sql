create function public.store_social_account(org uuid,person uuid,provider_person text,person_name text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Membership no longer eligible'; end if;
 insert into social_accounts(organization_id,user_id,provider,provider_user_id,display_name,token_encrypted,expires_at) values(org,person,'linkedin',provider_person,person_name,encrypted,expiry)
 on conflict(organization_id,user_id,provider) do update set provider_user_id=excluded.provider_user_id,display_name=excluded.display_name,token_encrypted=excluded.token_encrypted,expires_at=excluded.expires_at;
 insert into audit_log(organization_id,actor_user_id,action) values(org,person,'linkedin.connected');
end $$;
create function public.disconnect_social() returns void language plpgsql security definer set search_path=public as $$
begin delete from social_accounts where user_id=auth.uid(); end $$;
create function public.claim_publish(draft uuid,expected_revision integer) returns text language plpgsql security definer set search_path=public as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.status<>'approved' or d.revision<>expected_revision or d.approved_revision<>d.revision or not check_draft(d.organization_id,d.body) then raise exception 'Current author approval required'; end if;
 update drafts set status='publishing',updated_at=now() where id=draft;
 return d.body;
end $$;
create function public.complete_publish(draft uuid,post_id text) returns void language plpgsql security definer set search_path=public as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.status<>'publishing' or post_id !~ '^urn:li:(share|ugcPost):[0-9]+$' then raise exception 'Invalid publication'; end if;
 update drafts set status='published',publish_method='api',provider_post_id=post_id,linkedin_url='https://www.linkedin.com/feed/update/'||post_id||'/',verified=true,published_at=now() where id=draft;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(d.organization_id,d.user_id,'post.published',draft);
end $$;
revoke all on function store_social_account(uuid,uuid,text,text,text,timestamptz),disconnect_social(),claim_publish(uuid,integer),complete_publish(uuid,text) from public;
grant execute on function disconnect_social(),claim_publish(uuid,integer) to authenticated;
grant execute on function store_social_account(uuid,uuid,text,text,text,timestamptz),complete_publish(uuid,text) to service_role;
