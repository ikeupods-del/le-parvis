/* Écran « Maraudes » : liste, inscription, organisation d'une maraude. */
import { S, save } from '../lib/state.js';
import { $, $$, esc, isoDay, on, TIMEINPUT, toast } from '../lib/util.js';
import { MAR_NEEDS, SEEDMAR } from '../lib/demo.js';
import { doSignIn } from '../lib/auth.js';
import { myChurch } from './church.js';
import { render } from '../lib/router.js';

const top = () => window.scrollTo(0, 0);

function allMar() { return SEEDMAR.concat(S.maraudes.filter(m => m.status === 'ok')); }
function upcomingMar() { return allMar().filter(m => new Date(m.d + 'T' + m.h) > new Date()).sort((a, b) => (a.d + a.h < b.d + b.h ? -1 : 1)); }
function marWhen(m) { return new Date(m.d + 'T' + m.h).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + m.h.replace(':', 'h'); }

function marCard(m) {
  const joined = !!S.joined[m.id], total = m.got + (joined ? 1 : 0), full = total >= m.need && !joined, contrib = S.joined[m.id] || [];
  const chip = 'min-height:36px;padding:4px 12px;font-size:14px';
  return `<article class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div><h3>${esc(m.t)}</h3><p class="muted small" style="margin:0">${esc(m.o)}</p></div><span class="tag" style="margin:0;white-space:nowrap">${total}/${m.need} bénévoles</span></div>
    <p class="small" style="margin:8px 0">${esc(marWhen(m))}<br>Départ : ${esc(m.p)}, ${esc(m.c)}</p>
    ${m.n ? `<p class="small muted" style="white-space:pre-wrap">${esc(m.n)}</p>` : ''}
    ${m.needs.length ? `<p class="small" style="margin:0 0 6px"><b>${joined ? 'Je peux apporter :' : 'On a besoin de :'}</b></p><div class="row" style="margin-bottom:10px">${joined
      ? m.needs.map(x => `<button class="chip" style="${chip}" aria-pressed="${contrib.includes(x)}" data-bring="${esc(m.id)}" data-item="${esc(x)}">${esc(x)}</button>`).join('')
      : m.needs.map(x => `<span class="tag" style="margin:0">${esc(x)}</span>`).join('')}</div>` : ''}
    ${m.mine ? '<span class="tag ok">Vous organisez</span>' : (joined ? `<button class="btn small danger" data-leave="${esc(m.id)}">Me désinscrire</button>` : `<button class="btn small primary" data-join="${esc(m.id)}" ${full ? 'disabled' : ''}>${full ? 'Complet' : 'Je participe'}</button>`)}
  </article>`;
}

/* Petite carte de l'écran « Aujourd'hui ». */
export function todayMaraude() {
  const m = upcomingMar()[0];
  return `<div class="card"><h3>Maraudes</h3>${m ? `<p class="small" style="margin-bottom:4px"><b>${esc(m.t)}</b></p><p class="small muted">${esc(marWhen(m))}, ${esc(m.c)}</p>` : '<p class="small muted">Aucune maraude prévue pour le moment.</p>'}<button class="btn small" data-go="maraude">Voir les maraudes</button></div>`;
}

function viewMarForm() {
  if (!S.user) return `<h2>Organiser une maraude</h2><div class="card"><h3>Connexion requise</h3><p class="small">Connectez-vous avec Google pour proposer une maraude. Cela permet à l'équipe de modération de relire les propositions.</p><button class="gbtn" id="gsign4">Continuer avec Google</button><p style="margin-top:12px"><button class="btn small" id="mback">Retour</button></p></div>`;
  return `<h2>Organiser une maraude</h2>
  <p class="muted small">Votre proposition est relue avant d'être visible. Indiquez un point de départ public (parvis, salle paroissiale), jamais un domicile.</p>
  <form class="card" id="mform" autocomplete="off">
    <div class="field"><label for="mt">Titre</label><input type="text" id="mt" required maxlength="60" placeholder="Maraude du jeudi soir"></div>
    <div class="row" style="flex-wrap:nowrap"><div class="field" style="flex:1"><label for="md">Date</label><input type="date" id="md" required min="${isoDay(0)}" style="${TIMEINPUT};width:100%"></div><div class="field" style="flex:1"><label for="mh">Heure</label><input type="time" id="mh" value="19:00" required style="${TIMEINPUT};width:100%"></div></div>
    <div class="field"><label for="mp">Point de départ</label><input type="text" id="mp" required maxlength="80" placeholder="Parking de l'église"></div>
    <div class="field"><label for="mc">Ville</label><input type="text" id="mc" required maxlength="60"></div>
    <div class="field"><label for="mn">Nombre de bénévoles souhaité</label><input type="text" id="mn" inputmode="numeric" value="6" required maxlength="2"></div>
    <div class="field"><label>Ce dont on a besoin</label><div class="row">${MAR_NEEDS.map(x => `<label style="display:flex;gap:6px;align-items:center;font-weight:500;font-size:14px;margin:0 8px 6px 0"><input type="checkbox" name="mneed" value="${esc(x)}">${esc(x)}</label>`).join('')}</div></div>
    <div class="field"><label for="mx">Précisions (facultatif)</label><textarea id="mx" maxlength="300" style="min-height:70px"></textarea></div>
    <div class="field"><label style="display:flex;gap:10px;font-weight:500;align-items:flex-start"><input type="checkbox" id="mcharter" required style="margin-top:4px"><span>Je m'engage à respecter les bonnes pratiques et la charte de Parvis.</span></label></div>
    <div class="row"><button class="btn primary" type="submit">Envoyer pour validation</button><button class="btn" type="button" id="mback">Retour</button></div>
  </form>`;
}

