/* État de l'application, gardé dans le navigateur (localStorage protégé). */
export const KEY = 'parvis-v1';

function defaults() {
  return {
    tab: 'today', plan: 'jean', done: {}, prayers: [], pseudo: '', charter: false, user: null,
    maraudes: [], joined: {}, mv: 'list', prayRem: [], notif: { on: false, time: '08:00', last: '' },
    consent: false, ideas: [], voted: [], church: null, cv: 'home', req: null, mine: null,
    q: '', conf: '', chat: {}, blocked: [], reported: [], room: 'general', theme: 'auto', ctheme: 'classique'
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(defaults(), JSON.parse(raw));
  } catch (e) {}
  return defaults();
}

export const S = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
}

/* Remet l'état à zéro sans changer l'objet S (les autres fichiers le partagent). */
export function resetState() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, defaults());
}
