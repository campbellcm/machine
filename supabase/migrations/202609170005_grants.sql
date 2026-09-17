-- Supabase projects may have permissive DEFAULT PRIVILEGES. Revoke explicitly,
-- including function grants, instead of depending on bare PostgreSQL defaults.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all functions in schema public from anon,authenticated;
grant select on organizations,memberships,drafts,audit_log,interviews,campaigns,tracked_links,link_clicks,conversions to authenticated;
grant select(id,organization_id,email,role,expires_at,accepted_at) on invitations to authenticated;
grant execute on function member_role(uuid),is_admin(uuid),can_write(uuid),create_organization(text,text,text),save_profile(uuid,text,text,text,text[],boolean),save_company(uuid,text,text,text[],boolean),create_invitation(uuid,text,text,text),accept_invitation(text),manage_member(uuid,uuid,text,boolean),save_draft(uuid,uuid,text,integer),transition_draft(uuid,integer,text),record_manual_post(uuid,integer,text),disconnect_social(),claim_publish(uuid,integer),create_campaign(uuid,text,text,text),attach_link(uuid,uuid,text,text,integer),create_conversion_key(uuid,text,text),revoke_conversion_keys(uuid),save_interview(uuid,uuid,text,text,text,integer),claim_generation(uuid) to authenticated;
