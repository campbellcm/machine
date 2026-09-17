-- A repeated click does not increase click counts, but can still be the most
-- recent legitimate touchpoint submitted by the first-party attribution cookie.
create or replace function public.record_conversion(org uuid,click uuid,event_type text,event_id text,event_time timestamptz) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare c link_clicks;inserted uuid;
begin
 if length(event_id) not between 1 and 200 or event_time>now()+interval '5 minutes' then raise exception 'Invalid event'; end if;
 select * into c from link_clicks where id=click and organization_id=org and not is_bot and clicked_at<=event_time and clicked_at>=event_time-interval '30 days';
 insert into conversions(organization_id,click_id,user_id,type,external_id,occurred_at) values(org,c.id,c.user_id,event_type,event_id,event_time) on conflict(organization_id,external_id) do nothing returning id into inserted;
 return inserted is not null;
end $$;
