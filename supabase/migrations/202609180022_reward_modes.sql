alter table challenges drop constraint challenges_metric_check;
alter table challenges add constraint challenges_metric_check check(metric in ('leads','unique_clicks','published_posts','active_days','improvement_posts','first_post','team_posts'));
alter table challenges add column target integer check(target between 1 and 100000);
alter table challenges add constraint reward_team_target check(metric<>'team_posts' or target is not null);
create function public.create_reward_v2(org uuid,title text,prize_text text,rules_text text,metric_name text,start_time timestamptz,end_time timestamptz,goal integer) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if metric_name='team_posts' and (goal is null or goal not between 1 and 100000) then raise exception 'Team target required';end if;
 if not is_admin(org) then raise exception 'Admin required';end if;
 if length(trim(prize_text)) not between 1 and 500 or length(rules_text)>10000 or start_time<now()-interval '1 minute' then raise exception 'Prize and future start required';end if;
 insert into challenges(organization_id,name,prize,rules,metric,starts_at,ends_at,winner_count,created_by,target) values(org,title,prize_text,rules_text,metric_name,start_time,end_time,1,auth.uid(),case when metric_name='team_posts' then goal else null end) returning id into result;
 return result;
end $$;
create function public.reward_scores_internal(challenge uuid) returns table(user_id uuid,display_name text,score bigint,reached_score_at timestamptz) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c challenges;tz text;
begin
 select * into c from challenges where id=challenge;
 select timezone into tz from organizations where id=c.organization_id;
 return query
 with publications as (
 select d.user_id person,d.published_at occurred from drafts d where d.organization_id=c.organization_id and d.status='published' and d.verified
 union all select t.user_id,t.published_at from tracked_posts t where t.organization_id=c.organization_id and t.participating and not exists(select 1 from drafts d where d.organization_id=c.organization_id and d.user_id=t.user_id and d.status='published' and d.channel=t.provider and (d.provider_post_id=t.provider_post_id or d.linkedin_url=t.url or substring(d.linkedin_url from '/status/([0-9]+)')=t.provider_post_id))
 ), activity as (
 -- Preserve scoring for existing published-post challenges.
 select d.user_id person,d.published_at occurred from drafts d where c.metric='published_posts' and d.organization_id=c.organization_id and d.status='published' and d.verified
 union all select l.user_id,l.clicked_at from link_clicks l where c.metric='unique_clicks' and l.organization_id=c.organization_id and not l.is_bot and not l.is_duplicate
 union all select v.user_id,v.occurred_at from conversions v where c.metric='leads' and v.organization_id=c.organization_id and v.type in ('lead','demo_booked')
 union all select p.person,p.occurred from publications p where c.metric in ('active_days','improvement_posts','team_posts')
 union all select p.person,min(p.occurred) from publications p where c.metric='first_post' group by p.person
 ), totals as (
 select m.user_id id,m.display_name name,
 count(a.person) filter(where a.occurred>=c.starts_at and a.occurred<c.ends_at) current_count,
 count(a.person) filter(where a.occurred>=c.starts_at-(c.ends_at-c.starts_at) and a.occurred<c.starts_at) previous_count,
 count(distinct (a.occurred at time zone tz)::date) filter(where a.occurred>=c.starts_at and a.occurred<c.ends_at) days,
 case when c.metric='active_days' then (select max(day_first) from (select min(ad.occurred) day_first from activity ad where ad.person=m.user_id and ad.occurred>=c.starts_at and ad.occurred<c.ends_at group by (ad.occurred at time zone tz)::date) day_times) else max(a.occurred) filter(where a.occurred>=c.starts_at and a.occurred<c.ends_at) end reached
 from memberships m left join activity a on a.person=m.user_id where m.organization_id=c.organization_id and m.removed_at is null and m.opted_in_at is not null and m.role in ('owner','admin','teammate') group by m.user_id,m.display_name
 ), scores as (select id,name,case when c.metric='active_days' then days when c.metric='improvement_posts' then greatest(0,current_count-previous_count) else current_count end points,reached from totals)
 select id,name,points,reached from scores order by points desc,reached asc nulls last,id;
end $$;
create or replace function public.challenge_scores(challenge uuid) returns table(user_id uuid,display_name text,score bigint,reached_score_at timestamptz) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
 select organization_id into org from challenges where id=challenge;
 if member_role(org) is null then raise exception 'Membership required';end if;
 return query select * from reward_scores_internal(challenge);
end $$;
create or replace function public.advance_challenges() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare c challenges;processed integer=0;
begin
 update challenges set status='active' where status='scheduled' and starts_at<=now();
 update challenges set status='settling' where status='active' and ends_at<=now();
 for c in select * from challenges where status='settling' and ends_at+make_interval(hours=>settling_hours)<=now() for update skip locked loop
 insert into challenge_results(organization_id,challenge_id,user_id,rank,score,reached_score_at,is_winner)
 with scores as (select *,row_number() over(order by score desc,reached_score_at asc nulls last,user_id) r,sum(score) over() total from reward_scores_internal(c.id))
 select c.organization_id,c.id,user_id,r,score,reached_score_at,case when c.metric='team_posts' then total>=c.target and score>0 else r<=c.winner_count and score>0 end from scores;
 update challenges set status='ended' where id=c.id;processed=processed+1;
 end loop;
 return processed;
end $$;
revoke all on function create_reward_v2(uuid,text,text,text,text,timestamptz,timestamptz,integer),reward_scores_internal(uuid) from public,anon,authenticated;
grant execute on function create_reward_v2(uuid,text,text,text,text,timestamptz,timestamptz,integer) to authenticated;
