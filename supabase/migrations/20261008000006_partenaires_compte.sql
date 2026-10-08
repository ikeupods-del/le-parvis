-- Parvis, migration 6 : partenaires, export et suppression du compte (RGPD).

-- ---------- Partenaires (bandeau de l'écran « Aujourd'hui ») ----------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(category) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  url text check (url is null or url ~ '^https://'),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;
grant select on public.partners to anon, authenticated;
grant insert, update, delete on public.partners to authenticated;
-- Les visiteurs ne voient que les partenaires actifs. L'administrateur voit tout via la règle ci-dessous.
create policy partners_select on public.partners for select to anon, authenticated
  using (active);
create policy partners_admin_write on public.partners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Export de toutes les données du membre ----------
create function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'connexion requise'; end if;
  return jsonb_build_object(
    'exporte_le', now(),
    'profil', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'carnet_de_priere', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.prayers x where x.user_id = uid), '[]'),
    'progression_lecture', coalesce((select jsonb_agg(to_jsonb(x)) from public.reading_progress x where x.user_id = uid), '[]'),
    'reglages', (select to_jsonb(x) from public.user_settings x where x.user_id = uid),
    'rappels', coalesce((select jsonb_agg(to_jsonb(x)) from public.reminders x where x.user_id = uid), '[]'),
    'appareils_notifications', coalesce((select jsonb_agg(jsonb_build_object('endpoint', x.endpoint, 'cree_le', x.created_at)) from public.push_subscriptions x where x.user_id = uid), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.messages x where x.user_id = uid), '[]'),
    'signalements_envoyes', coalesce((select jsonb_agg(to_jsonb(x)) from public.reports x where x.reporter_id = uid), '[]'),
    'personnes_bloquees', coalesce((select jsonb_agg(to_jsonb(x)) from public.blocks x where x.blocker_id = uid), '[]'),
    'eglise_choisie', (select to_jsonb(x) from public.user_church x where x.user_id = uid),
    'demandes_responsable', coalesce((select jsonb_agg(to_jsonb(x)) from public.manager_requests x where x.user_id = uid), '[]'),
    'maraudes_proposees', coalesce((select jsonb_agg(to_jsonb(x)) from public.maraudes x where x.organizer_id = uid), '[]'),
    'inscriptions_maraudes', coalesce((select jsonb_agg(to_jsonb(x)) from public.maraude_signups x where x.user_id = uid), '[]'),
    'idees', coalesce((select jsonb_agg(to_jsonb(x)) from public.ideas x where x.user_id = uid), '[]'),
    'votes', coalesce((select jsonb_agg(to_jsonb(x)) from public.idea_votes x where x.user_id = uid), '[]')
  );
end;
$$;

-- ---------- Suppression du compte ----------
-- Supprime le compte d'authentification : toutes les données liées partent avec lui (ON DELETE CASCADE).
-- Les signalements reçus à propos du membre sont conservés pour la modération (copie du message).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.export_my_data(), public.delete_my_account() from public, anon;
grant execute on function public.export_my_data(), public.delete_my_account() to authenticated;
