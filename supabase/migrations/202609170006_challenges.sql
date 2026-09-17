create table public.challenges (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,
 name text not null check(length(name) between 1 and 100),rules text not null,
 metric text not null check(metric in ('leads','unique_clicks','published_posts')),
 starts_at timestamptz not null,ends_at timestamptz not null,settling_hours integer not null default 72 check(settling_hours between 0 and 168),
 winner_count integer not null default 1 check(winner_count between 1 and 10),
 status text not null default 'scheduled' check(status in ('scheduled','active','settling','ended','canceled')),
 created_by uuid not null,check(ends_at>starts_at),unique(organization_id,id)
);
create table public.challenge_results (
 organization_id uuid not null,challenge_id uuid not null,user_id uuid not null,
 rank integer not null,score bigint not null,reached_score_at timestamptz,is_winner boolean not null,
 primary key(challenge_id,user_id),foreign key(organization_id,challenge_id) references challenges(organization_id,id) on delete cascade
);
alter table challenges enable row level security;
alter table challenge_results enable row level security;
revoke all on challenges,challenge_results from public,anon,authenticated;
grant select on challenges,challenge_results to authenticated;
grant all on challenges,challenge_results to service_role;
create policy challenge_read on challenges for select to authenticated using(member_role(organization_id) is not null);
create policy results_read on challenge_results for select to authenticated using(member_role(organization_id) is not null);
create function public.create_challenge(org uuid,title text,rules_text text,metric_name text,start_time timestamptz,end_time timestamptz,winners integer) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not is_admin(org) then raise exception 'Admin required'; end if;
 if length(rules_text)>10000 then raise exception 'Rules too long'; end if;
 insert into challenges(organization_id,name,rules,metric,starts_at,ends_at,winner_count,created_by) values(org,title,rules_text,metric_name,start_time,end_time,winners,auth.uid()) returning id into result;
 return result;
end $$;
create function public.challenge_scores(challenge uuid) returns table(user_id uuid,display_name text,score bigint,reached_score_at timestamptz) language plpgsql stable security definer set search_path=public as $$
declare c challenges;
begin
 select * into c from challenges where id=challenge;
 if c.id is null or member_role(c.organization_id) is null then raise exception 'Membership required'; end if;
 return query
 with activity as (
 select d.user_id as person,d.published_at as occurred from drafts d where c.metric='published_posts' and d.organization_id=c.organization_id and d.status='published' and d.verified
 union all select l.user_id,l.clicked_at from link_clicks l where c.metric='unique_clicks' and l.organization_id=c.organization_id and not l.is_bot and not l.is_duplicate
 union all select v.user_id,v.occurred_at from conversions v where c.metric='leads' and v.organization_id=c.organization_id and v.type in ('lead','demo_booked')
 )
 select m.user_id,m.display_name,count(a.person),max(a.occurred) from memberships m left join activity a on a.person=m.user_id and a.occurred>=c.starts_at and a.occurred<c.ends_at
 where m.organization_id=c.organization_id and m.removed_at is null and m.opted_in_at is not null and m.role in ('owner','admin','teammate')
 group by m.user_id,m.display_name order by count(a.person) desc,max(a.occurred) asc nulls last,m.user_id;
end $$;
create function public.advance_challenges() returns integer language plpgsql security definer set search_path=public as $$
declare c challenges;processed integer=0;
begin
 update challenges set status='active' where status='scheduled' and starts_at<=now();
 update challenges set status='settling' where status='active' and ends_at<=now();
 for c in select * from challenges where status='settling' and ends_at+make_interval(hours=>settling_hours)<=now() for update skip locked loop
 -- Service processing duplicates the permission-free aggregate intentionally; no public RPC bypass.
 insert into challenge_results(organization_id,challenge_id,user_id,rank,score,reached_score_at,is_winner)
 with activity as (
 select d.user_id as person,d.published_at as occurred from drafts d where c.metric='published_posts' and d.organization_id=c.organization_id and d.status='published' and d.verified
 union all select l.user_id,l.clicked_at from link_clicks l where c.metric='unique_clicks' and l.organization_id=c.organization_id and not l.is_bot and not l.is_duplicate
 union all select v.user_id,v.occurred_at from conversions v where c.metric='leads' and v.organization_id=c.organization_id and v.type in ('lead','demo_booked')
 ),scores as (select m.user_id,count(a.person) score,max(a.occurred) reached from memberships m left join activity a on a.person=m.user_id and a.occurred>=c.starts_at and a.occurred<c.ends_at where m.organization_id=c.organization_id and m.removed_at is null and m.opted_in_at is not null and m.role in ('owner','admin','teammate') group by m.user_id),ranked as (select *,row_number() over(order by score desc,reached asc nulls last,user_id) r from scores)
 select c.organization_id,c.id,user_id,r,score,reached,r<=c.winner_count and score>0 from ranked;
 update challenges set status='ended' where id=c.id;processed=processed+1;
 end loop;
 return processed;
end $$;
revoke all on function create_challenge(uuid,text,text,text,timestamptz,timestamptz,integer),challenge_scores(uuid),advance_challenges() from public,anon,authenticated;
grant execute on function create_challenge(uuid,text,text,text,timestamptz,timestamptz,integer),challenge_scores(uuid) to authenticated;
grant execute on function advance_challenges() to service_role;
