-- Author-approved engine posts may use the existing guarded publishing paths.
create or replace function public.ce_draft_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare m ce_draft_meta;
begin
 select * into m from ce_draft_meta where draft_id=new.id;
 if m.draft_id is null then return new;end if;
 if old.status in ('publishing','publish_uncertain') and new.status not in ('publishing','publish_uncertain','published') and not (old.status='publishing' and new.status='approved' and current_setting('role',true)='service_role') then raise exception 'Delivery lock must be preserved';end if;
 if new.status='published' and old.status<>'publishing' and m.state<>'published' then raise exception 'Use approved engine publication';end if;
 if old.status='published' and new.body<>old.body then raise exception 'Published text is immutable';end if;
 if new.status='draft' and m.state='approved' then update ce_draft_meta set state='ready_for_employee',reviewer_approved=false where draft_id=new.id;end if;
 if new.body<>old.body then
  update ce_draft_meta set reviewer_approved=false,state='ready_for_employee' where draft_id=new.id;
  new.status='draft';new.approved_revision=null;
 end if;
 if new.status in ('approved','publishing','published') then
  if m.state not in ('approved','published') or m.invalidated or not ce_enabled(m.organization_id,m.user_id) or exists(select 1 from unnest(m.source_ids) id where not ce_source_allowed(id,m.user_id)) then raise exception 'AI review and valid evidence required';end if;
 end if;
 if new.status='published' and old.status='publishing' then update ce_draft_meta set state='published' where draft_id=new.id;end if;
 return new;
end $$;
create or replace function public.guard_job_channel() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from drafts where id=new.draft_id and channel not in ('linkedin','x')) then raise exception 'Unsupported channel';end if;return new;
end $$;
create or replace function public.schedule_post(draft uuid,expected_revision integer,publish_at timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.status<>'approved' or d.approved_revision<>d.revision or d.revision<>expected_revision or not check_draft(d.organization_id,d.body) then raise exception 'Current author approval required'; end if;
 if publish_at<now()+interval '1 minute' or publish_at>now()+interval '90 days' then raise exception 'Schedule between 1 minute and 90 days ahead'; end if;
 if not exists(select 1 from social_accounts where organization_id=d.organization_id and user_id=d.user_id and provider=d.channel and connection_issue is distinct from 'reconnect' and (expires_at>publish_at or (d.channel='x' and refresh_token_encrypted is not null))) then raise exception 'Reconnect the selected channel before scheduling';end if;
 update drafts set updated_at=now() where id=draft;
 insert into publish_jobs(organization_id,draft_id,user_id,revision,run_at) values(d.organization_id,draft,d.user_id,d.revision,publish_at)
 on conflict(draft_id) do update set revision=excluded.revision,run_at=excluded.run_at,status='pending' where publish_jobs.status not in ('running','done');
end $$;
create or replace function public.claim_scheduled_post(job uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j publish_jobs;d drafts;
begin
 select * into j from publish_jobs where id=job and status='pending' and run_at<=now() for update skip locked;
 if j.id is null then return null;end if;
 select * into d from drafts where id=j.draft_id for update;
 if d.id is null or d.status<>'approved' or d.revision<>j.revision or d.approved_revision<>j.revision or not check_draft(d.organization_id,d.body) or not exists(select 1 from memberships where organization_id=j.organization_id and user_id=j.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate')) then update publish_jobs set status='canceled' where id=job;return null;end if;
 update drafts set status='publishing',updated_at=now() where id=d.id;
 update publish_jobs set status='running' where id=job;
 return jsonb_build_object('id',d.id,'body',d.body,'organization_id',d.organization_id,'user_id',d.user_id,'channel',d.channel,'revision',d.revision);
end $$;

create or replace function public.ce_invalidate_source() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update ce_draft_meta set invalidated=true,state=case when state='published' then state else 'archived' end,details=details-'sourceSummaries'-'claimChecks' where old.id=any(source_ids);
 update drafts set status='draft',approved_revision=null where id in(select draft_id from ce_draft_meta where old.id=any(source_ids) and state='archived') and status not in ('publishing','publish_uncertain');
 update ce_jobs set status='canceled' where target_id=old.id or target_id in(select id from ce_opportunities where atom_id in(select id from ce_atoms where source_id=old.id));
 return old;
end$$;
