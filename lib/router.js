/* Navigation : barre d'onglets et affichage de l'écran courant.
   Chaque écran est un module qui expose { html(), bind() }. */
import { S, save } from './state.js';
import { $, $$ } from './util.js';

const TABS = [
  { id: 'today', l: "Aujourd'hui", i: '☀' },
  { id: 'read', l: 'Lecture', i: '📖' },
  { id: 'prayer', l: 'Prière', i: '🙏' },
  { id: 'chat', l: 'Salons', i: '💬' },
  { id: 'more', l: 'Profil', i: '🙂' }
];

let VIEWS = {};
export function setViews(v) { VIEWS = v; }
export function hasView(id) { return !!VIEWS[id]; }

export function go(t) {
  if (t === 'maraude') S.mv = 'list';
  S.tab = t;
  save();
  render();
  window.scrollTo(0, 0);
}

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(t => `<button data-tab="${t.id}" ${S.tab === t.id ? 'aria-current="page"' : ''}><span class="i" aria-hidden="true">${t.i}</span>${t.l}</button>`).join('');
  $$('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
}

export function render() {
  renderTabs();
  const v = VIEWS[S.tab] || VIEWS.today;
  $('#app').innerHTML = `<header class="top"><h1 class="brand">Parvis<small>Lire, prier, partager</small></h1><button class="icon-btn" id="gear" aria-label="Réglages et compte">⚙</button></header>` + v.html();
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const g = $('#gear'); if (g) g.onclick = () => go('more');
  v.bind();
}
