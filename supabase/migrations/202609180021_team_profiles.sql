-- Team-facing projections contain published/selected work and checklist flags only.
create function public.team_program(org uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',m.user_id,'participating',m.opted_in_at is not null,
 'voice_ready',case when is_admin(org) or m.user_id=auth.uid() then exists(select 1 from ce_profiles p where p.organization_id=org and p.user_id=m.user_id and p.enrolled and length(coalesce(p.config->>'role',''))>0) else null end,
 'connected',exists(select 1 from social_accounts a where a.organization_id=org and a.user_id=m.user_id),
 'first_post',exists(select 1 from drafts d where d.organization_id=org and d.user_id=m.user_id and d.status='published') or exists(select 1 from tracked_posts t where t.organization_id=org and t.user_id=m.user_id and t.participating),
 'posts',(select count(*) from (
 select d.id from drafts d where d.organization_id=org and d.user_id=m.user_id and d.status='published' and d.published_at>=now()-interval '30 days'
 union all select t.id from tracked_posts t where t.organization_id=org and t.user_id=m.user_id and t.participating and t.published_at>=now()-interval '30 days' and not exists(select 1 from drafts d where d.organization_id=org and d.user_id=m.user_id and d.status='published' and d.channel=t.provider and (d.provider_post_id=t.provider_post_id or d.linkedin_url=t.url or substring(d.linkedin_url from '/status/([0-9]+)')=t.provider_post_id))
 ) p),
 'clicks',(select count(*) from link_clicks c where c.organization_id=org and c.user_id=m.user_id and not c.is_bot and not c.is_duplicate and c.clicked_at>=now()-interval '30 days'),
 'leads',(select count(*) from conversions c where c.organization_id=org and c.user_id=m.user_id and c.type in ('lead','demo_booked') and c.occurred_at>=now()-interval '30 days')
 ) order by m.display_name) from memberships m where m.organization_id=org and m.removed_at is null),'[]'::jsonb);
end $$;
create function public.teammate_public_posts(org uuid,person uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null or not exists(select 1 from memberships where organization_id=org and user_id=person and removed_at is null) then raise exception 'Membership required';end if;
 return coalesce((select jsonb_agg(to_jsonb(p) order by p.published_at desc) from (
 select * from (
 select d.id,d.body,d.channel,d.linkedin_url as url,d.published_at from drafts d where d.organization_id=org and d.user_id=person and d.status='published'
 union all select t.id,t.body,t.provider,t.url,t.published_at from tracked_posts t where t.organization_id=org and t.user_id=person and t.participating and not exists(select 1 from drafts d where d.organization_id=org and d.user_id=person and d.status='published' and d.channel=t.provider and (d.provider_post_id=t.provider_post_id or d.linkedin_url=t.url or substring(d.linkedin_url from '/status/([0-9]+)')=t.provider_post_id))
 ) eligible order by published_at desc limit 20
 ) p),'[]'::jsonb);
end $$;
revoke all on function team_program(uuid),teammate_public_posts(uuid,uuid) from public,anon,authenticated;
grant execute on function team_program(uuid),teammate_public_posts(uuid,uuid) to authenticated;
