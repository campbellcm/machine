-- Daily quantity is an employee-owned preference, not a delivery connection.
-- Existing profiles retain their default three drafts until changed.
alter table public.ce_profiles add constraint ce_daily_count_valid check(coalesce(config->>'daily_count','3') ~ '^(10|[1-9])$');
alter table public.ce_profiles add constraint ce_delivery_preference_valid check(coalesce(config->>'delivery_preference','email') in ('email','slack','imessage','whatsapp'));
create or replace function public.ce_command(org uuid,operation text,input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare person uuid:=auth.uid();result uuid;d drafts;meta ce_draft_meta;s ce_sources;op ce_opportunities;cfg jsonb;source uuid;new_body text;previous text;
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 if length(input::text)>30000 then raise exception 'Input too large';end if;
 if operation='strategy' then
  if not is_admin(org) then raise exception 'Administrator required';end if;
  cfg=input->'config';
  if not (coalesce(cfg,'{}') ?& array['enabled','review','daily_limit','monthly_limit','employee_limit']) or (cfg->>'daily_limit')::int not between 1 and 200 or (cfg->>'monthly_limit')::int not between 1 and 3000 or (cfg->>'employee_limit')::int not between 1 and 10 then raise exception 'Invalid limits';end if;
  insert into ce_settings(organization_id,enabled,config) values(org,(cfg->>'enabled')::boolean,cfg) on conflict(organization_id) do update set enabled=excluded.enabled,config=excluded.config,revision=ce_settings.revision+1;
  update ce_jobs set status='canceled' where organization_id=org and status in ('queued','running');
  update ce_draft_meta set reviewer_approved=false,state='ready_for_employee' where organization_id=org and state in ('approved','ready_for_review');
  update drafts set status='draft',approved_revision=null where id in(select draft_id from ce_draft_meta where organization_id=org and state='ready_for_employee') and status='approved';
 elsif operation='profile' then
  if member_role(org) not in ('owner','admin','teammate') then raise exception 'Not eligible';end if;
  cfg=input->'config';
  if not (coalesce(cfg,'{}') ?& array['role','platform','cadence','delivery','mode','timezone','hour']) or length(cfg->>'role') not between 2 and 120 or cfg->>'platform' not in ('linkedin','x') or cfg->>'cadence' not in ('daily','weekdays','three','weekly','manual') or cfg->>'delivery'<>'app' or cfg->>'mode' not in ('individual','weekly') or not exists(select 1 from pg_timezone_names where name=cfg->>'timezone') or (cfg->>'hour')::int not between 0 and 23 then raise exception 'Invalid profile';end if;
  insert into ce_profiles(organization_id,user_id,config,enrolled,onboarding_step) values(org,person,cfg,coalesce((input->>'consent')::boolean,false),coalesce((input->>'step')::int,6)) on conflict(organization_id,user_id) do update set config=excluded.config,enrolled=excluded.enrolled,onboarding_step=excluded.onboarding_step,revision=ce_profiles.revision+1;
  update ce_jobs set status='canceled' where organization_id=org and user_id=person and status in ('queued','running');
 elsif operation in ('pause','resume','reset_preferences','delete_profile') then
  if operation='delete_profile' then
   if input->>'confirm' is distinct from 'DELETE' then raise exception 'Confirmation required';end if;
   delete from drafts where id in(select draft_id from ce_draft_meta where organization_id=org and user_id=person);
   delete from ce_sources where organization_id=org and user_id=person;
   delete from ce_opportunities where organization_id=org and user_id=person;
   delete from ce_jobs where organization_id=org and user_id=person;
   delete from ce_events where organization_id=org and user_id=person;
   delete from ce_profiles where organization_id=org and user_id=person;
  else
   update ce_profiles set paused=case when operation='pause' then true when operation='resume' then false else paused end,preferences=case when operation='reset_preferences' then '{}'::jsonb else preferences end,revision=revision+1 where organization_id=org and user_id=person;
   if operation='pause' then update ce_jobs set status='canceled' where organization_id=org and user_id=person and status in ('queued','running');end if;
  end if;
 elsif operation='source' then
  if not ce_enabled(org,person) or input->>'consent' is distinct from 'true' then raise exception 'Opt in and approve source use';end if;
  if input->>'visibility'='organization' and not is_admin(org) then raise exception 'Administrator required for shared material';end if;
  insert into ce_sources(organization_id,user_id,title,content,visibility,roles,allowed_users,external_use) values(org,person,input->>'title',input->>'text',input->>'visibility',array(select jsonb_array_elements_text(input->'roles')),array(select jsonb_array_elements_text(coalesce(input->'allowed_users','[]'))::uuid),input->>'external_use') returning id into result;
  if input->>'external_use'<>'internal_only' then perform ce_enqueue(org,person,'extract',result,'{}','source:'||result::text);end if;
 elsif operation='delete_source' then
  select * into s from ce_sources where id=(input->>'id')::uuid and organization_id=org for update;
  if s.id is null or not (s.user_id=person or s.visibility='organization' and is_admin(org)) then raise exception 'Source unavailable';end if;
  delete from ce_sources where id=s.id;
 elsif operation='ideas' then result=ce_enqueue(org,person,'opportunities',null,'{}','ideas:'||person::text||':'||date_trunc('hour',now())::text);
 elsif operation='generate' then
  select * into op from ce_opportunities where id=(input->>'id')::uuid and organization_id=org and user_id=person and expires_at>now() and status<>'dismissed';
  if op.id is null then raise exception 'Idea unavailable';end if;
  select source_id into source from ce_atoms where id=op.atom_id;
  if not ce_source_allowed(source,person) then raise exception 'Evidence unavailable';end if;
  result=ce_enqueue(org,person,'generate',op.id,jsonb_build_object('instruction',left(coalesce(input->>'instruction',''),500)),'generate:'||person::text||':'||(input->>'key'));
 elsif operation='dismiss' then
  update ce_opportunities set status='dismissed' where id=(input->>'id')::uuid and organization_id=org and user_id=person;
 elsif operation='retry' then
  update ce_jobs set status='queued',available_at=now(),error_code=null where id=(input->>'id')::uuid and organization_id=org and user_id=person and status='failed' and attempts<3 and ce_enabled(org,person);
 else
  select * into d from drafts where id=(input->>'id')::uuid and organization_id=org for update;
  select * into meta from ce_draft_meta where draft_id=d.id;
  if meta.draft_id is null or d.revision<>coalesce((input->>'revision')::int,-1) then raise exception 'Draft changed. Refresh first';end if;
  if operation in ('review','request_changes') then
   if not is_admin(org) or meta.state<>'ready_for_review' then raise exception 'Review not permitted';end if;
   update ce_draft_meta set state=case when operation='review' then 'ready_for_employee' else 'employee_changes_requested' end,reviewer_approved=(operation='review') where draft_id=d.id;
  else
   if d.user_id<>person or not exists(select 1 from ce_profiles where organization_id=org and user_id=person and enrolled) then raise exception 'Author required';end if;
   if operation='edit' then
    if d.status in ('published','publishing','publish_uncertain') or meta.state in ('published','archived') then raise exception 'Immutable post';end if;
    new_body=input->>'body';
    if new_body is null or length(new_body) not between 1 and (case when d.channel='x' then 280 else 3000 end) then raise exception 'Invalid length';end if;
    update ce_draft_meta set state='ready_for_employee',reviewer_approved=false where draft_id=d.id;
    update drafts set body=new_body,status='draft',approved_revision=null,revision=revision+1,updated_at=now() where id=d.id;
    insert into ce_versions(organization_id,user_id,draft_id,revision,body) values(org,person,d.id,d.revision+1,new_body);
   elsif operation='approve' then
    if not ce_enabled(org,person) or meta.invalidated or meta.state not in ('ready_for_employee','employee_changes_requested') or input->>'confirmed' is distinct from 'true' then raise exception 'Review the draft and evidence first';end if;
    if not check_draft(org,d.body) then raise exception 'Employment disclosure or company policy';end if;
    if exists(select 1 from unnest(meta.source_ids) id where not ce_source_allowed(id,person)) then raise exception 'Source permission expired';end if;
    if jsonb_array_length(coalesce(meta.details->'riskFlags','[]'))>0 and input->>'risk_confirmed' is distinct from 'true' then raise exception 'Confirm flagged claims first';end if;
    select config into cfg from ce_settings where organization_id=org;
    if (coalesce((cfg->>'review')::boolean,false) or (select admin_review_required from organizations where id=org)) and not meta.reviewer_approved then
     update ce_draft_meta set state='ready_for_review' where draft_id=d.id;
    else
     update ce_draft_meta set state='approved' where draft_id=d.id;
     update drafts set status='approved',approved_revision=revision where id=d.id;
    end if;
   elsif operation in ('reject','archive') then
    if meta.state='published' then raise exception 'Published record is immutable';end if;
    update ce_draft_meta set state=case when operation='reject' then 'rejected' else 'archived' end where draft_id=d.id;
    update drafts set status='draft',approved_revision=null where id=d.id;
   elsif operation in ('more','less') then
    update ce_profiles set preferences=jsonb_set(preferences,array[coalesce(meta.details->>'evidenceTopic',meta.details->>'topic','general')],to_jsonb(greatest(-10,least(10,coalesce((preferences->>coalesce(meta.details->>'evidenceTopic',meta.details->>'topic','general'))::int,0)+case when operation='more' then 1 else -1 end)))) where organization_id=org and user_id=person;
   elsif operation in ('export','published') then
    if meta.state<>'approved' or d.status<>'approved' or d.approved_revision is distinct from d.revision or meta.invalidated or not ce_enabled(org,person) then raise exception 'Approve current text first';end if;
    if exists(select 1 from unnest(meta.source_ids) id where not ce_source_allowed(id,person)) then raise exception 'Evidence expired';end if;
    if operation='published' then
     if input->>'url' is null or input->>'confirmed' is distinct from 'true' or (d.channel='x' and input->>'url' !~ '^https://(www\.)?x\.com/[A-Za-z0-9_]+/status/[0-9]+/?$') or (d.channel='linkedin' and input->>'url' !~ '^https://(www\.)?linkedin\.com/(posts/[A-Za-z0-9_-]+/?|feed/update/urn:li:(activity|share|ugcPost):[0-9]+/?)$') then raise exception 'Confirm a valid published post URL';end if;
     update ce_draft_meta set state='published' where draft_id=d.id;
     update drafts set status='published',publish_method='manual',linkedin_url=input->>'url',published_at=now(),verified=false where id=d.id;
    end if;
   elsif operation='metrics' then
    if meta.state<>'published' or jsonb_typeof(input->'metrics') is distinct from 'object' or length((input->'metrics')::text)>3000 then raise exception 'Published post required';end if;
    if exists(select 1 from jsonb_each(input->'metrics') e where e.key not in ('impressions','reactions','comments','shares','clicks','profile_visits','followers','messages','leads','meetings','opportunities','revenue') or (e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'number' or e.value::text::numeric not between 0 and 1000000000000))) then raise exception 'Invalid metrics';end if;
    insert into ce_metrics(organization_id,user_id,draft_id,metrics,raw_metrics) values(org,person,d.id,input->'metrics',input->'metrics');
   else raise exception 'Unknown action';end if;
  end if;
  insert into ce_events(organization_id,user_id,draft_id,action,detail) values(org,d.user_id,d.id,operation,jsonb_build_object('actor',person,'reason',left(coalesce(input->>'reason',''),300),'edit_distance',input->'edit_distance'));
 end if;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(org,person,'ai.'||operation,coalesce(result,d.id));
 return jsonb_build_object('id',result,'ok',true) || case when operation='export' then jsonb_build_object('body',d.body) else '{}'::jsonb end;
