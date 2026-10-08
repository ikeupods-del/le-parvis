-- Parvis, migration 1 : profils, consentement RGPD, rôles.
--
-- Principe général de toutes les migrations :
--   * chaque table a la sécurité par ligne (RLS) activée ;
--   * sans règle ("policy"), personne n'a accès ;
--   * on retire les droits par défaut de Supabase puis on accorde seulement le nécessaire.

-- ---------- Rôles (modérateur, administrateur) ----------
-- Table sans aucune règle d'écriture : on ne peut l'alimenter que depuis le
-- tableau de bord Supabase (SQL Editor), jamais depuis l'application.
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('moderator', 'admin'));
$$;

-- ---------- Profils ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text check (pseudo is null or char_length(pseudo) between 1 and 24),
  consent_at timestamptz,       -- date du consentement (donnée sensible : pratique religieuse)
  consent_version text,         -- version du texte de confidentialité accepté
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Le membre ne peut modifier que son pseudo. Le consentement passe par accept_consent().
grant update (pseudo) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Création automatique du profil à la première connexion Google.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Consentement et bannissement ----------
create function public.has_consent() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and consent_at is not null);
$$;

-- Enregistre le consentement (15 ans ou plus, traitement des données) pour le membre connecté.
create function public.accept_consent(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if p_version is null or char_length(p_version) not between 1 and 40 then
    raise exception 'version invalide';
  end if;
  update public.profiles set consent_at = now(), consent_version = p_version where id = auth.uid();
end;
$$;

-- Retrait du consentement (le membre peut aussi supprimer son compte, voir migration 6).
create function public.withdraw_consent() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  update public.profiles set consent_at = null, consent_version = null where id = auth.uid();
end;
$$;

create table public.bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  banned_by uuid references auth.users (id) on delete set null,
  until timestamptz,            -- vide = bannissement sans date de fin
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;
grant select, insert, update, delete on public.bans to authenticated;
create policy bans_moderators on public.bans
  for all to authenticated using (public.is_moderator()) with check (public.is_moderator());

create function public.is_banned() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bans where user_id = auth.uid() and (until is null or until > now())
  );
$$;

-- Les fonctions ne sont appelables que par les membres connectés.
revoke execute on function public.is_admin(), public.is_moderator(), public.has_consent(),
  public.is_banned(), public.accept_consent(text), public.withdraw_consent() from public, anon;
grant execute on function public.is_admin(), public.is_moderator(), public.has_consent(),
  public.is_banned(), public.accept_consent(text), public.withdraw_consent() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
