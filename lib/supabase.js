/* Client Supabase. Sans adresse ni clé (fichier .env absent), il reste désactivé
   et l'application garde sa connexion simulée. Ces deux valeurs sont publiques :
   la sécurité repose sur les règles RLS de la base, pas sur le secret de la clé. */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(url && key);

export const supabase = supabaseEnabled
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInRedirect: true, flowType: 'pkce' } })
  : null;