end$$;

create or replace function public.ce_tick() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p ce_profiles;localday date;dow int;hour int;nexttime timestamptz;
begin
 delete from ce_sources where expires_at<now();
 update ce_jobs set status='failed',error_code='retry_exhausted' where status='running' and available_at<now() and attempts>=3;
 for p in select * from ce_profiles where enrolled and not paused and next_run_at<=now() order by next_run_at limit 50 for update skip locked loop
  localday=(now() at time zone coalesce(p.config->>'timezone','UTC'))::date;
  dow=extract(isodow from localday);hour=extract(hour from now() at time zone coalesce(p.config->>'timezone','UTC'));
  if ce_enabled(p.organization_id,p.user_id) and hour>=coalesce((p.config->>'hour')::int,9) and (p.config->>'cadence'='daily' or p.config->>'cadence'='weekdays' and dow<=5 or p.config->>'cadence'='three' and dow in (1,3,5) or p.config->>'cadence'='weekly' and dow=1) then
   begin perform ce_enqueue(p.organization_id,p.user_id,'opportunities',null,'{"daily":true}', 'daily:'||p.user_id::text||':'||localday::text);exception when others then null;end;
  end if;
  nexttime=((localday+case when hour>=coalesce((p.config->>'hour')::int,9) then 1 else 0 end)::timestamp+make_interval(hours=>coalesce((p.config->>'hour')::int,9))) at time zone coalesce(p.config->>'timezone','UTC');
  update ce_profiles set next_run_at=nexttime where organization_id=p.organization_id and user_id=p.user_id;
 end loop;
