-- New installation only. All writes go through bounded functions; RLS governs reads.
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 website text not null default '', timezone text not null default 'America/New_York',
 context text not null default '' check(length(context)<=60000), voice text not null default '',
 blocked_phrases text[] not null default '{}', admin_review_required boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid references organizations on delete cascade, user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','admin','teammate','viewer','payroll_approver')),
 payroll_approver boolean not null default false, display_name text not null default '',
 job_title text not null default '', department text not null default '', topics text[] not null default '{}',
 opted_in_at timestamptz, removed_at timestamptz, primary key(organization_id,user_id)
);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 email text not null, role text not null check(role in ('admin','teammate','viewer','payroll_approver')),
 token_hash text unique not null, expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz
);
create table public.drafts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 user_id uuid not null references auth.users, body text not null check(length(body) between 1 and 3000),
 status text not null default 'draft' check(status in ('draft','in_review','changes_requested','reviewed','approved','publishing','publish_uncertain','published')),
 revision integer not null default 1, approved_revision integer, claims text[] not null default '{}',
 linkedin_url text, provider_post_id text, publish_method text, verified boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 unique(organization_id,id)
);
create table public.social_accounts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 user_id uuid not null references auth.users, provider text not null check(provider='linkedin'),
 provider_user_id text not null, display_name text not null, token_encrypted text not null, expires_at timestamptz not null,
 unique(organization_id,user_id,provider), unique(provider,provider_user_id)
);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 actor_user_id uuid, action text not null, target_id uuid, created_at timestamptz not null default now()
);
create table public.interviews (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 user_id uuid not null references auth.users, answers jsonb not null default '[]', focus text not null default '',
 created_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.campaigns (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 name text not null, destination_url text not null check(destination_url ~ '^https://'), utm_campaign text not null,
 active boolean not null default true, unique(organization_id,id)
);
create table public.tracked_links (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 user_id uuid not null references auth.users, campaign_id uuid not null, draft_id uuid not null,
 slug text not null unique check(slug ~ '^[A-Za-z0-9_-]{7}$'),
 foreign key(organization_id,campaign_id) references campaigns(organization_id,id),
 foreign key(organization_id,draft_id) references drafts(organization_id,id) on delete cascade,
 unique(draft_id,campaign_id)
);
create table public.link_clicks (
 id uuid primary key, organization_id uuid not null references organizations on delete cascade,
 tracked_link_id uuid not null references tracked_links on delete cascade, user_id uuid not null,
 visitor_hash text not null, is_bot boolean not null, is_duplicate boolean not null, clicked_at timestamptz not null default now()
);
create index clicks_dedup on link_clicks(tracked_link_id,visitor_hash,clicked_at desc);
create table public.api_keys (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 key_hash text not null unique, prefix text not null, revoked_at timestamptz
);
create table public.conversions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations on delete cascade,
 click_id uuid references link_clicks, user_id uuid, type text not null check(type in ('lead','demo_booked','signup','custom')),
 external_id text not null, occurred_at timestamptz not null, created_at timestamptz not null default now(),
 unique(organization_id,external_id)
);
create function public.member_role(org uuid) returns text language sql stable security definer set search_path=public as $$
 select role from memberships where organization_id=org and user_id=auth.uid() and removed_at is null
$$;
create function public.is_admin(org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(member_role(org) in ('owner','admin'),false)
$$;
create function public.can_write(org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from memberships where organization_id=org and user_id=auth.uid() and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate'))
$$;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table drafts enable row level security;
alter table social_accounts enable row level security;
alter table audit_log enable row level security;
alter table interviews enable row level security;
alter table campaigns enable row level security;
alter table tracked_links enable row level security;
alter table link_clicks enable row level security;
alter table api_keys enable row level security;
alter table conversions enable row level security;
create policy org_read on organizations for select to authenticated using(member_role(id) is not null);
create policy member_read on memberships for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() or is_admin(organization_id) or member_role(organization_id)='viewer'));
create policy invite_read on invitations for select to authenticated using(is_admin(organization_id));
create policy draft_read on drafts for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() and can_write(organization_id) or status='published' and member_role(organization_id) in ('owner','admin','viewer') or status in ('in_review','reviewed','changes_requested') and is_admin(organization_id) and (select admin_review_required from organizations where id=organization_id)));
-- Tokens have no authenticated policies or grants. Only server service role accesses them.
create policy audit_read on audit_log for select to authenticated using(is_admin(organization_id));
create policy interview_read on interviews for select to authenticated using(user_id=auth.uid() and can_write(organization_id));
create policy campaign_read on campaigns for select to authenticated using(member_role(organization_id) in ('owner','admin','teammate','viewer'));
create policy link_read on tracked_links for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() or member_role(organization_id) in ('owner','admin','viewer')));
create policy click_read on link_clicks for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() or member_role(organization_id) in ('owner','admin','viewer')));
create policy conversion_read on conversions for select to authenticated using(member_role(organization_id) is not null and (user_id=auth.uid() or member_role(organization_id) in ('owner','admin','viewer')));
-- Hashes are not exposed through the data API.
grant select on organizations,memberships,drafts,audit_log,interviews,campaigns,tracked_links,link_clicks,conversions to authenticated;
grant select(id,organization_id,email,role,expires_at,accepted_at) on invitations to authenticated;

