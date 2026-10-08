-- Parvis, migration 4 : Mon église, demandes de responsables, annonces.

-- ---------- Communautés (annuaire public) ----------
create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  city text not null check (char_length(city) between 1 and 60),
  confession text not null check (confession in ('Catholique', 'Protestante', 'Évangélique', 'Orthodoxe', 'Autre')),
  hours text not null default '' check (char_length(hours) <= 500),
  created_at timestamptz not null default now()
);
create index churches_city_idx on public.churches (lower(city));
alter table public.churches enable row level security;
revoke all on public.churches from anon, authenticated;
grant select on public.churches to anon, authenticated;
grant insert, update, delete on public.churches to authenticated;

-- Responsables autorisés à gérer une communauté (alimenté uniquement par la validation d'une demande).
create table public.church_managers (
  user_id uuid not null references auth.users (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, church_id)
);
alter table public.church_managers enable row level security;
revoke all on public.church_managers from anon, authenticated;
grant select on public.church_managers to authenticated;
create policy managers_select on public.church_managers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create function public.manages_church(p_church uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.church_managers where user_id = auth.uid() and church_id = p_church);
$$;
revoke execute on function public.manages_church(uuid) from public, anon;
grant execute on function public.manages_church(uuid) to authenticated;

create policy churches_select on public.churches for select to anon, authenticated using (true);
create policy churches_admin_write on public.churches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy churches_manager_update on public.churches for update to authenticated
  using (public.manages_church(id)) with check (public.manages_church(id));

-- Un responsable ne modifie que les horaires : nom, ville et confession restent figés.
create function public.churches_restrict_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.name := old.name;
    new.city := old.city;
    new.confession := old.confession;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger churches_restrict_update before update on public.churches
  for each row execute function public.churches_restrict_update();

-- ---------- Annonces ----------
create table public.church_announcements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index church_ann_idx on public.church_announcements (church_id, created_at desc);
alter table public.church_announcements enable row level security;
revoke all on public.church_announcements from anon, authenticated;
grant select on public.church_announcements to anon, authenticated;
grant insert, delete on public.church_announcements to authenticated;
create policy ann_select on public.church_announcements for select to anon, authenticated using (true);
create policy ann_insert on public.church_announcements for insert to authenticated
  with check (author_id = auth.uid() and (public.manages_church(church_id) or public.is_admin()));
create policy ann_delete on public.church_announcements for delete to authenticated
  using (public.manages_church(church_id) or public.is_admin());

-- ---------- Église choisie par le membre ----------
create table public.user_church (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade
);
alter table public.user_church enable row level security;
revoke all on public.user_church from anon, authenticated;
grant select, insert, update, delete on public.user_church to authenticated;
create policy uc_select_own on public.user_church for select to authenticated using (user_id = auth.uid());
create policy uc_insert_own on public.user_church for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy uc_update_own on public.user_church for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy uc_delete_own on public.user_church for delete to authenticated using (user_id = auth.uid());

-- ---------- Demandes pour devenir responsable ----------
create table public.manager_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  role text not null check (role in ('Prêtre', 'Pasteur', 'Diacre', 'Responsable de communauté', 'Autre responsable')),
  church_name text not null check (char_length(church_name) between 2 and 100),
  city text not null check (char_length(city) between 1 and 60),
  confession text not null check (confession in ('Catholique', 'Protestante', 'Évangélique', 'Orthodoxe', 'Autre')),
  official_email text not null check (char_length(official_email) between 5 and 120),
  verify_link text not null check (char_length(verify_link) between 5 and 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  church_id uuid references public.churches (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- Une seule demande en attente par membre.
create unique index manager_requests_one_pending on public.manager_requests (user_id) where status = 'pending';
alter table public.manager_requests enable row level security;
revoke all on public.manager_requests from anon, authenticated;
grant select, insert, delete on public.manager_requests to authenticated;
create policy mreq_select on public.manager_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy mreq_insert on public.manager_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and public.has_consent());
create policy mreq_delete on public.manager_requests for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin());

-- Validation par l'administrateur : crée la communauté et nomme le responsable.
create function public.approve_manager_request(p_request uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.manager_requests; v_church uuid;
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  select * into r from public.manager_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'demande introuvable ou déjà traitée' using errcode = 'P0001'; end if;
  insert into public.churches (name, city, confession) values (r.church_name, r.city, r.confession)
    returning id into v_church;
  insert into public.church_managers (user_id, church_id) values (r.user_id, v_church);
  update public.manager_requests
    set status = 'approved', church_id = v_church, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request;
  return v_church;
end;
$$;

create function public.reject_manager_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  update public.manager_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request and status = 'pending';
  if not found then raise exception 'demande introuvable ou déjà traitée' using errcode = 'P0001'; end if;
end;
$$;

revoke execute on function public.approve_manager_request(uuid), public.reject_manager_request(uuid),
  public.churches_restrict_update() from public, anon;
grant execute on function public.approve_manager_request(uuid), public.reject_manager_request(uuid) to authenticated;
revoke execute on function public.churches_restrict_update() from authenticated;
