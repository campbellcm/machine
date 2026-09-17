create function public.create_campaign(org uuid,campaign_name text,destination text,campaign_utm text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not is_admin(org) then raise exception 'Admin required'; end if;
 if length(campaign_name) not between 1 and 100 or length(destination)>2048 or length(campaign_utm)>100 then raise exception 'Invalid campaign'; end if;
 insert into campaigns(organization_id,name,destination_url,utm_campaign) values(org,campaign_name,destination,campaign_utm) returning id into result;return result;
end $$;
create function public.attach_link(draft uuid,campaign uuid,new_slug text,base_url text,expected_revision integer) returns text language plpgsql security definer set search_path=public as $$
declare d drafts;link_slug text;new_body text;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.revision<>expected_revision or d.status in ('publishing','publish_uncertain','published') then raise exception 'Draft unavailable'; end if;
 if not exists(select 1 from campaigns where id=campaign and organization_id=d.organization_id and active) then raise exception 'Campaign unavailable'; end if;
 if base_url !~ '^https?://' or length(base_url)>250 then raise exception 'Invalid app URL'; end if;
 insert into tracked_links(organization_id,user_id,campaign_id,draft_id,slug) values(d.organization_id,auth.uid(),campaign,draft,new_slug) on conflict(draft_id,campaign_id) do nothing;
 select slug into link_slug from tracked_links where draft_id=draft and campaign_id=campaign;
 new_body=d.body;
 if position(base_url||'/l/'||link_slug in new_body)=0 then new_body=new_body||E'\n\n'||base_url||'/l/'||link_slug; end if;
 update drafts set body=new_body,status='draft',approved_revision=null,revision=revision+1,updated_at=now() where id=draft;
 return link_slug;
end $$;
create function public.create_conversion_key(org uuid,hashed text,key_prefix text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin if not is_admin(org) then raise exception 'Admin required'; end if;insert into api_keys(organization_id,key_hash,prefix) values(org,hashed,key_prefix) returning id into result;return result;end $$;
create function public.revoke_conversion_keys(org uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin(org) then raise exception 'Admin required'; end if;update api_keys set revoked_at=now() where organization_id=org;end $$;
create function public.log_click(link uuid,click uuid,visitor text,bot boolean) returns void language plpgsql security definer set search_path=public as $$
declare l tracked_links;duplicate boolean;
begin
 select * into l from tracked_links where id=link;
 if l.id is null then raise exception 'Unknown link'; end if;
 -- Serialize this visitor/link pair so simultaneous requests cannot count twice.
 perform pg_advisory_xact_lock(hashtext(link::text||visitor));
 duplicate=exists(select 1 from link_clicks where tracked_link_id=link and visitor_hash=visitor and clicked_at>now()-interval '30 minutes');
 insert into link_clicks(id,organization_id,tracked_link_id,user_id,visitor_hash,is_bot,is_duplicate) values(click,l.organization_id,link,l.user_id,visitor,bot,duplicate);
end $$;
create function public.record_conversion(org uuid,click uuid,event_type text,event_id text,event_time timestamptz) returns boolean language plpgsql security definer set search_path=public as $$
declare c link_clicks;inserted uuid;
begin
 if length(event_id) not between 1 and 200 or event_time>now()+interval '5 minutes' then raise exception 'Invalid event'; end if;
 select * into c from link_clicks where id=click and organization_id=org and not is_bot and not is_duplicate and clicked_at<=event_time and clicked_at>=event_time-interval '30 days';
 insert into conversions(organization_id,click_id,user_id,type,external_id,occurred_at) values(org,c.id,c.user_id,event_type,event_id,event_time) on conflict(organization_id,external_id) do nothing returning id into inserted;
 return inserted is not null;
end $$;
revoke all on function create_campaign(uuid,text,text,text),attach_link(uuid,uuid,text,text,integer),create_conversion_key(uuid,text,text),revoke_conversion_keys(uuid),log_click(uuid,uuid,text,boolean),record_conversion(uuid,uuid,text,text,timestamptz) from public;
grant execute on function create_campaign(uuid,text,text,text),attach_link(uuid,uuid,text,text,integer),create_conversion_key(uuid,text,text),revoke_conversion_keys(uuid) to authenticated;
grant execute on function log_click(uuid,uuid,text,boolean),record_conversion(uuid,uuid,text,text,timestamptz) to service_role;
