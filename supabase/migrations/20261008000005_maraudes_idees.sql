-- Parvis, migration 5 : maraudes et boîte à idées.
-- Toute proposition est relue par un administrateur avant d'être visible.

-- ---------- Maraudes ----------
create table public.maraudes (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  church_id uuid references public.churches (id) on delete set null,
  title text not null check (char_length(title) between 1 and 60),
  starts_at timestamptz not null,
  place text not null check (char_length(place) between 1 and 80),   -- point de départ public, jamais un domicile
  city text not null check (char_length(city) between 1 and 60),
  volunteers_needed int not null default 6 check (volunteers_needed between 2 and 50),
  needs text[] not null default '{}' check (cardinality(needs) <= 12),
  notes text not null default '' check (char_length(notes) <= 300),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now()
);
create index maraudes_pub_idx on public.maraudes (starts_at) where status = 'published';
alter table public.maraudes enable row level security;
revoke all on public.maraudes from anon, authenticated;
grant select, insert, update, delete on public.maraudes to authenticated;
-- Visiteur sans compte : maraudes publiées, sans l'identité de l'organisateur.
grant select (id, church_id, title, starts_at, place, city, volunteers_needed, needs, notes, status, created_at)
  on public.maraudes to anon;

create policy maraudes_select_published on public.maraudes for select to anon, authenticated
  using (status = 'published');
create policy maraudes_select_own on public.maraudes for select to authenticated
  using (organizer_id = auth.uid());
create policy maraudes_select_admin on public.maraudes for select to authenticated using (public.is_admin());
create policy maraudes_insert on public.maraudes for insert to authenticated
  with check (organizer_id = auth.uid() and status = 'pending' and starts_at > now() and public.has_consent());
-- L'organisateur modifie sa proposition tant qu'elle est en attente, sans pouvoir la publier lui-même.
create policy maraudes_update_own on public.maraudes for update to authenticated
  using (organizer_id = auth.uid() and status = 'pending')
  with check (organizer_id = auth.uid() and status = 'pending');
create policy maraudes_update_admin on public.maraudes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy maraudes_delete_own on public.maraudes for delete to authenticated
  using (organizer_id = auth.uid() or public.is_admin());

-- ---------- Inscriptions des bénévoles ----------
create table public.maraude_signups (
  maraude_id uuid not null references public.maraudes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bringing text[] not null default '{}' check (cardinality(bringing) <= 12),
  created_at timestamptz not null default now(),
  primary key (maraude_id, user_id)
);
alter table public.maraude_signups enable row level security;
revoke all on public.maraude_signups from anon, authenticated;
grant select, insert, update, delete on public.maraude_signups to authenticated;

create function public.maraude_is_open(p_maraude uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.maraudes m
    where m.id = p_maraude and m.status = 'published' and m.starts_at > now()
      and (select count(*) from public.maraude_signups s where s.maraude_id = m.id) < m.volunteers_needed
  );
$$;
-- Même sans place libre, un membre déjà inscrit peut modifier ce qu'il apporte.
create function public.maraude_is_published(p_maraude uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.maraudes where id = p_maraude and status = 'published');
$$;

create policy signups_select_own on public.maraude_signups for select to authenticated using (user_id = auth.uid());
create policy signups_insert on public.maraude_signups for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent() and public.maraude_is_open(maraude_id));
create policy signups_update_own on public.maraude_signups for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.maraude_is_published(maraude_id));
create policy signups_delete_own on public.maraude_signups for delete to authenticated using (user_id = auth.uid());

-- Nombre d'inscrits par maraude publiée (sans révéler qui).
create function public.maraude_counts() returns table (maraude_id uuid, volunteers bigint)
language sql stable security definer set search_path = '' as $$
  select m.id, count(s.user_id)
  from public.maraudes m left join public.maraude_signups s on s.maraude_id = m.id
  where m.status = 'published'
  group by m.id;
$$;
revoke execute on function public.maraude_is_open(uuid), public.maraude_is_published(uuid) from public, anon;
grant execute on function public.maraude_is_open(uuid), public.maraude_is_published(uuid) to authenticated;
revoke execute on function public.maraude_counts() from public;
grant execute on function public.maraude_counts() to anon, authenticated;

-- ---------- Boîte à idées ----------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'proposed', 'studied', 'done', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.ideas enable row level security;
revoke all on public.ideas from anon, authenticated;
grant select, insert, update, delete on public.ideas to authenticated;
-- Idées relues (proposées, étudiées, réalisées) : visibles de tous les membres connectés.
create policy ideas_select_public on public.ideas for select to authenticated
  using (status in ('proposed', 'studied', 'done'));
create policy ideas_select_own on public.ideas for select to authenticated using (user_id = auth.uid());
create policy ideas_select_admin on public.ideas for select to authenticated using (public.is_admin());
create policy ideas_insert on public.ideas for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and public.has_consent());
create policy ideas_update_admin on public.ideas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ideas_delete on public.ideas for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
alter table public.idea_votes enable row level security;
revoke all on public.idea_votes from anon, authenticated;
grant select, insert, delete on public.idea_votes to authenticated;

create function public.idea_is_votable(p_idea uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ideas where id = p_idea and status in ('proposed', 'studied'));
$$;
revoke execute on function public.idea_is_votable(uuid) from public, anon;
grant execute on function public.idea_is_votable(uuid) to authenticated;

create policy votes_select_own on public.idea_votes for select to authenticated using (user_id = auth.uid());
create policy votes_insert on public.idea_votes for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent() and public.idea_is_votable(idea_id));
create policy votes_delete_own on public.idea_votes for delete to authenticated using (user_id = auth.uid());

create function public.idea_vote_counts() returns table (idea_id uuid, votes bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, count(v.user_id)
  from public.ideas i left join public.idea_votes v on v.idea_id = i.id
  where i.status in ('proposed', 'studied', 'done')
  group by i.id;
$$;
revoke execute on function public.idea_vote_counts() from public, anon;
grant execute on function public.idea_vote_counts() to authenticated;
