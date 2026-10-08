-- Parvis, migration 3 : salons de discussion et modération.
-- Le chat reste désactivé côté application tant que VITE_CHAT_ENABLED n'est pas "true".

create table public.rooms (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name text not null check (char_length(name) <= 60),
  description text not null default '' check (char_length(description) <= 200),
  position int not null default 0
);
alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;
create policy rooms_select on public.rooms for select to authenticated using (true);

insert into public.rooms (id, name, description, position) values
  ('general', 'Général', 'Pour se présenter et échanger simplement.', 1),
  ('priere', 'Demandes de prière', 'Confiez un sujet, d''autres prieront avec vous.', 2),
  ('foi', 'Questions sur la foi', 'Poser une question sincère, sans débat de confession.', 3);

-- ---------- Blocages ----------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- ---------- Messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pseudo text not null,   -- copie du pseudo au moment de l'envoi : les autres membres ne lisent jamais la table profiles
  body text not null check (char_length(body) between 1 and 400),
  created_at timestamptz not null default now()
);
create index messages_room_idx on public.messages (room_id, created_at desc);
create index messages_created_idx on public.messages (created_at);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert, delete on public.messages to authenticated;

-- Lecture : tous les membres connectés, sauf les messages des personnes qu'on a bloquées.
create policy messages_select on public.messages for select to authenticated
  using (not exists (
    select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = messages.user_id
  ));
-- Écriture : sous son propre nom, avec consentement, sans être banni.
create policy messages_insert on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.has_consent() and not public.is_banned());
-- Suppression : son propre message, ou n'importe lequel pour un modérateur.
create policy messages_delete on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- Avant l'insertion : pseudo imposé par le serveur + limite de débit (anti-spam).
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pseudo text; v_recent int;
begin
  select pseudo into v_pseudo from public.profiles where id = new.user_id;
  if v_pseudo is null or v_pseudo = '' then
    raise exception 'pseudo requis avant d''écrire' using errcode = 'P0001';
  end if;
  new.pseudo := v_pseudo;
  select count(*) into v_recent from public.messages
    where user_id = new.user_id and created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'trop de messages, patientez un instant' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ---------- Signalements ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  message_user_id uuid,      -- auteur du message signalé
  message_pseudo text,
  message_body text,         -- copie du message : la preuve survit à la purge des 7 jours
  room_id text,
  reason text check (reason is null or char_length(reason) <= 200),
  status text not null default 'open' check (status in ('open', 'handled')),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, update, delete on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.has_consent());
create policy reports_update_mod on public.reports for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
create policy reports_delete_mod on public.reports for delete to authenticated using (public.is_moderator());

-- La copie du message est prise par le serveur : le signaleur ne peut rien falsifier.
create function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.messages;
begin
  select * into m from public.messages where id = new.message_id;
  if not found then raise exception 'message introuvable' using errcode = 'P0001'; end if;
  new.message_user_id := m.user_id;
  new.message_pseudo := m.pseudo;
  new.message_body := m.body;
  new.room_id := m.room_id;
  new.handled_by := null;
  return new;
end;
$$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------- Purge des messages de plus de 7 jours ----------
-- La planification quotidienne (pg_cron) est ajoutée en phase 5, avec le chat.
create function public.purge_old_messages() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.messages where created_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_old_messages() from public, anon, authenticated;
revoke execute on function public.messages_before_insert(), public.reports_before_insert()
  from public, anon, authenticated;
