/* Écran « Salons » (simulés jusqu'à la phase 5). */
import { S, save } from '../lib/state.js';
import { $, $$, esc, on, toast } from '../lib/util.js';
import { ROOMS, SEED } from '../lib/demo.js';
import { doSignIn, isSimulated } from '../lib/auth.js';
import { render } from '../lib/router.js';

function html() {
  const room = ROOMS.find(r => r.id === S.room) || ROOMS[0];
  if (!S.user) return `
    <h2>Salons</h2>
    <div class="card">
      <h3>Connexion requise</h3>
      <p class="small">Pour garder les salons bienveillants, chaque membre se connecte avec son compte Google. Cela permet aux modérateurs d'agir en cas d'abus.</p>
      <button class="gbtn" id="gsign"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continuer avec Google</button>
      <p class="muted small" style="margin:12px 0 0">${isSimulated ? 'Prototype : la connexion est simulée. ' : ''}Le verset, la lecture et le carnet restent accessibles sans compte.</p>
    </div>`;
  if (!S.charter) return `
    <h2>Salons</h2>
    <div class="card">
      <h3>Avant d'entrer</h3>
      <p class="small">Ces salons sont ouverts à tous. Pour que chacun s'y sente bien :</p>
      <ul class="small" style="padding-left:20px;margin:0 0 12px">
        <li>Respectez chacun, quelle que soit sa confession.</li>
        <li>Pas de prosélytisme agressif ni de débat de confession.</li>
        <li>Pas de harcèlement, de haine ni de contenu inapproprié.</li>
        <li>Les modérateurs peuvent supprimer un message ou bannir.</li>
      </ul>
      <button class="btn primary" id="accept">J'accepte la charte</button>
    </div>`;
  const msgs = [...(SEED[room.id] || []).map(m => ({ ...m, demo: true })), ...(S.chat[room.id] || [])].filter(m => !S.blocked.includes(m.u));
  return `
  <h2>Salons</h2>
  <div class="chips" role="group" aria-label="Choisir un salon">
    ${ROOMS.map(r => `<button class="chip" aria-pressed="${r.id === S.room}" data-room="${r.id}">${esc(r.name)}</button>`).join('')}
  </div>
  <div class="demo-note"><b>Aperçu :</b> les messages en démo sont fictifs et vos messages restent sur cet appareil. Le chat réel sera branché plus tard.</div>
  <p class="muted small">${esc(room.desc)}</p>
  <div class="msgs" aria-live="polite">
    ${msgs.map(m => `<div class="msg ${m.me ? 'me' : ''}"><div class="who">${esc(m.me ? (S.pseudo || 'Moi') : m.u)}</div><div class="txt">${esc(m.t)}</div>
      ${m.me ? '' : `<div class="tools"><button data-report="${esc(m.id)}">${S.reported.includes(m.id) ? 'Signalé' : 'Signaler'}</button><button data-block="${esc(m.u)}">Bloquer ${esc(m.u)}</button></div>`}</div>`).join('') || '<div class="empty"><b>Aucun message</b>Soyez le premier à écrire ici.</div>'}
  </div>
  <form class="composer" id="cform" autocomplete="off">
    <input type="text" id="ctext" maxlength="400" placeholder="Écrire dans ${esc(room.name)}…" aria-label="Votre message">
    <button class="btn primary" type="submit">Envoyer</button>
  </form>`;
}

function bind() {
  on('#gsign', doSignIn);
  on('#accept', () => { S.charter = true; save(); render(); });
  $$('[data-room]').forEach(b => b.onclick = () => { S.room = b.dataset.room; save(); render(); });
  $$('[data-report]').forEach(b => b.onclick = () => { if (!S.reported.includes(b.dataset.report)) { S.reported.push(b.dataset.report); save(); render(); } toast('Message signalé. Un modérateur le vérifiera.'); });
  $$('[data-block]').forEach(b => b.onclick = () => { if (confirm('Bloquer ' + b.dataset.block + ' ? Ses messages seront masqués.')) { S.blocked.push(b.dataset.block); save(); render(); } });
  const cf = $('#cform');
  if (cf) cf.onsubmit = e => {
    e.preventDefault(); const t = $('#ctext').value.trim(); if (!t) return;
    (S.chat[S.room] = S.chat[S.room] || []).push({ id: 'm' + Date.now(), u: S.pseudo || 'Moi', t, me: true }); save(); render();
    const inp = $('#ctext'); if (inp) inp.focus();
  };
}

export const chat = { html, bind };
