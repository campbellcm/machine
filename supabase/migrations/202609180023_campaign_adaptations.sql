-- Channel adaptations retain evidence and create separately reviewed drafts.
create function public.adapt_content(draft uuid,platform text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare d drafts;m ce_draft_meta;result uuid;
begin
 select * into d from drafts where id=draft;
 select * into m from ce_draft_meta where draft_id=draft;
 if d.user_id is distinct from auth.uid() or m.draft_id is null or m.invalidated or not ce_enabled(d.organization_id,auth.uid()) or platform is null or platform not in ('linkedin','x') or platform=d.channel then raise exception 'Author and different supported channel required';end if;
 if exists(select 1 from unnest(m.source_ids) id where not ce_source_allowed(id,auth.uid())) then raise exception 'Evidence expired';end if;
 result=ce_enqueue(d.organization_id,auth.uid(),'generate',m.opportunity_id,jsonb_build_object('platform',platform,'instruction','Adapt this evidence-backed idea for the selected channel; do not copy an existing post verbatim.'),'adapt:'||draft::text||':'||d.revision::text||':'||platform);
 return result;
end $$;
create function public.create_campaign_brief(org uuid,title text,objective text,audience text,facts text,cta text,approved boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb;result jsonb;
begin
 if not is_admin(org) or not ce_enabled(org,auth.uid()) or approved is distinct from true then raise exception 'Enrolled admin approval required';end if;
 if length(title) not between 3 and 120 or length(objective) not between 3 and 400 or length(audience) not between 3 and 400 or length(cta) not between 3 and 400 or length(facts) not between 30 and 12000 then raise exception 'Complete a concise brief';end if;
 select config into cfg from ce_settings where organization_id=org for update;
 perform ce_command(org,'strategy',jsonb_build_object('config',cfg||jsonb_build_object('campaigns','Campaign: '||title||E'\nObjective: '||objective||E'\nAudience: '||audience||E'\nCall to action: '||cta)));
 result=ce_command(org,'source',jsonb_build_object('title','Campaign: '||title,'text',facts,'visibility','organization','roles','[]'::jsonb,'allowed_users','[]'::jsonb,'external_use','approved_fact','consent',true));
 return result;
end $$;
revoke all on function adapt_content(uuid,text),create_campaign_brief(uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function adapt_content(uuid,text),create_campaign_brief(uuid,text,text,text,text,text,boolean) to authenticated;
create or replace function public.ce_claim(job uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j ce_jobs;cfg ce_settings;p ce_profiles;s ce_sources;o ce_opportunities;evidence jsonb;
begin
 select * into j from ce_jobs where id=job;
 if j.id is null then return null;end if;
 select * into cfg from ce_settings where organization_id=j.organization_id for update;
 select * into j from ce_jobs where id=job for update;
 if j.status not in ('queued','running') or j.available_at>now() or j.attempts>=3 then return null;end if;
 if not ce_enabled(j.organization_id,j.user_id) then update ce_jobs set status='canceled' where id=job;return null;end if;
 if exists(select 1 from ce_jobs where organization_id=j.organization_id and id<>job and status='running' and available_at>now()) then return null;end if;
 select * into p from ce_profiles where organization_id=j.organization_id and user_id=j.user_id;
 if j.kind='extract' then
  select * into s from ce_sources where id=j.target_id and organization_id=j.organization_id and external_use<>'internal_only' and ce_source_allowed(id,j.user_id);
  if s.id is null then update ce_jobs set status='canceled' where id=job;return null;end if;
  evidence=to_jsonb(s);
 elsif j.kind='generate' then
  select * into o from ce_opportunities where id=j.target_id and organization_id=j.organization_id and user_id=j.user_id and expires_at>now() and status<>'dismissed';
  if o.id is null then update ce_jobs set status='canceled' where id=job;return null;end if;
  select jsonb_agg(to_jsonb(a)||jsonb_build_object('source_title',src_table.title)) into evidence from ce_atoms a join ce_sources src_table on src_table.id=a.source_id where a.id=o.atom_id and a.organization_id=j.organization_id and a.expires_at>now() and a.external_use<>'internal_only' and ce_source_allowed(a.source_id,j.user_id);
 else
  select jsonb_agg(to_jsonb(a)) into evidence from (select a.* from ce_atoms a where a.organization_id=j.organization_id and a.expires_at>now() and a.external_use<>'internal_only' and ce_source_allowed(a.source_id,j.user_id) order by a.created_at desc limit 40) a;
 end if;
 update ce_jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),started_at=now(),available_at=now()+interval '2 minutes',payload=payload||jsonb_build_object('profile_revision',p.revision,'settings_revision',cfg.revision) where id=job returning * into j;
 return jsonb_build_object('job',to_jsonb(j),'strategy',cfg.config,'profile',p.config||case when j.payload->>'platform' in ('linkedin','x') then jsonb_build_object('platform',j.payload->>'platform') else '{}'::jsonb end,'preferences',p.preferences,'company',(select name from organizations where id=j.organization_id),'evidence',coalesce(evidence,'[]'),'opportunity',to_jsonb(o),'recent',coalesce((select jsonb_agg(coalesce(details->>'evidenceTopic',details->>'topic')) from (select details from ce_draft_meta where organization_id=j.organization_id and user_id=j.user_id order by created_at desc limit 12) d),'[]'));
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
   if coalesce(j.payload->>'platform',p.config->>'platform')='x' and length(v->>'body')>280 then raise exception 'X character limit';end if;
   if not check_draft(j.organization_id,v->>'body') then raise exception 'Disclosure or policy';end if;
   insert into drafts(organization_id,user_id,body,channel,prompt_version,claims) values(j.organization_id,j.user_id,v->>'body',coalesce(j.payload->>'platform',p.config->>'platform'),'content-v2',array(select jsonb_array_elements_text(v->'riskFlags'))) returning id into did;
   insert into ce_draft_meta(draft_id,organization_id,user_id,opportunity_id,job_id,source_ids,atom_ids,details) values(did,j.organization_id,j.user_id,op.id,job,sources,atoms,(result-'variants')||v||jsonb_build_object('model',usage->>'model','prompt_version','content-v2','evidenceTopic',op.title));
   insert into ce_versions(organization_id,user_id,draft_id,revision,body) values(j.organization_id,j.user_id,did,1,v->>'body');i=i+1;
  end loop;
  if i<>coalesce((p.config->>'daily_count')::int,3) then raise exception 'Requested draft count required';end if;
  update ce_opportunities set status='drafted' where id=op.id;
 end if;
 update ce_jobs set status='completed',completed_at=now(),usage=ce_finish.usage,error_code=null where id=job;
 return true;
end$$;
