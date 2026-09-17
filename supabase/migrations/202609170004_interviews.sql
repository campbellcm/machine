alter table interviews add column generated_at timestamptz;
alter table interviews add column generation_started_at timestamptz;
create function public.save_interview(org uuid,interview uuid,topic text,question text,answer text,expected_answers integer) returns uuid language plpgsql security definer set search_path=public as $$
declare i interviews;result uuid;
begin
 if not can_write(org) then raise exception 'Opt in first'; end if;
 if interview is null then
 insert into interviews(organization_id,user_id,focus) values(org,auth.uid(),left(topic,500)) returning id into result;return result;
 end if;
 select * into i from interviews where id=interview and organization_id=org and user_id=auth.uid() for update;
 if i.id is null or i.created_at<now()-interval '7 days' or i.generated_at is not null or i.generation_started_at is not null or jsonb_array_length(i.answers)>=8 or jsonb_array_length(i.answers)<>expected_answers then raise exception 'Interview unavailable or changed'; end if;
 if length(answer) not between 1 and 6000 or length(question)>400 then raise exception 'Answer must be 1 to 6000 characters'; end if;
 update interviews set answers=answers||jsonb_build_array(jsonb_build_object('question',question,'answer',answer)) where id=interview;
 return interview;
end $$;
create function public.claim_generation(interview uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update interviews set generation_started_at=now() where id=interview and user_id=auth.uid() and can_write(organization_id) and created_at>now()-interval '7 days' and jsonb_array_length(answers)>=3 and generated_at is null and (generation_started_at is null or generation_started_at<now()-interval '5 minutes');
 return found;
end $$;
create function public.complete_generation(interview uuid,items jsonb) returns void language plpgsql security definer set search_path=public as $$
declare i interviews;item jsonb;
begin
 select * into i from interviews where id=interview for update;
 if i.id is null or i.generated_at is not null or i.generation_started_at is null or not exists(select 1 from memberships where organization_id=i.organization_id and user_id=i.user_id and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate')) then raise exception 'Interview unavailable'; end if;
 if jsonb_array_length(items)<>3 then raise exception 'Three drafts required'; end if;
 for item in select * from jsonb_array_elements(items) loop
 insert into drafts(organization_id,user_id,body,claims) values(i.organization_id,i.user_id,item->>'body',array(select jsonb_array_elements_text(item->'claims_to_verify')));
 end loop;
 update interviews set generated_at=now(),generation_started_at=null where id=interview;
end $$;
revoke all on function save_interview(uuid,uuid,text,text,text,integer),claim_generation(uuid),complete_generation(uuid,jsonb) from public;
grant execute on function save_interview(uuid,uuid,text,text,text,integer),claim_generation(uuid) to authenticated;
grant execute on function complete_generation(uuid,jsonb) to service_role;
