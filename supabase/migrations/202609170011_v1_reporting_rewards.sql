-- Safe company-facing projections; credentials and unpublished drafts remain private.
create function public.team_connections(org uuid) returns table(user_id uuid,display_name text,job_title text,role text,linkedin_name text,linkedin_expires timestamptz,x_name text,x_expires timestamptz) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return query select m.user_id,m.display_name,m.job_title,m.role,l.display_name,l.expires_at,x.display_name,x.expires_at from memberships m
 left join social_accounts l on l.organization_id=org and l.user_id=m.user_id and l.provider='linkedin'
 left join social_accounts x on x.organization_id=org and x.user_id=m.user_id and x.provider='x'
 where m.organization_id=org and m.removed_at is null order by m.display_name,m.user_id;
end $$;
create function public.home_report(org uuid,start_day date,end_day date) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare from_time timestamptz;until_time timestamptz;tz text;result jsonb;
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 if start_day is null or end_day is null or end_day<start_day or end_day-start_day>366 then raise exception 'Choose a date range up to one year';end if;
 select timezone into tz from organizations where id=org;
 from_time=start_day::timestamp at time zone tz;until_time=(end_day+1)::timestamp at time zone tz;
 with people as (select user_id,display_name,job_title from memberships where organization_id=org and removed_at is null),
 p as (select user_id,count(*) n from drafts where organization_id=org and status='published' and published_at>=from_time and published_at<until_time group by user_id),
 c as (select user_id,count(*) n from link_clicks where organization_id=org and not is_bot and not is_duplicate and clicked_at>=from_time and clicked_at<until_time group by user_id),
 l as (select user_id,count(*) n from conversions where organization_id=org and type in ('lead','demo_booked') and occurred_at>=from_time and occurred_at<until_time group by user_id)
 select jsonb_build_object('people',coalesce(jsonb_agg(jsonb_build_object('id',people.user_id,'name',people.display_name,'role',people.job_title,'posts',coalesce(p.n,0),'clicks',coalesce(c.n,0),'leads',coalesce(l.n,0),'views',null,'sales',null)),'[]')) into result from people left join p using(user_id) left join c using(user_id) left join l using(user_id);
 return result||jsonb_build_object('posts',coalesce((select jsonb_agg(row_to_json(feed)) from (select d.id,d.user_id,d.body,d.channel,d.linkedin_url as url,d.published_at as date,m.display_name as author from drafts d join memberships m on m.organization_id=d.organization_id and m.user_id=d.user_id where d.organization_id=org and d.status='published' and d.published_at>=from_time and d.published_at<until_time order by d.published_at desc limit 500) feed),'[]'),'feed_limit',500);
end $$;
alter table challenges add column prize text not null default '' check(length(prize)<=500);
alter table challenges add column fulfilled_at timestamptz;
create function public.create_reward(org uuid,title text,prize_text text,rules_text text,metric_name text,start_time timestamptz,end_time timestamptz) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if not is_admin(org) then raise exception 'Admin required';end if;
 if length(trim(prize_text)) not between 1 and 500 or start_time<now()-interval '1 minute' then raise exception 'Prize and future start required';end if;
 result=create_challenge(org,title,rules_text,metric_name,start_time,end_time,1);
 update challenges set prize=prize_text where id=result;return result;
end $$;
create function public.fulfill_reward(reward uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
 select organization_id into org from challenges where id=reward;
 if not is_admin(org) then raise exception 'Admin required';end if;
 update challenges set fulfilled_at=coalesce(fulfilled_at,now()) where id=reward and status='ended' and exists(select 1 from challenge_results where challenge_id=reward and is_winner);
 if not found then raise exception 'Final winner required';end if;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(org,auth.uid(),'reward.fulfilled',reward);
end $$;
revoke all on function team_connections(uuid),home_report(uuid,date,date),create_reward(uuid,text,text,text,text,timestamptz,timestamptz),fulfill_reward(uuid) from public,anon,authenticated;
grant execute on function team_connections(uuid),home_report(uuid,date,date),create_reward(uuid,text,text,text,text,timestamptz,timestamptz),fulfill_reward(uuid) to authenticated;
