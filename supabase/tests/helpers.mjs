// Outils des tests SQL : une base Postgres embarquée (PGlite) qui imite l'authentification
// Supabase (rôles anon / authenticated, fonction auth.uid()), puis applique nos migrations.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Comme sur Supabase : toute nouvelle table reçoit tous les droits, c'est la RLS qui protège.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function newDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${f} : ${e.message}`);
    }
  }
  return db;
}

let counter = 0;
/** Crée un membre (en tant que super-utilisateur, comme le ferait Google Auth). */
export async function mkUser(db, { pseudo = null, consent = false, role = null } = {}) {
  const n = ++counter;
  const { rows } = await db.query('insert into auth.users (email) values ($1) returning id', [`membre${n}@exemple.test`]);
  const id = rows[0].id;
  if (pseudo) await db.query('update public.profiles set pseudo = $2 where id = $1', [id, pseudo]);
  if (consent) await db.query("update public.profiles set consent_at = now(), consent_version = 'test' where id = $1", [id]);
  if (role) await db.query('insert into public.user_roles (user_id, role) values ($1, $2)', [id, role]);
  return id;
}

/** Exécute fn comme un membre connecté (rôle "authenticated"), puis revient au super-utilisateur. */
export async function asUser(db, uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec('set role authenticated');
  try { return await fn(db); }
  finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}

/** Exécute fn comme un visiteur sans compte (rôle "anon"). */
export async function asAnon(db, fn) {
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec('set role anon');
  try { return await fn(db); }
  finally { await db.exec('reset role'); }
}

/** Vérifie qu'une requête est refusée (droit manquant, règle RLS ou contrainte). */
export async function denied(promise, pattern = /permission denied|row-level security|violates|invalid|raise|requis|réservé|introuvable|trop de|connexion|exception|check constraint|does not exist/i) {
  try { await promise; }
  catch (e) {
    if (!pattern.test(String(e.message))) throw new Error(`Refusé, mais pour une autre raison : ${e.message}`);
    return e.message;
  }
  throw new Error('Cette action aurait dû être refusée');
}
