-- Optional member-owned photo, exposed to active colleagues only.
alter table public.memberships add column photo_url text not null default '' check (photo_url = '' or (length(photo_url)<=2048 and photo_url ~ '^https://[^[:space:]]+$'));
create function public.save_profile_photo(org uuid, photo text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required'; end if;
 update memberships set photo_url=coalesce(trim(photo),'') where organization_id=org and user_id=auth.uid() and removed_at is null;
end $$;
create function public.team_photos(org uuid) returns table(user_id uuid,photo_url text) language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if member_role(org) is null then raise exception 'Membership required'; end if;
 return query select m.user_id,m.photo_url from memberships m where m.organization_id=org and m.removed_at is null;
end $$;
revoke all on function public.save_profile_photo(uuid,text),public.team_photos(uuid) from public,anon,authenticated;
grant execute on function public.save_profile_photo(uuid,text),public.team_photos(uuid) to authenticated;

-- Keep profile, participation and photo changes atomic, including invalid photo input.
create function public.save_profile_with_photo(org uuid,person_name text,title text,team text,expertise text[],consent boolean,photo text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform save_profile(org,person_name,title,team,expertise,consent);
 perform save_profile_photo(org,photo);
end $$;
revoke all on function public.save_profile_with_photo(uuid,text,text,text,text[],boolean,text) from public,anon,authenticated;
grant execute on function public.save_profile_with_photo(uuid,text,text,text,text[],boolean,text) to authenticated;
