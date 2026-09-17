-- V1 daily drafts: private preferences and an atomic, bounded daily job ledger.
create table public.daily_schedules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 user_id uuid not null references auth.users on delete cascade, provider text not null check(provider in ('openai','anthropic')),
 channel text not null check(channel in ('linkedin','x')), timezone text not null,
 delivery_hour integer not null check(delivery_hour between 0 and 23), context text not null check(length(context) between 20 and 6000),
 enabled boolean not null default false, revision integer not null default 1, next_run_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(organization_id,user_id)
);
create table public.daily_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 schedule_id uuid not null references daily_schedules on delete cascade,user_id uuid not null references auth.users on delete cascade,
 local_date date not null, status text not null check(status in ('running','completed','failed','canceled')),
 attempt integer not null default 1 check(attempt between 1 and 3), lease uuid not null default gen_random_uuid(),
 schedule_revision integer not null, started_at timestamptz not null default now(), finished_at timestamptz,
 error_code text check(error_code in ('provider_unavailable','generation_failed','context_changed')),
 unique(schedule_id,local_date)
);
alter table drafts add column channel text not null default 'linkedin' check(channel in ('linkedin','x'));
alter table drafts add column daily_run_id uuid references daily_runs on delete set null;
alter table drafts add column prompt_version text;
alter table daily_schedules enable row level security;
alter table daily_runs enable row level security;
revoke all on daily_schedules,daily_runs from public,anon,authenticated;
grant select on daily_schedules,daily_runs to authenticated;
grant all on daily_schedules,daily_runs to service_role;
create policy own_schedule on daily_schedules for select to authenticated using(user_id=auth.uid() and can_write(organization_id));
create policy own_runs on daily_runs for select to authenticated using(user_id=auth.uid() and can_write(organization_id));
create index daily_due on daily_schedules(next_run_at) where enabled;
create function public.save_daily_schedule(org uuid,ai_provider text,target_channel text,tz text,hour integer,approved_context text,active boolean) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; scheduled timestamptz;
begin
 if not can_write(org) then raise exception 'Opt in first'; end if;
 if not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Invalid timezone'; end if;
 scheduled=((now() at time zone tz)::date+make_time(hour,0,0)) at time zone tz;
 if scheduled<=now() then scheduled=(((now() at time zone tz)::date+1)+make_time(hour,0,0)) at time zone tz; end if;
 insert into daily_schedules(organization_id,user_id,provider,channel,timezone,delivery_hour,context,enabled,next_run_at)
 values(org,auth.uid(),ai_provider,target_channel,tz,hour,approved_context,active,scheduled)
 on conflict(organization_id,user_id) do update set provider=excluded.provider,channel=excluded.channel,timezone=excluded.timezone,delivery_hour=excluded.delivery_hour,context=excluded.context,enabled=excluded.enabled,next_run_at=excluded.next_run_at,revision=daily_schedules.revision+1,updated_at=now() returning id into result;
 return result;
