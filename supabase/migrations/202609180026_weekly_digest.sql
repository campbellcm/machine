create table public.weekly_preferences (
 organization_id uuid not null,user_id uuid not null,enabled boolean not null default false,channel text not null check(channel in ('email','slack')),
 primary key(organization_id,user_id),foreign key(organization_id,user_id) references memberships(organization_id,user_id) on delete cascade
);
create table public.weekly_deliveries (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,user_id uuid not null,week_start timestamptz not null,channel text not null check(channel in ('email','slack')),
 status text not null check(status in ('sending','sent','failed','uncertain','canceled')),lease uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),sent_at timestamptz,
 unique(organization_id,user_id,week_start),foreign key(organization_id,user_id) references weekly_preferences on delete cascade
);
alter table weekly_preferences enable row level security;
alter table weekly_deliveries enable row level security;
revoke all on weekly_preferences,weekly_deliveries from public,anon,authenticated;
grant select on weekly_preferences,weekly_deliveries to authenticated;
grant all on weekly_preferences,weekly_deliveries to service_role;
create policy own_weekly_preferences on weekly_preferences for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create policy own_weekly_deliveries on weekly_deliveries for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create function public.set_weekly_digest(org uuid,active boolean,destination text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from memberships where organization_id=org and user_id=auth.uid() and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Opted-in member required';end if;
 insert into weekly_preferences(organization_id,user_id,enabled,channel) values(org,auth.uid(),active,destination) on conflict(organization_id,user_id) do update set enabled=excluded.enabled,channel=excluded.channel;
 update weekly_deliveries set status='canceled' where organization_id=org and user_id=auth.uid() and status='sending' and (not active or channel<>destination);
end $$;
create function public.claim_weekly_digest(channels text[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p weekly_preferences;d weekly_deliveries;until_time timestamptz=(date_trunc('week',now() at time zone 'UTC') at time zone 'UTC');from_time timestamptz;summary jsonb;
begin
 from_time=until_time-interval '7 days';
 update weekly_deliveries set status='uncertain' where status='sending' and created_at<now()-interval '2 minutes';
 select pref.* into p from weekly_preferences pref join memberships m on m.organization_id=pref.organization_id and m.user_id=pref.user_id
 where pref.enabled and pref.channel=any(channels) and m.removed_at is null and m.opted_in_at is not null and m.role in ('owner','admin','teammate') and not exists(select 1 from weekly_deliveries w where w.organization_id=pref.organization_id and w.user_id=pref.user_id and w.week_start=from_time)
 order by pref.organization_id,pref.user_id limit 1 for update of pref,m skip locked;
 if p.user_id is null then return null;end if;
 insert into weekly_deliveries(organization_id,user_id,week_start,channel,status) values(p.organization_id,p.user_id,from_time,p.channel,'sending') returning * into d;
 with posts as (
 select dr.id,dr.user_id,dr.published_at from drafts dr where dr.organization_id=p.organization_id and dr.status='published'
 union all select t.id,t.user_id,t.published_at from tracked_posts t where t.organization_id=p.organization_id and t.participating and not exists(select 1 from drafts dr where dr.organization_id=p.organization_id and dr.user_id=t.user_id and dr.channel=t.provider and dr.status='published' and (dr.provider_post_id=t.provider_post_id or dr.linkedin_url=t.url or substring(dr.linkedin_url from '/status/([0-9]+)')=t.provider_post_id))
 ),eligible as (select posts.* from posts join memberships m on m.organization_id=p.organization_id and m.user_id=posts.user_id and m.removed_at is null where published_at>=from_time and published_at<until_time)
 select jsonb_build_object('posts',count(*),'participants',count(distinct user_id)) into summary from eligible;
 summary=summary||jsonb_build_object('from',from_time,'until',until_time,
 'clicks',(select count(*) from link_clicks where organization_id=p.organization_id and not is_bot and not is_duplicate and clicked_at>=from_time and clicked_at<until_time),
 'leads',(select count(*) from conversions where organization_id=p.organization_id and type in ('lead','demo_booked') and user_id is not null and occurred_at>=from_time and occurred_at<until_time),
 'top_post',(select jsonb_build_object('url',dr.linkedin_url,'clicks',count(*)) from link_clicks lc join tracked_links t on t.id=lc.tracked_link_id join drafts dr on dr.id=t.draft_id join memberships m on m.organization_id=dr.organization_id and m.user_id=dr.user_id and m.removed_at is null where lc.organization_id=p.organization_id and not lc.is_bot and not lc.is_duplicate and lc.clicked_at>=from_time and lc.clicked_at<until_time and dr.status='published' group by dr.id order by count(*) desc,dr.id limit 1));
 return jsonb_build_object('id',d.id,'organization_id',p.organization_id,'user_id',p.user_id,'channel',p.channel,'lease',d.lease,'summary',summary);
end $$;
create function public.finish_weekly_digest(delivery uuid,claim uuid,outcome text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if outcome not in ('sent','failed','uncertain') then raise exception 'Invalid outcome';end if;
 update weekly_deliveries set status=outcome,sent_at=case when outcome='sent' then now() else null end where id=delivery and lease=claim and status='sending';return found;
end $$;
create function public.cleanup_weekly_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.removed_at is not null or new.opted_in_at is null or new.role not in ('owner','admin','teammate') then
 update weekly_preferences set enabled=false where organization_id=new.organization_id and user_id=new.user_id;
 update weekly_deliveries set status='canceled' where organization_id=new.organization_id and user_id=new.user_id and status='sending';
 end if;return new;
end $$;
create trigger cleanup_weekly after update on memberships for each row execute function cleanup_weekly_membership();
revoke all on function set_weekly_digest(uuid,boolean,text),claim_weekly_digest(text[]),finish_weekly_digest(uuid,uuid,text),cleanup_weekly_membership() from public,anon,authenticated;
grant execute on function set_weekly_digest(uuid,boolean,text) to authenticated;
grant execute on function claim_weekly_digest(text[]),finish_weekly_digest(uuid,uuid,text) to service_role;
