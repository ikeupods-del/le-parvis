/* Connexion Google (Supabase) et consentement RGPD.
   Sans Supabase configuré, la connexion est simulée (mode démonstration). */
import { S, save } from './state.js';
import { $, closeOverlay, toast } from './util.js';
import { go, render } from './router.js';
import { supabase, supabaseEnabled } from './supabase.js';

/* À changer à chaque modification du texte de confidentialité : chaque membre devra reconsentir. */
export const CONSENT_VERSION = '2026-10';
export const isSimulated = !supabaseEnabled;

const PENDING = 'parvis-consent-pending';
const setPending = v => { try { v ? localStorage.setItem(PENDING, CONSENT_VERSION) : localStorage.removeItem(PENDING); } catch (e) {} };
const hasPending = () => { try { return localStorage.getItem(PENDING) === CONSENT_VERSION; } catch (e) { return false; } };

/* Fenêtre de consentement : à accepter AVANT de se connecter. */
function consentModal({ onAccept, onCancel }) {
  $('#overlay').innerHTML = `<div class="modal-back" id="mb"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ct">
    <h3 id="ct">Avant de vous connecter</h3>
    <p class="small">Une appartenance ou une pratique religieuse est une donnée sensible. Nous utilisons seulement votre e-mail Google et votre pseudo, pour permettre la modération des salons. Nous ne les vendons pas et n'affichons aucune publicité ciblée.</p>
    <label style="display:flex;gap:10px;font-weight:500;align-items:flex-start;margin-bottom:12px"><input type="checkbox" id="c1" style="margin-top:4px"><span>J'ai 15 ans ou plus et j'accepte le traitement de mes données décrit dans la politique de confidentialité.</span></label>
    <div class="row"><button class="btn primary" id="cok" disabled>Continuer</button><button class="btn" id="cpol">Lire la politique</button><button class="btn" id="cno">Annuler</button></div></div></div>`;
  const c = $('#c1'), ok = $('#cok');
  c.onchange = () => ok.disabled = !c.checked;
  ok.onclick = () => { closeOverlay(); onAccept(); };
  $('#cno').onclick = () => { closeOverlay(); if (onCancel) onCancel(); };
  $('#cpol').onclick = () => { closeOverlay(); if (onCancel) onCancel(); go('privacy'); };
  c.focus();
}

/* ---------- Connexion ---------- */
export function doSignIn() {
  if (isSimulated) {
    const fin = () => { S.user = { email: 'prenom.nom@gmail.com' }; save(); render(); toast('Connecté (simulation)'); };
    if (S.consent) { fin(); return; }
    consentModal({ onAccept: () => { S.consent = true; fin(); } });
    return;
  }
  const lancer = async () => {
    setPending(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) { setPending(false); toast('Connexion impossible pour le moment. Réessayez plus tard.'); }
  };
  consentModal({ onAccept: lancer });
}

export async function signOut() {
  if (isSimulated) { S.user = null; save(); render(); toast('Déconnecté'); return; }
  await supabase.auth.signOut();
  toast('Déconnecté');
}

/* Enregistre le pseudo (sur le serveur si connecté). Renvoie true si l'enregistrement a réussi. */
export async function savePseudo(pseudo) {
  S.pseudo = pseudo; save();
  if (isSimulated || !S.user || !S.user.id) return true;
  const { error } = await supabase.from('profiles').update({ pseudo: pseudo || null }).eq('id', S.user.id);
  return !error;
}

/* ---------- Session ---------- */
async function recordConsent() {
  const { error } = await supabase.rpc('accept_consent', { p_version: CONSENT_VERSION });
  if (error) { toast("Votre consentement n'a pas pu être enregistré. Reconnectez-vous."); return false; }
  setPending(false); S.consent = true; save();
  return true;
}

let lastKey = '';
async function applySession(session) {
  if (!session) {
    const had = !!S.user;
    S.user = null; save();
    if (had || lastKey) render();
    lastKey = '';
    return;
  }
  const u = session.user;
  const { data } = await supabase.from('profiles').select('pseudo, consent_at, consent_version').eq('id', u.id).maybeSingle();
  S.user = { id: u.id, email: u.email };

  // Pseudo : celui du serveur fait foi ; sinon on envoie celui saisi avant la connexion.
  if (data && data.pseudo) S.pseudo = data.pseudo;
  else if (S.pseudo) await supabase.from('profiles').update({ pseudo: S.pseudo }).eq('id', u.id);

  const consentOk = !!(data && data.consent_at && data.consent_version === CONSENT_VERSION);
  if (consentOk) { S.consent = true; setPending(false); }
  else if (hasPending()) { await recordConsent(); }
  else {
    // Connexion sans consentement enregistré (autre appareil, nouveau texte) : on le demande, sinon on déconnecte.
    S.consent = false;
    consentModal({ onAccept: async () => { if (await recordConsent()) render(); }, onCancel: () => supabase.auth.signOut() });
  }
  save();
  const k = [u.id, S.pseudo, S.consent].join('|');
  if (k !== lastKey) { lastKey = k; render(); }
}

/* À appeler une fois au démarrage. */
export function initAuth() {
  if (isSimulated) return;
  S.user = null;            // en mode réel, seule la session fait foi
  supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => applySession(session), 0); });
}
