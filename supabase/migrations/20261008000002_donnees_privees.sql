-- Parvis, migration 2 : données privées du membre (carnet, lecture, rappels, notifications).
-- Chaque ligne n'est visible et modifiable que par son propriétaire.

-- ---------- Carnet de prière ----------
create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('demande', 'merci', 'intercession')),
  body text not null check (char_length(body) between 1 and 1000),
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
create index prayers_user_idx on public.prayers (user_id, created_at desc);
alter table public.prayers enable row level security;
revoke all on public.prayers from anon, authenticated;
grant select, insert, update, delete on public.prayers to authenticated;
create policy prayers_select_own on public.prayers for select to authenticated using (user_id = auth.uid());
create policy prayers_insert_own on public.prayers for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy prayers_update_own on public.prayers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prayers_delete_own on public.prayers for delete to authenticated using (user_id = auth.uid());

-- ---------- Progression de lecture ----------
create table public.reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null check (char_length(plan_id) between 1 and 40),
  day_index int not null check (day_index between 0 and 365),
  done_at timestamptz not null default now(),
  primary key (user_id, plan_id, day_index)
);
alter table public.reading_progress enable row level security;
revoke all on public.reading_progress from anon, authenticated;
grant select, insert, delete on public.reading_progress to authenticated;
create policy reading_select_own on public.reading_progress for select to authenticated using (user_id = auth.uid());
create policy reading_insert_own on public.reading_progress for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy reading_delete_own on public.reading_progress for delete to authenticated using (user_id = auth.uid());

-- Plan de lecture en cours.
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null default 'jean' check (char_length(plan_id) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;
create policy settings_select_own on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy settings_insert_own on public.user_settings for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy settings_update_own on public.user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Rappels (verset du matin, moments de prière) ----------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('verse', 'prayer')),
  label text not null default '' check (char_length(label) <= 40),
  at_time time not null,
  enabled boolean not null default true,
  tz text not null default 'Europe/Paris' check (char_length(tz) between 1 and 64),
  last_sent date,
  created_at timestamptz not null default now()
);
-- Un seul rappel de verset par membre.
create unique index reminders_one_verse on public.reminders (user_id) where kind = 'verse';
create index reminders_user_idx on public.reminders (user_id);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
create policy reminders_select_own on public.reminders for select to authenticated using (user_id = auth.uid());
create policy reminders_insert_own on public.reminders for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy reminders_update_own on public.reminders for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_delete_own on public.reminders for delete to authenticated using (user_id = auth.uid());

-- Le membre ne peut pas truquer la date du dernier envoi (réservée à la fonction d'envoi).
create function public.reminders_lock_last_sent() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.last_sent := null;
  else new.last_sent := old.last_sent;
  end if;
  return new;
end;
$$;
create trigger reminders_lock_last_sent before insert or update on public.reminders
  for each row when (current_user in ('authenticated', 'anon'))
  execute function public.reminders_lock_last_sent();

-- ---------- Abonnements aux notifications (Web Push) ----------
-- Lus uniquement par la fonction d'envoi (clé de service, côté serveur).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth_key text not null check (char_length(auth_key) <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
create policy push_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent());
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