end $$;
create function public.control_daily_schedule(org uuid,operation text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not can_write(org) then raise exception 'Opt in first'; end if;
 if operation='pause' then update daily_schedules set enabled=false,revision=revision+1,updated_at=now() where organization_id=org and user_id=auth.uid();
 elsif operation='run' then update daily_schedules set enabled=true,next_run_at=now(),updated_at=now() where organization_id=org and user_id=auth.uid();
 else raise exception 'Invalid operation'; end if;
end $$;
create function public.claim_daily_run(schedule uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s daily_schedules;r daily_runs;day date;
begin
 select * into s from daily_schedules where id=schedule and enabled and next_run_at<=now() for update skip locked;
 if s.id is null then return null; end if;
 if not exists(select 1 from memberships where organization_id=s.organization_id and user_id=s.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate')) then
 update daily_schedules set enabled=false where id=s.id;return null;end if;
 day=(now() at time zone s.timezone)::date;
 select * into r from daily_runs where schedule_id=s.id and local_date=day for update;
 if r.id is not null and r.status='running' and r.started_at>now()-interval '5 minutes' then
 update daily_schedules set next_run_at=r.started_at+interval '5 minutes' where id=s.id;return null;end if;
 if r.id is not null and (r.status='completed' or r.attempt>=3) then
 if r.status='running' and r.started_at<now()-interval '5 minutes' then update daily_runs set status='failed',error_code='generation_failed',finished_at=now() where id=r.id;end if;
 update daily_schedules set next_run_at=((day+1)+make_time(s.delivery_hour,0,0)) at time zone s.timezone where id=s.id;return null;end if;
 insert into daily_runs(organization_id,schedule_id,user_id,local_date,status,schedule_revision)
 values(s.organization_id,s.id,s.user_id,day,'running',s.revision)
 on conflict(schedule_id,local_date) do update set status='running',attempt=daily_runs.attempt+1,lease=gen_random_uuid(),schedule_revision=s.revision,started_at=now(),finished_at=null,error_code=null returning * into r;
 update daily_schedules set next_run_at=now()+interval '5 minutes' where id=s.id;
 return jsonb_build_object('run_id',r.id,'lease',r.lease,'organization_id',s.organization_id,'user_id',s.user_id,'provider',s.provider,'channel',s.channel,'context',s.context,'local_date',day);
end $$;
create function public.finish_daily_run(run uuid,claim uuid,items jsonb,failure text default null) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r daily_runs;s daily_schedules;item jsonb;
begin
 select * into r from daily_runs where id=run and lease=claim and status='running';
 if r.id is null then return false;end if;
 select * into s from daily_schedules where id=r.schedule_id for update;
 select * into r from daily_runs where id=run and lease=claim and status='running' for update;
 if r.id is null then return false;end if;
 if not s.enabled or s.revision<>r.schedule_revision or not exists(select 1 from memberships where organization_id=r.organization_id and user_id=r.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate')) then
 update daily_runs set status='canceled',error_code='context_changed',finished_at=now() where id=run;return false;end if;
 if failure is not null then
 update daily_runs set status='failed',error_code=failure,finished_at=now() where id=run;
 update daily_schedules set next_run_at=case when r.attempt<3 then now()+interval '15 minutes' else (((now() at time zone s.timezone)::date+1)+make_time(s.delivery_hour,0,0)) at time zone s.timezone end where id=s.id;
 return false;end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)<>3 then raise exception 'Three drafts required';end if;
 for item in select * from jsonb_array_elements(items) loop
 if not check_draft(r.organization_id,item->>'body') or (s.channel='x' and length(item->>'body')>280) then raise exception 'Invalid draft';end if;
 insert into drafts(organization_id,user_id,body,claims,channel,daily_run_id,prompt_version) values(r.organization_id,r.user_id,item->>'body',array(select jsonb_array_elements_text(item->'claims_to_verify')),s.channel,run,'daily-v1');
 end loop;
 update daily_runs set status='completed',finished_at=now() where id=run;
 update daily_schedules set next_run_at=(((now() at time zone s.timezone)::date+1)+make_time(s.delivery_hour,0,0)) at time zone s.timezone where id=s.id;
 return true;
end $$;
-- Delete private scheduling context when consent or eligible membership is removed.
create function public.clean_daily_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.removed_at is not null or new.opted_in_at is null or new.role not in ('owner','admin','teammate') then
 delete from daily_schedules where organization_id=new.organization_id and user_id=new.user_id;
 end if;return new;
end $$;
create trigger daily_membership_cleanup after update on memberships for each row execute function clean_daily_membership();
revoke all on function save_daily_schedule(uuid,text,text,text,integer,text,boolean),control_daily_schedule(uuid,text),claim_daily_run(uuid),finish_daily_run(uuid,uuid,jsonb,text),clean_daily_membership() from public,anon,authenticated;
grant execute on function save_daily_schedule(uuid,text,text,text,integer,text,boolean),control_daily_schedule(uuid,text) to authenticated;
grant execute on function claim_daily_run(uuid),finish_daily_run(uuid,uuid,jsonb,text) to service_role;
