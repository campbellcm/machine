create table public.social_syncs (
 organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 provider text not null check(provider in ('x','linkedin')),enabled boolean not null default false,
 last_attempt_at timestamptz,last_success_at timestamptz,issue text,primary key(organization_id,user_id,provider)
);
create table public.tracked_posts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 provider text not null check(provider in ('x','linkedin')),provider_post_id text not null,provider_person text not null,
 body text not null,published_at timestamptz not null,url text not null,participating boolean not null default false,
 observed_at timestamptz not null default now(),unique(organization_id,user_id,provider,provider_post_id)
);
create table public.post_snapshots (
 post_id uuid not null references tracked_posts on delete cascade,observed_at timestamptz not null default now(),
 impressions bigint check(impressions>=0),likes bigint check(likes>=0),replies bigint check(replies>=0),reposts bigint check(reposts>=0),
 primary key(post_id,observed_at)
);
alter table social_syncs enable row level security;
alter table tracked_posts enable row level security;
alter table post_snapshots enable row level security;
revoke all on social_syncs,tracked_posts,post_snapshots from public,anon,authenticated;
grant select on social_syncs,tracked_posts,post_snapshots to authenticated;
grant all on social_syncs,tracked_posts,post_snapshots to service_role;
create policy own_syncs on social_syncs for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create policy eligible_posts on tracked_posts for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() or participating));
create policy eligible_snapshots on post_snapshots for select to authenticated using(exists(select 1 from tracked_posts p where p.id=post_id));
create function public.set_post_tracking(org uuid,channel_name text,enabled_value boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not can_write(org) or channel_name<>'x' then raise exception 'Eligible author and supported channel required';end if;
 insert into social_syncs(organization_id,user_id,provider,enabled) values(org,auth.uid(),channel_name,enabled_value)
 on conflict(organization_id,user_id,provider) do update set enabled=enabled_value;
end $$;
create function public.select_work_post(post uuid,include_post boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p tracked_posts;
begin
 select * into p from tracked_posts where id=post for update;
 if p.user_id is distinct from auth.uid() or not can_write(p.organization_id) then raise exception 'Author required';end if;
 update tracked_posts set participating=include_post where id=post;
end $$;
create function public.save_tracked_posts(org uuid,person uuid,channel_name text,provider_person_id text,items jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;post uuid;
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then return false;end if;
 perform 1 from social_syncs where organization_id=org and user_id=person and provider=channel_name and enabled for update;
 if not found then return false;end if;
 perform 1 from social_accounts where organization_id=org and user_id=person and provider=channel_name and provider_user_id=provider_person_id for update;
 if not found then return false;end if;
 if channel_name<>'x' or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>100 then raise exception 'Invalid batch';end if;
 for item in select value from jsonb_array_elements(items) loop
  if (item->>'id') !~ '^[0-9]+$' or (item->>'author_id') is distinct from provider_person_id or length(item->>'text')>30000 then raise exception 'Invalid post';end if;
  insert into tracked_posts(organization_id,user_id,provider,provider_post_id,provider_person,body,published_at,url)
  values(org,person,channel_name,item->>'id',provider_person_id,item->>'text',(item->>'created_at')::timestamptz,'https://x.com/i/status/'||(item->>'id'))
  on conflict(organization_id,user_id,provider,provider_post_id) do update set body=excluded.body,observed_at=now() returning id into post;
  insert into post_snapshots(post_id,observed_at,impressions,likes,replies,reposts)
  values(post,now(),(item->'public_metrics'->>'impression_count')::bigint,(item->'public_metrics'->>'like_count')::bigint,(item->'public_metrics'->>'reply_count')::bigint,(item->'public_metrics'->>'retweet_count')::bigint)
  on conflict(post_id,observed_at) do update set impressions=excluded.impressions,likes=excluded.likes,replies=excluded.replies,reposts=excluded.reposts;
 end loop;
 update social_syncs set last_attempt_at=now(),last_success_at=now(),issue=null where organization_id=org and user_id=person and provider=channel_name;
 return true;
end $$;
-- Opting out/removal deletes private imports as well as stopping future syncs.
create function public.cleanup_tracking_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.removed_at is not null or new.opted_in_at is null or new.role not in ('owner','admin','teammate') then
  delete from social_syncs where organization_id=new.organization_id and user_id=new.user_id;
  delete from tracked_posts where organization_id=new.organization_id and user_id=new.user_id;
 end if;return new;
end $$;
create trigger clean_tracking after update on memberships for each row execute function cleanup_tracking_membership();
revoke all on function set_post_tracking(uuid,text,boolean),select_work_post(uuid,boolean),save_tracked_posts(uuid,uuid,text,text,jsonb),cleanup_tracking_membership() from public,anon,authenticated;
grant execute on function set_post_tracking(uuid,text,boolean),select_work_post(uuid,boolean) to authenticated;
grant execute on function save_tracked_posts(uuid,uuid,text,text,jsonb) to service_role;
create function public.imported_post_counts(org uuid,start_day date,end_day date) returns table(user_id uuid,posts bigint) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tz text;
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 if start_day is null or end_day is null or end_day<start_day or end_day-start_day>366 then raise exception 'Invalid dates';end if;
 select timezone into tz from organizations where id=org;
 return query select p.user_id,count(*) from tracked_posts p join memberships m on m.organization_id=p.organization_id and m.user_id=p.user_id and m.removed_at is null
 where p.organization_id=org and p.participating and p.published_at>=start_day::timestamp at time zone tz and p.published_at<(end_day+1)::timestamp at time zone tz
 and not exists(select 1 from drafts d where d.organization_id=org and d.user_id=p.user_id and d.channel=p.provider and d.status='published' and (d.provider_post_id=p.provider_post_id or d.linkedin_url=p.url or (p.provider='x' and substring(d.linkedin_url from '/status/([0-9]+)')=p.provider_post_id))) group by p.user_id;
end $$;
create function public.published_post_attribution(org uuid) returns table(draft_id uuid,campaign_names text[],clicks bigint,leads bigint) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return query select d.id,
 array(select distinct c.name from tracked_links t join campaigns c on c.id=t.campaign_id where t.draft_id=d.id),
 (select count(*) from link_clicks lc join tracked_links t on t.id=lc.tracked_link_id where t.draft_id=d.id and not lc.is_bot and not lc.is_duplicate),
 (select count(*) from conversions cv join link_clicks lc on lc.id=cv.click_id join tracked_links t on t.id=lc.tracked_link_id where t.draft_id=d.id and cv.type in ('lead','demo_booked'))
 from drafts d where d.organization_id=org and d.status='published' order by d.published_at desc limit 500;
end $$;
revoke all on function imported_post_counts(uuid,date,date),published_post_attribution(uuid) from public,anon,authenticated;
grant execute on function imported_post_counts(uuid,date,date),published_post_attribution(uuid) to authenticated;
