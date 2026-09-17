create table public.publish_jobs (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,
 draft_id uuid not null unique,user_id uuid not null,revision integer not null,run_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','running','done','failed','canceled')),
 foreign key(organization_id,draft_id) references drafts(organization_id,id) on delete cascade
);
create table public.rate_buckets (key_hash text primary key,window_start timestamptz not null,hits integer not null);
alter table publish_jobs enable row level security;
alter table rate_buckets enable row level security;
revoke all on publish_jobs,rate_buckets from public,anon,authenticated;
grant select on publish_jobs to authenticated;
grant all on publish_jobs,rate_buckets to service_role;
create policy jobs_read on publish_jobs for select to authenticated using(user_id=auth.uid() and can_write(organization_id));
create function public.schedule_post(draft uuid,expected_revision integer,publish_at timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.status<>'approved' or d.approved_revision<>d.revision or d.revision<>expected_revision or not check_draft(d.organization_id,d.body) then raise exception 'Current author approval required'; end if;
 if publish_at<now()+interval '1 minute' or publish_at>now()+interval '90 days' then raise exception 'Schedule between 1 minute and 90 days ahead'; end if;
 if not exists(select 1 from social_accounts where organization_id=d.organization_id and user_id=d.user_id and expires_at>publish_at) then raise exception 'Reconnect LinkedIn before scheduling'; end if;
 insert into publish_jobs(organization_id,draft_id,user_id,revision,run_at) values(d.organization_id,draft,d.user_id,d.revision,publish_at)
 on conflict(draft_id) do update set revision=excluded.revision,run_at=excluded.run_at,status='pending' where publish_jobs.status not in ('running','done');
end $$;
create function public.cancel_scheduled_post(draft uuid) returns void language plpgsql security definer set search_path=public as $$
begin update publish_jobs set status='canceled' where draft_id=draft and user_id=auth.uid() and status='pending';end $$;
create function public.claim_scheduled_post(job uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare j publish_jobs;d drafts;
begin
 select * into j from publish_jobs where id=job and status='pending' and run_at<=now() for update skip locked;
 if j.id is null then return null;end if;
 select * into d from drafts where id=j.draft_id for update;
 if d.id is null or d.status<>'approved' or d.revision<>j.revision or d.approved_revision<>j.revision or not check_draft(d.organization_id,d.body) or not exists(select 1 from memberships where organization_id=j.organization_id and user_id=j.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate')) then update publish_jobs set status='canceled' where id=job;return null;end if;
 update drafts set status='publishing',updated_at=now() where id=d.id;
 update publish_jobs set status='running' where id=job;
 return jsonb_build_object('id',d.id,'body',d.body,'organization_id',d.organization_id,'user_id',d.user_id);
end $$;
create function public.allow_request(bucket text,maximum integer,seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare count integer;
begin
 insert into rate_buckets(key_hash,window_start,hits) values(bucket,now(),1)
 on conflict(key_hash) do update set hits=case when rate_buckets.window_start<now()-make_interval(secs=>seconds) then 1 else rate_buckets.hits+1 end,window_start=case when rate_buckets.window_start<now()-make_interval(secs=>seconds) then now() else rate_buckets.window_start end returning hits into count;
 return count<=maximum;
end $$;
revoke all on function schedule_post(uuid,integer,timestamptz),cancel_scheduled_post(uuid),claim_scheduled_post(uuid),allow_request(text,integer,integer) from public,anon,authenticated;
grant execute on function schedule_post(uuid,integer,timestamptz),cancel_scheduled_post(uuid) to authenticated;
grant execute on function claim_scheduled_post(uuid),allow_request(text,integer,integer) to service_role;