function html() {
  if (S.mv === 'form') return viewMarForm();
  const up = upcomingMar();
  return `<h2>Maraudes</h2>
  <p class="muted small">Une maraude est une tournée en équipe à la rencontre des personnes sans abri. Rejoignez-en une ou organisez la vôtre.</p>
  <div class="demo-note">Les maraudes affichées sont des exemples fictifs.</div>
  <details class="card"><summary style="font-weight:600;cursor:pointer;min-height:32px">Bonnes pratiques</summary>
    <ul class="small" style="padding-left:20px;margin:10px 0 0">
      <li>Partez à plusieurs, au moins trois personnes, avec un responsable d'équipe.</li>
      <li>Proposez, n'imposez rien : chacun est libre d'accepter ou de refuser.</li>
      <li>Pas de photos des personnes rencontrées, pas de prosélytisme.</li>
      <li>Gardez pour vous ce que vous apprenez sur les personnes.</li>
      <li>Urgence sociale en France : 115. Danger vital : 112.</li>
      <li>Coordonnez-vous avec les associations locales déjà présentes.</li>
    </ul></details>
  <button class="btn primary" id="newMar" style="margin-bottom:8px">Organiser une maraude</button>
  ${S.maraudes.length ? `<h3 style="margin:16px 0 8px">Vos propositions</h3>` + S.maraudes.map(m => `<article class="card flat"><span class="tag ${m.status === 'ok' ? 'ok' : ''}">${m.status === 'ok' ? 'Publiée' : 'En attente de validation'}</span><h3 style="margin-top:6px">${esc(m.t)}</h3><p class="small muted" style="margin:0 0 8px">${esc(marWhen(m))}, ${esc(m.c)}</p><div class="row">${m.status === 'ok' ? '' : `<button class="btn small" data-mok="${esc(m.id)}">Simuler la validation (démo)</button>`}<button class="btn small danger" data-mdel="${esc(m.id)}">Supprimer</button></div></article>`).join('') : ''}
  <h3 style="margin:16px 0 8px">Prochaines maraudes</h3>
  ${up.length ? up.map(marCard).join('') : '<div class="empty"><b>Aucune maraude prévue</b>Organisez la première.</div>'}
  <p><button class="btn small" data-go="today">Retour</button></p>`;
}

function bind() {
  on('#newMar', () => { S.mv = 'form'; save(); render(); top(); });
  on('#mback', () => { S.mv = 'list'; save(); render(); top(); });
  on('#gsign4', doSignIn);
  $$('[data-join]').forEach(b => b.onclick = () => { if (!S.user) { doSignIn(); return; } S.joined[b.dataset.join] = []; save(); render(); toast('Inscription enregistrée'); });
  $$('[data-leave]').forEach(b => b.onclick = () => { delete S.joined[b.dataset.leave]; save(); render(); toast('Désinscription enregistrée'); });
  $$('[data-bring]').forEach(b => b.onclick = () => { const a = S.joined[b.dataset.bring] || [], x = b.dataset.item; S.joined[b.dataset.bring] = a.includes(x) ? a.filter(y => y !== x) : [...a, x]; save(); render(); });
  $$('[data-mok]').forEach(b => b.onclick = () => { const m = S.maraudes.find(x => x.id === b.dataset.mok); m.status = 'ok'; save(); render(); toast('Validée (simulation)'); });
  $$('[data-mdel]').forEach(b => b.onclick = () => { if (confirm('Supprimer cette proposition ?')) { S.maraudes = S.maraudes.filter(x => x.id !== b.dataset.mdel); save(); render(); } });
  const f = $('#mform');
  if (f) f.onsubmit = e => {
    e.preventDefault();
    const d = $('#md').value, h = $('#mh').value;
    if (new Date(d + 'T' + h) <= new Date()) { toast('Choisissez une date à venir'); return; }
    const need = Math.min(50, Math.max(2, parseInt($('#mn').value, 10) || 6));
    S.maraudes.unshift({
      id: 'um' + Date.now(), t: $('#mt').value.trim(), o: (myChurch() || {}).n || S.pseudo || 'Un membre', d, h, p: $('#mp').value.trim(), c: $('#mc').value.trim(), need, got: 1,
      needs: [...document.querySelectorAll('[name=mneed]:checked')].map(x => x.value), n: $('#mx').value.trim(), mine: true, status: 'pending'
    });
    S.mv = 'list'; save(); render(); top(); toast('Proposition envoyée pour validation');
  };
}

export const maraude = { html, bind };
