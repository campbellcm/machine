create table public.slack_delivery_accounts (
 organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 team_id text not null,slack_user_id text not null,token_encrypted text not null,expires_at timestamptz,connected_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create table public.draft_deliveries (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,user_id uuid not null,
 job_id uuid not null unique references ce_jobs on delete cascade,channel text not null check(channel in ('email','slack')),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','uncertain','canceled')),
 attempts int not null default 0,lease uuid,started_at timestamptz,first_attempt_at timestamptz,created_at timestamptz not null default now(),sent_at timestamptz,
 issue text,foreign key(organization_id,user_id) references ce_profiles(organization_id,user_id) on delete cascade
);
alter table slack_delivery_accounts enable row level security;
alter table draft_deliveries enable row level security;
revoke all on slack_delivery_accounts,draft_deliveries from public,anon,authenticated;
grant all on slack_delivery_accounts,draft_deliveries to service_role;
grant select on draft_deliveries to authenticated;
create policy own_delivery_history on draft_deliveries for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create function public.store_slack_delivery(org uuid,person uuid,team text,slack_person text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtext('slack:'||team||':'||slack_person));
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Eligible member required';end if;
 if exists(select 1 from slack_delivery_accounts where team_id=team and slack_user_id=slack_person and user_id<>person) then raise exception 'Account already linked';end if;
 insert into slack_delivery_accounts(organization_id,user_id,team_id,slack_user_id,token_encrypted,expires_at) values(org,person,team,slack_person,encrypted,expiry)
 on conflict(organization_id,user_id) do update set team_id=excluded.team_id,slack_user_id=excluded.slack_user_id,token_encrypted=excluded.token_encrypted,expires_at=excluded.expires_at,connected_at=now();
end $$;
create function public.slack_delivery_status(org uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return coalesce((select jsonb_build_object('connected',expires_at is null or expires_at>now(),'team',team_id,'connected_at',connected_at) from slack_delivery_accounts where organization_id=org and user_id=auth.uid()),'{"connected":false}'::jsonb);
end $$;
create function public.disconnect_slack_delivery(org uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from slack_delivery_accounts where organization_id=org and user_id=auth.uid();
 update draft_deliveries set status='canceled' where organization_id=org and user_id=auth.uid() and channel='slack' and status='pending';
end $$;
create function public.enqueue_draft_delivery() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare preference text;
begin
 if new.status='completed' and old.status is distinct from new.status and new.kind='generate' and new.idempotency_key like 'daily-draft:%' and ce_enabled(new.organization_id,new.user_id) then
  select config->>'delivery_preference' into preference from ce_profiles where organization_id=new.organization_id and user_id=new.user_id;
  if preference in ('email','slack') then insert into draft_deliveries(organization_id,user_id,job_id,channel) values(new.organization_id,new.user_id,new.id,preference) on conflict(job_id) do nothing;end if;
 end if;return new;
end $$;
create trigger notify_daily_drafts after update on ce_jobs for each row execute function enqueue_draft_delivery();
create function public.claim_draft_delivery(delivery uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d draft_deliveries;claim uuid;
begin
 select * into d from draft_deliveries where id=delivery for update skip locked;
 if d.id is null or d.status not in ('pending','sending') or (d.status='sending' and d.started_at>now()-interval '2 minutes') then return null;end if;
 if d.channel='slack' and d.status='sending' then update draft_deliveries set status='uncertain',issue='Check Slack before any further action' where id=delivery;return null;end if;
 if d.attempts>=3 or d.first_attempt_at<now()-interval '20 hours' then update draft_deliveries set status='failed',issue='Delivery attempt limit reached' where id=delivery;return null;end if;
 perform 1 from memberships where organization_id=d.organization_id and user_id=d.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then update draft_deliveries set status='canceled' where id=delivery;return null;end if;
 if not ce_enabled(d.organization_id,d.user_id) or not exists(select 1 from ce_profiles where organization_id=d.organization_id and user_id=d.user_id and config->>'delivery_preference'=d.channel) or not exists(select 1 from ce_draft_meta where job_id=d.job_id and not invalidated and state not in ('archived','rejected','published') and not exists(select 1 from unnest(source_ids) src where not ce_source_allowed(src,d.user_id))) then update draft_deliveries set status='canceled' where id=delivery;return null;end if;
 claim=gen_random_uuid();
 update draft_deliveries set status='sending',attempts=attempts+1,lease=claim,started_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) where id=delivery;
 return jsonb_build_object('id',d.id,'organization_id',d.organization_id,'user_id',d.user_id,'channel',d.channel,'lease',claim);
end $$;
create function public.finish_draft_delivery(delivery uuid,claim uuid,outcome text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if outcome not in ('sent','failed','uncertain') then raise exception 'Invalid outcome';end if;
 update draft_deliveries set status=outcome,sent_at=case when outcome='sent' then now() else null end,issue=case when outcome='sent' then null when outcome='uncertain' then 'Delivery uncertain; check your destination' else 'Check delivery setup and connection' end where id=delivery and lease=claim and status='sending';
 return found;
end $$;
create function public.cleanup_delivery_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.removed_at is not null or new.opted_in_at is null or new.role not in ('owner','admin','teammate') then
 delete from slack_delivery_accounts where organization_id=new.organization_id and user_id=new.user_id;
 update draft_deliveries set status='canceled' where organization_id=new.organization_id and user_id=new.user_id and status in ('pending','sending');
 end if;return new;
end $$;
create trigger cleanup_delivery after update on memberships for each row execute function cleanup_delivery_membership();
revoke all on function store_slack_delivery(uuid,uuid,text,text,text,timestamptz),slack_delivery_status(uuid),disconnect_slack_delivery(uuid),enqueue_draft_delivery(),claim_draft_delivery(uuid),finish_draft_delivery(uuid,uuid,text),cleanup_delivery_membership() from public,anon,authenticated;
grant execute on function store_slack_delivery(uuid,uuid,text,text,text,timestamptz),claim_draft_delivery(uuid),finish_draft_delivery(uuid,uuid,text) to service_role;
grant execute on function slack_delivery_status(uuid),disconnect_slack_delivery(uuid) to authenticated;