create function public.create_organization(company_name text, company_website text, company_timezone text) returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from pg_timezone_names where name=company_timezone) then raise exception 'Invalid timezone'; end if;
 insert into organizations(name,website,timezone) values(trim(company_name),company_website,company_timezone) returning id into org;
 insert into memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
 return org;
end $$;
create function public.save_profile(org uuid, person_name text, title text, team text, expertise text[], consent boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if member_role(org) not in ('owner','admin','teammate') or member_role(org) is null then raise exception 'Not eligible'; end if;
 if length(person_name) not between 1 and 100 or length(title)>120 or length(team)>100 or cardinality(expertise) not between 3 and 5 then raise exception 'Complete your profile'; end if;
 update memberships set display_name=person_name, job_title=title, department=team, topics=expertise,
 opted_in_at=case when consent then coalesce(opted_in_at,now()) else null end where organization_id=org and user_id=auth.uid();
 if not consent then
 delete from social_accounts where organization_id=org and user_id=auth.uid();
 delete from drafts where organization_id=org and user_id=auth.uid() and status<>'published';
 delete from interviews where organization_id=org and user_id=auth.uid();
 end if;
end $$;
create function public.save_company(org uuid, company_context text, brand_voice text, blocked text[], review_required boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin(org) then raise exception 'Admin required'; end if;
 update organizations set context=company_context,voice=left(brand_voice,4000),blocked_phrases=blocked,admin_review_required=review_required where id=org;
 -- Changed brand rules revoke previous approvals, including pending reviews.
 update drafts set status='draft',approved_revision=null where organization_id=org and status in ('approved','reviewed','in_review');
 insert into audit_log(organization_id,actor_user_id,action) values(org,auth.uid(),'company.updated');
end $$;
create function public.create_invitation(org uuid, invite_email text, invite_role text, hashed_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not is_admin(org) then raise exception 'Admin required'; end if;
 if invite_role='admin' and member_role(org)<>'owner' then raise exception 'Owner required'; end if;
 insert into invitations(organization_id,email,role,token_hash) values(org,lower(trim(invite_email)),invite_role,hashed_token) returning id into result;
 return result;
end $$;
create function public.accept_invitation(hashed_token text) returns uuid language plpgsql security definer set search_path=public as $$
declare invitation invitations;
begin
 select * into invitation from invitations where token_hash=hashed_token and accepted_at is null and expires_at>now() for update;
 if invitation.id is null or auth.uid() is null or invitation.email <> lower((select email from auth.users where id=auth.uid())) then raise exception 'Invitation unavailable for this account'; end if;
 insert into memberships(organization_id,user_id,role) values(invitation.organization_id,auth.uid(),invitation.role)
 on conflict(organization_id,user_id) do nothing;
 update invitations set accepted_at=now() where id=invitation.id;
 return invitation.organization_id;
end $$;
create function public.manage_member(org uuid, person uuid, new_role text, remove_member boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_admin(org) or person=auth.uid() then raise exception 'Not permitted'; end if;
 if exists(select 1 from memberships where organization_id=org and user_id=person and role='owner') then raise exception 'Transfer ownership separately'; end if;
 if member_role(org)<>'owner' and (new_role='admin' or exists(select 1 from memberships where organization_id=org and user_id=person and role='admin')) then raise exception 'Owner required'; end if;
 if new_role not in ('admin','teammate','viewer','payroll_approver') then raise exception 'Invalid role'; end if;
 update memberships set role=new_role,removed_at=case when remove_member then now() else removed_at end where organization_id=org and user_id=person;
 if remove_member or new_role in ('viewer','payroll_approver') then
 delete from social_accounts where organization_id=org and user_id=person;
 delete from drafts where organization_id=org and user_id=person and status<>'published';
 delete from interviews where organization_id=org and user_id=person;
 end if;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(org,auth.uid(),'member.changed',person);
end $$;
create function public.save_draft(org uuid, draft uuid, content text, expected_revision integer default null) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not can_write(org) then raise exception 'Opt in first'; end if;
 if draft is null then
 insert into drafts(organization_id,user_id,body) values(org,auth.uid(),content) returning id into result;
 else
 update drafts set body=content,revision=revision+1,status='draft',approved_revision=null,updated_at=now()
 where id=draft and organization_id=org and user_id=auth.uid() and revision=expected_revision and status not in ('publishing','publish_uncertain','published') returning id into result;
 if result is null then raise exception 'Draft changed. Reload before editing.'; end if;
 end if;
 return result;
end $$;
create function public.check_draft(org uuid, content text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare company organizations; first_lines text;
begin
 select * into company from organizations where id=org;
 first_lines=left(split_part(content,E'\n',1)||E'\n'||split_part(content,E'\n',2),220);
 if position(lower('I work at '||company.name||'.') in lower(first_lines))=0 then return false; end if;
 if exists(select 1 from unnest(company.blocked_phrases) phrase where length(trim(phrase))>0 and position(lower(phrase) in lower(content))>0) then return false; end if;
 return length(content) between 1 and 3000;
end $$;
create function public.transition_draft(draft uuid, expected_revision integer, operation text) returns void language plpgsql security definer set search_path=public as $$
declare d drafts; company organizations;
begin
 select * into d from drafts where id=draft for update;
 if d.id is null or d.revision<>expected_revision then raise exception 'Draft changed'; end if;
 select * into company from organizations where id=d.organization_id;
 if operation in ('review','request_changes') then
 if not is_admin(d.organization_id) or not company.admin_review_required or d.status<>'in_review' then raise exception 'Review not permitted'; end if;
 update drafts set status=case when operation='review' then 'reviewed' else 'changes_requested' end where id=draft;
 else
 if d.user_id<>auth.uid() or not can_write(d.organization_id) or d.status not in ('draft','changes_requested','reviewed') then raise exception 'Author approval required'; end if;
 if not check_draft(d.organization_id,d.body) then raise exception 'Check employment disclosure and blocked phrases'; end if;
 if operation='submit' and company.admin_review_required then update drafts set status='in_review' where id=draft;
 elsif operation='approve' and (not company.admin_review_required or d.status='reviewed') then update drafts set status='approved',approved_revision=revision where id=draft;
 else raise exception 'Submit for review first'; end if;
 end if;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(d.organization_id,auth.uid(),'draft.'||operation,draft);
end $$;
create function public.record_manual_post(draft uuid, expected_revision integer, post_url text) returns void language plpgsql security definer set search_path=public as $$
declare d drafts;
begin
 select * into d from drafts where id=draft for update;
 if d.user_id is distinct from auth.uid() or not can_write(d.organization_id) or d.status<>'approved' or d.revision<>expected_revision or d.approved_revision<>d.revision or not check_draft(d.organization_id,d.body) then raise exception 'Current author approval required'; end if;
 if post_url<>'' and post_url !~ '^https://(www\.)?linkedin\.com/(feed/update/urn:li:(activity|share|ugcPost):[0-9]+/?|posts/[A-Za-z0-9_-]+/?)$' then raise exception 'Use a LinkedIn post URL without query parameters'; end if;
 update drafts set status='published',publish_method='manual',linkedin_url=nullif(post_url,''),verified=post_url<>'',published_at=now() where id=draft;
 insert into audit_log(organization_id,actor_user_id,action,target_id) values(d.organization_id,auth.uid(),'post.manual',draft);
end $$;
-- Revoke PostgreSQL's default PUBLIC execution; explicitly expose only safe RPCs.
revoke all on all functions in schema public from public;
grant execute on function member_role(uuid),is_admin(uuid),can_write(uuid),create_organization(text,text,text),save_profile(uuid,text,text,text,text[],boolean),save_company(uuid,text,text,text[],boolean),create_invitation(uuid,text,text,text),accept_invitation(text),manage_member(uuid,uuid,text,boolean),save_draft(uuid,uuid,text,integer),transition_draft(uuid,integer,text),record_manual_post(uuid,integer,text) to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
