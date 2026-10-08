/* Petits outils partagés par tous les écrans. */
export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

/* Protège tout texte venant d'un utilisateur avant de l'afficher. */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Branche un clic sur un élément s'il existe. */
export const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };

export function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.hidden = true, 2600);
}

export function dayOfYear(d = new Date()) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
export function fmtDate(d) { return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }

export const pad = n => String(n).padStart(2, '0');
export function isoDay(o) { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export const mins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const TIMEINPUT = 'border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 12px;min-height:44px';

export function closeOverlay() { $('#overlay').innerHTML = ''; }

export function modal(html) {
  $('#overlay').innerHTML = `<div class="modal-back" id="mb"><div class="modal" role="dialog" aria-modal="true">${html}<button class="btn primary" id="mclose">Fermer</button></div></div>`;
  $('#mclose').onclick = closeOverlay;
  $('#mb').onclick = e => { if (e.target.id === 'mb') closeOverlay(); };
  $('#mclose').focus();
}
