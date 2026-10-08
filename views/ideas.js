/* Écran « Boîte à idées ». */
import { S, save } from '../lib/state.js';
import { $, $$, esc, toast } from '../lib/util.js';
import { SEEDIDEAS } from '../lib/demo.js';
import { render } from '../lib/router.js';

function html() {
  const voted = id => S.voted.includes(id);
  return `<h2>Boîte à idées</h2>
  <p class="muted small">Une idée, une fonction qui manque, un souci ? Dites-le. Les idées sont relues avant d'être affichées à tous.</p>
  <form class="card" id="iform" autocomplete="off">
    <div class="field"><label for="it">Votre idée en une phrase</label><input type="text" id="it" required maxlength="100"></div>
    <div class="field"><label for="ix">Détails (facultatif)</label><textarea id="ix" maxlength="500"></textarea></div>
    <button class="btn primary" type="submit">Envoyer</button>
  </form>
  ${S.ideas.length ? `<h3 style="margin:16px 0 8px">Vos envois</h3>` + S.ideas.map(i => `<article class="card flat"><span class="tag">En attente de relecture</span><h3 style="margin-top:6px">${esc(i.t)}</h3>${i.x ? `<p class="small muted" style="margin:0;white-space:pre-wrap">${esc(i.x)}</p>` : ''}</article>`).join('') : ''}
  <h3 style="margin:16px 0 8px">Idées de la communauté <span class="muted small">(exemples)</span></h3>
  ${SEEDIDEAS.map(i => `<article class="card flat"><div class="row" style="justify-content:space-between;align-items:center;flex-wrap:nowrap"><div><span class="tag">${esc(i.st)}</span><h3 style="margin-top:6px">${esc(i.t)}</h3></div><button class="btn small" aria-pressed="${voted(i.id)}" data-vote="${i.id}" style="min-width:64px">${voted(i.id) ? '✓ ' : '+1 '}${i.v + (voted(i.id) ? 1 : 0)}</button></div></article>`).join('')}
  <p><button class="btn small" data-go="today">Retour</button></p>`;
}

function bind() {
  const f = $('#iform');
  if (f) f.onsubmit = e => { e.preventDefault(); S.ideas.unshift({ id: 'u' + Date.now(), t: $('#it').value.trim(), x: $('#ix').value.trim() }); save(); render(); toast('Merci, votre idée est envoyée'); };
  $$('[data-vote]').forEach(b => b.onclick = () => { const id = b.dataset.vote; S.voted = S.voted.includes(id) ? S.voted.filter(x => x !== id) : [...S.voted, id]; save(); render(); });
}

export const ideas = { html, bind };
