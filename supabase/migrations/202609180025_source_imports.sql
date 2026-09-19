create table public.source_credentials (
 organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 provider text not null check(provider in ('fathom','slack')),token_encrypted text not null,expires_at timestamptz,connected_at timestamptz not null default now(),primary key(organization_id,user_id,provider)
);
create table public.source_imports (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references organizations on delete cascade,user_id uuid not null references auth.users,
 provider text not null check(provider in ('fathom','slack')),external_id text not null check(length(external_id)<=100),title text not null check(length(title)<=160),content text not null check(length(content)<=16000),created_at timestamptz not null default now(),source_id uuid references ce_sources on delete set null
);
alter table source_credentials enable row level security;
alter table source_imports enable row level security;
revoke all on source_credentials,source_imports from public,anon,authenticated;
grant all on source_credentials,source_imports to service_role;
grant select on source_imports to authenticated;
create policy own_source_imports on source_imports for select to authenticated using(user_id=auth.uid() and member_role(organization_id) is not null);
create function public.store_source_credential(org uuid,person uuid,channel text,encrypted text,expiry timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found or channel not in ('fathom','slack') then raise exception 'Eligible member required';end if;
 insert into source_credentials(organization_id,user_id,provider,token_encrypted,expires_at) values(org,person,channel,encrypted,expiry) on conflict(organization_id,user_id,provider) do update set token_encrypted=excluded.token_encrypted,expires_at=excluded.expires_at,connected_at=now();
end $$;
create function public.stage_source_import(org uuid,person uuid,channel text,external text,body text,expected text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 perform 1 from memberships where organization_id=org and user_id=person and removed_at is null and opted_in_at is not null and role in ('owner','admin','teammate') for update;
 if not found then raise exception 'Membership required';end if;
 perform 1 from source_credentials where organization_id=org and user_id=person and provider=channel and token_encrypted=expected and (expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'Connection required';end if;
 if length(body) not between 30 and 16000 then raise exception 'Select 30 to 16000 characters';end if;
 insert into source_imports(organization_id,user_id,provider,external_id,title,content) values(org,person,channel,external,case when channel='fathom' then 'Selected Fathom recording' else 'Selected Slack message' end,body) returning id into result;return result;
end $$;
create function public.source_connection_status(org uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('provider',provider,'connected_at',connected_at,'expired',expires_at<=now())) from source_credentials where organization_id=org and user_id=auth.uid()),'[]'::jsonb);
end $$;
create function public.approve_source_import(item uuid,edited text,usage text,approved boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s source_imports;result jsonb;
begin
 select * into s from source_imports where id=item;
 if s.user_id is distinct from auth.uid() then raise exception 'Current author review required';end if;
 perform 1 from memberships where organization_id=s.organization_id and user_id=auth.uid() and removed_at is null and opted_in_at is not null for update;
 if not found then raise exception 'Membership required';end if;
 perform 1 from source_credentials where organization_id=s.organization_id and user_id=auth.uid() and provider=s.provider and (expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'Connection required';end if;
 select * into s from source_imports where id=item for update;
 if s.user_id is distinct from auth.uid() or s.source_id is not null or s.created_at<now()-interval '7 days' or approved is distinct from true or usage not in ('inspiration_only','approved_fact') or length(edited) not between 30 and 16000 then raise exception 'Current author review required';end if;
 result=ce_command(s.organization_id,'source',jsonb_build_object('title',s.title,'text',edited,'visibility','private','roles','[]'::jsonb,'external_use',usage,'consent',true));
 update source_imports set source_id=(result->>'id')::uuid,content='' where id=item;
 update ce_sources set expires_at=least(expires_at,now()+interval '30 days') where id=(result->>'id')::uuid;
 return result;
end $$;
create function public.disconnect_source(org uuid,channel text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from memberships where organization_id=org and user_id=auth.uid() for update;
 delete from source_credentials where organization_id=org and user_id=auth.uid() and provider=channel;
 delete from ce_sources where id in(select source_id from source_imports where organization_id=org and user_id=auth.uid() and provider=channel);
 delete from source_imports where organization_id=org and user_id=auth.uid() and provider=channel;
end $$;
create function public.cleanup_source_imports() returns void language sql security definer set search_path=public,pg_temp as $$ delete from source_imports where source_id is null and created_at<now()-interval '7 days' $$;
create function public.cleanup_source_membership() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.removed_at is not null or new.opted_in_at is null or new.role not in ('owner','admin','teammate') then
 delete from source_credentials where organization_id=new.organization_id and user_id=new.user_id;
 delete from ce_sources where id in(select source_id from source_imports where organization_id=new.organization_id and user_id=new.user_id);
 delete from source_imports where organization_id=new.organization_id and user_id=new.user_id;
 end if;return new;
end $$;
create trigger cleanup_source_members after update on memberships for each row execute function cleanup_source_membership();
revoke all on function store_source_credential(uuid,uuid,text,text,timestamptz),stage_source_import(uuid,uuid,text,text,text,text),source_connection_status(uuid),approve_source_import(uuid,text,text,boolean),disconnect_source(uuid,text),cleanup_source_imports(),cleanup_source_membership() from public,anon,authenticated;
grant execute on function store_source_credential(uuid,uuid,text,text,timestamptz),stage_source_import(uuid,uuid,text,text,text,text),cleanup_source_imports() to service_role;
grant execute on function source_connection_status(uuid),approve_source_import(uuid,text,text,boolean),disconnect_source(uuid,text) to authenticated;
