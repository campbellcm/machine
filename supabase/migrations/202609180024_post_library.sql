create table public.post_bookmarks (
 organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 post_id uuid not null,note text not null default '' check(length(note)<=400),created_at timestamptz not null default now(),primary key(organization_id,user_id,post_id)
);
alter table post_bookmarks enable row level security;
revoke all on post_bookmarks from public,anon,authenticated;
grant select on post_bookmarks to authenticated;
grant all on post_bookmarks to service_role;
create policy own_bookmarks on post_bookmarks for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create function public.save_post_example(org uuid,post uuid,reason text,remove boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 if remove then delete from post_bookmarks where organization_id=org and user_id=auth.uid() and post_id=post;return;end if;
 if not exists(select 1 from drafts d join memberships m on m.organization_id=d.organization_id and m.user_id=d.user_id and m.removed_at is null where d.organization_id=org and d.id=post and d.status='published') and not exists(select 1 from tracked_posts t join memberships m on m.organization_id=t.organization_id and m.user_id=t.user_id and m.removed_at is null where t.organization_id=org and t.id=post and t.participating) then raise exception 'Shared published post required';end if;
 insert into post_bookmarks(organization_id,user_id,post_id,note) values(org,auth.uid(),post,coalesce(reason,'')) on conflict(organization_id,user_id,post_id) do update set note=excluded.note;
end $$;
create function public.post_examples(org uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return coalesce((select jsonb_agg(to_jsonb(p)) from (
 select b.post_id id,b.note,e.body,e.channel,m.display_name author from post_bookmarks b join lateral (
 select d.user_id,d.body,d.channel from drafts d where d.id=b.post_id and d.organization_id=org and d.status='published'
 union all select t.user_id,t.body,t.provider from tracked_posts t where t.id=b.post_id and t.organization_id=org and t.participating
 ) e on true join memberships m on m.organization_id=org and m.user_id=e.user_id and m.removed_at is null
 where b.organization_id=org and b.user_id=auth.uid() order by b.created_at desc limit 50
 ) p),'[]'::jsonb);
end $$;
revoke all on function save_post_example(uuid,uuid,text,boolean),post_examples(uuid) from public,anon,authenticated;
grant execute on function save_post_example(uuid,uuid,text,boolean),post_examples(uuid) to authenticated;