end$$;

create or replace function public.ce_finish(job uuid,claim uuid,result jsonb,usage jsonb,failure text default null) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare j ce_jobs;s ce_sources;p ce_profiles;cfg ce_settings;a jsonb;i int:=0;did uuid;oid uuid;src uuid;atoms uuid[];sources uuid[];v jsonb;op ce_opportunities;expected_count int;
begin
 select * into j from ce_jobs where id=job;
 select * into cfg from ce_settings where organization_id=j.organization_id for update;
 select * into j from ce_jobs where id=job for update;
 if j.status<>'running' or j.lease<>claim then return false;end if;
 select * into p from ce_profiles where organization_id=j.organization_id and user_id=j.user_id;
 if not ce_enabled(j.organization_id,j.user_id) or p.revision<>(j.payload->>'profile_revision')::int or cfg.revision<>(j.payload->>'settings_revision')::int then update ce_jobs set status='canceled' where id=job;return false;end if;
 if failure is not null then
  update ce_jobs set status=case when attempts<3 then 'queued' else 'failed' end,error_code=case when failure in ('provider_unavailable','invalid_output','no_context') then failure else 'generation_failed' end,usage=ce_finish.usage,available_at=now()+make_interval(mins=>power(2,attempts)::int*5) where id=job;
  update ce_sources set status='failed' where id=j.target_id and j.kind='extract';return false;
 end if;
 if j.kind='extract' then
  select * into s from ce_sources where id=j.target_id and ce_source_allowed(id,j.user_id) for update;
  if s.id is null then update ce_jobs set status='canceled' where id=job;return false;end if;
  for a in select * from jsonb_array_elements(result->'atoms') loop
   if position(a->>'excerpt' in s.content)=0 or length(a->>'excerpt')<5 then raise exception 'Unsupported evidence';end if;
   insert into ce_atoms(organization_id,source_id,ordinal,type,summary,excerpt,topics,roles,confidence,external_use,model,prompt_version,expires_at) values(j.organization_id,s.id,i,a->>'type',a->>'summary',a->>'excerpt',array(select jsonb_array_elements_text(a->'topics')),s.roles,(a->>'confidence')::numeric,s.external_use,usage->>'model','extract-v1',s.expires_at) on conflict(source_id,ordinal) do nothing;i=i+1;
  end loop;
  update ce_sources set status='ready' where id=s.id;
 elsif j.kind='opportunities' then
  for a in select * from jsonb_array_elements(result->'opportunities') loop
   select source_id into src from ce_atoms where id=(a->>'atom_id')::uuid and organization_id=j.organization_id and expires_at>now();
   if src is null or not ce_source_allowed(src,j.user_id) then continue;end if;
   insert into ce_opportunities(organization_id,user_id,atom_id,title,rationale,scores,expires_at) select j.organization_id,j.user_id,id,a->>'title',a->>'rationale',a->'scores',expires_at from ce_atoms where id=(a->>'atom_id')::uuid on conflict(organization_id,user_id,atom_id) do update set scores=excluded.scores returning id into oid;
   if i=0 and j.payload->>'daily'='true' then
    begin perform ce_enqueue(j.organization_id,j.user_id,'generate',oid,'{}','daily-draft:'||job::text);exception when others then null;end;
   end if;i=i+1;
  end loop;
 else
  select * into op from ce_opportunities where id=j.target_id;
  select array_agg(id),array_agg(source_id) into atoms,sources from ce_atoms where id=op.atom_id and organization_id=j.organization_id and expires_at>now() and ce_source_allowed(source_id,j.user_id);
  if cardinality(atoms) is null then update ce_jobs set status='canceled' where id=job;return false;end if;
  for v in select * from jsonb_array_elements(result->'variants') loop
   expected_count=coalesce((p.config->>'daily_count')::int,3);
   if i>=expected_count then raise exception 'Unexpected extra drafts';end if;
   if not check_draft(j.organization_id,v->>'body') then raise exception 'Disclosure or policy';end if;
   insert into drafts(organization_id,user_id,body,channel,prompt_version,claims) values(j.organization_id,j.user_id,v->>'body',p.config->>'platform','content-v2',array(select jsonb_array_elements_text(v->'riskFlags'))) returning id into did;
   insert into ce_draft_meta(draft_id,organization_id,user_id,opportunity_id,job_id,source_ids,atom_ids,details) values(did,j.organization_id,j.user_id,op.id,job,sources,atoms,(result-'variants')||v||jsonb_build_object('model',usage->>'model','prompt_version','content-v2','evidenceTopic',op.title));
   insert into ce_versions(organization_id,user_id,draft_id,revision,body) values(j.organization_id,j.user_id,did,1,v->>'body');i=i+1;
  end loop;
  if i<>coalesce((p.config->>'daily_count')::int,3) then raise exception 'Requested draft count required';end if;
  update ce_opportunities set status='drafted' where id=op.id;
 end if;
 update ce_jobs set status='completed',completed_at=now(),usage=ce_finish.usage,error_code=null where id=job;
 return true;
end$$;
