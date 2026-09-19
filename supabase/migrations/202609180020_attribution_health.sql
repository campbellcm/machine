-- Aggregate diagnostics only; no visitor identifiers or CRM contact data.
create function public.attribution_health(org uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not is_admin(org) then raise exception 'Admin required';end if;
 return jsonb_build_object(
 'window_days',30,
 'last_click',(select max(clicked_at) from link_clicks where organization_id=org and not is_bot),
 'last_conversion',(select max(created_at) from conversions where organization_id=org),
 'unique_clicks',(select count(*) from link_clicks where organization_id=org and not is_bot and not is_duplicate and clicked_at>=now()-interval '30 days'),
 'attributed',(select count(*) from conversions where organization_id=org and click_id is not null and occurred_at>=now()-interval '30 days'),
 'unattributed',(select count(*) from conversions where organization_id=org and click_id is null and occurred_at>=now()-interval '30 days')
 );
end $$;
revoke all on function attribution_health(uuid) from public,anon,authenticated;
grant execute on function attribution_health(uuid) to authenticated;
