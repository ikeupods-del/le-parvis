/* Écran « Mon église » : choix de la communauté, horaires, annonces, demande responsable. */
import { S, save } from '../lib/state.js';
import { $, $$, esc, on, toast } from '../lib/util.js';
import { CHURCHES, CONFS, ROLES } from '../lib/demo.js';
import { doSignIn } from '../lib/auth.js';
import { render } from '../lib/router.js';

const top = () => window.scrollTo(0, 0);

function churches() { return CHURCHES.concat(S.mine ? [S.mine] : []); }
export function myChurch() { return churches().find(c => c.id === S.church) || null; }
function filteredChurches() {
  const q = S.q.trim().toLowerCase();
  return churches().filter(c => (!S.conf || c.f === S.conf) && (!q || (c.n + ' ' + c.v).toLowerCase().includes(q)));
}

function listHtml() {
  const l = filteredChurches();
  return l.length ? l.map(c => `<article class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div><h3>${esc(c.n)}</h3><p class="muted small" style="margin:0">${esc(c.v)}</p></div><span class="tag" style="margin:0">${esc(c.f)}</span></div>
    ${c.mine ? '<p style="margin:8px 0 0"><span class="tag ok">Responsable vérifié</span></p>' : ''}
    <div style="height:10px"></div><button class="btn small primary" data-pick="${esc(c.id)}">Choisir comme mon église</button></article>`).join('')
    : `<div class="empty"><b>Aucun résultat</b>Essayez une autre ville ou retirez le filtre.</div>`;
}

function reqCard() {
  const r = S.req;
  if (!r) return `<div class="card"><h3>Vous êtes prêtre, pasteur ou responsable ?</h3><p class="small muted">Demandez à gérer la page de votre communauté : horaires et annonces. Chaque demande est vérifiée avant d'être activée.</p><button class="btn small" id="joinForm">Faire une demande</button></div>`;
  if (r.status === 'pending') return `<div class="card"><h3>Demande en cours de vérification</h3><p class="small">${esc(r.church)}, ${esc(r.city)}. Nous vérifions auprès d'une source officielle (site du diocèse ou de l'église, e-mail de la paroisse) avant d'activer l'espace responsable.</p><div class="row"><button class="btn small" id="approve">Simuler la validation (démo)</button><button class="btn small danger" id="cancelReq">Annuler la demande</button></div></div>`;
  return `<div class="card"><h3>Espace responsable</h3><p class="small"><span class="tag ok">Vérifié</span>${esc(r.church)}</p><button class="btn small primary" id="manage">Gérer ma page</button></div>`;
}

function viewChurchList() {
  return `<h2>Mon église</h2>
  <p class="muted small">Choisissez votre paroisse ou communauté pour suivre ses horaires et ses annonces.</p>
  <div class="demo-note">Les communautés affichées sont des exemples fictifs.</div>
  <div class="field"><label for="csearch">Rechercher</label><input type="text" id="csearch" value="${esc(S.q)}" placeholder="Nom ou ville"></div>
  <div class="chips" role="group" aria-label="Filtrer par confession">
    <button class="chip" aria-pressed="${S.conf === ''}" data-conf="">Toutes</button>
    ${CONFS.map(c => `<button class="chip" aria-pressed="${S.conf === c}" data-conf="${c}">${c}</button>`).join('')}
  </div>
  <div id="clist">${listHtml()}</div>
  ${reqCard()}`;
}

function viewChurchHome(c) {
  const anns = c.a || [];
  return `<h2>Mon église</h2>
  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div><h3 style="font-family:var(--serif);font-weight:500;font-size:22px">${esc(c.n)}</h3><p class="muted small" style="margin:0">${esc(c.v)}</p></div><span class="tag" style="margin:0">${esc(c.f)}</span></div>
    ${c.mine ? '<p style="margin:8px 0 0"><span class="tag ok">Responsable vérifié</span></p>' : ''}
  </div>
  <div class="card"><h3>Horaires</h3><p class="small" style="margin:0;white-space:pre-wrap">${c.h ? esc(c.h) : 'Pas encore renseignés.'}</p></div>
  <h2 style="font-size:20px">Annonces</h2>
  ${anns.length ? anns.map(a => `<article class="card flat"><h3>${esc(a.t)}</h3><p class="small" style="margin:0;white-space:pre-wrap">${esc(a.x)}</p></article>`).join('') : "<div class=\"empty\"><b>Aucune annonce</b>Le responsable de la communauté n'en a pas encore publié.</div>"}
  <div class="row" style="margin-top:8px"><button class="btn small" id="changeChurch">Changer d'église</button><button class="btn small" data-go="maraude">Maraudes</button>${c.mine && S.req && S.req.status === 'ok' ? '<button class="btn small primary" id="manage">Gérer ma page</button>' : ''}</div>
  ${reqCard()}`;
}

function viewChurchForm() {
  if (!S.user) return `<h2>Demande responsable</h2><div class="card"><h3>Connexion requise</h3><p class="small">Connectez-vous avec Google avant de faire une demande. Cela nous permet de vous recontacter et de modérer.</p><button class="gbtn" id="gsign3">Continuer avec Google</button><p style="margin-top:12px"><button class="btn small" id="backchurch">Retour</button></p></div>`;
  const opt = a => a.map(x => `<option>${x}</option>`).join('');
  return `<h2>Demande responsable</h2>
  <p class="muted small">Réservé aux prêtres, pasteurs, diacres et responsables de communauté. Nous vérifions chaque demande avant d'activer la page.</p>
  <form class="card" id="rform" autocomplete="off">
    <div class="field"><label for="rn">Nom et prénom</label><input type="text" id="rn" required maxlength="80"></div>
    <div class="field"><label for="rrole">Fonction</label><select id="rrole">${opt(ROLES)}</select></div>
    <div class="field"><label for="rchurch">Nom de la paroisse ou de l'église</label><input type="text" id="rchurch" required maxlength="100"></div>
    <div class="field"><label for="rcity">Ville</label><input type="text" id="rcity" required maxlength="60"></div>
    <div class="field"><label for="rconf">Confession</label><select id="rconf">${opt(CONFS)}</select></div>
    <div class="field"><label for="rmail">E-mail officiel de la paroisse</label><input type="text" id="rmail" required maxlength="120" inputmode="email" placeholder="contact@votre-paroisse.fr"></div>
    <div class="field"><label for="rlink">Lien de vérification</label><input type="text" id="rlink" required maxlength="200" placeholder="Page de votre paroisse sur le site du diocèse ou de l'église"></div>
    <div class="field"><label style="display:flex;gap:10px;font-weight:500;align-items:flex-start"><input type="checkbox" id="rcharter" required style="margin-top:4px"><span>Je confirme représenter cette communauté et j'accepte la charte de Parvis.</span></label></div>
    <div class="row"><button class="btn primary" type="submit">Envoyer ma demande</button><button class="btn" type="button" id="backchurch">Retour</button></div>
  </form>`;
}

function viewManage() {
  const m = S.mine;
  return `<h2>Espace responsable</h2>
  <p><span class="tag ok">Vérifié</span>${esc(m.n)}, ${esc(m.v)}</p>
  <form class="card" id="hform"><div class="field"><label for="hval">Horaires (messes, cultes, permanences)</label><textarea id="hval" maxlength="500">${esc(m.h || '')}</textarea></div><button class="btn small primary" type="submit">Enregistrer les horaires</button></form>
  <form class="card" id="aform" autocomplete="off"><h3>Nouvelle annonce</h3>
    <div class="field"><label for="at">Titre</label><input type="text" id="at" required maxlength="80"></div>
    <div class="field"><label for="ax">Message</label><textarea id="ax" required maxlength="600"></textarea></div>
    <button class="btn small primary" type="submit">Publier</button></form>
  ${(m.a || []).map((a, i) => `<article class="card flat"><h3>${esc(a.t)}</h3><p class="small" style="white-space:pre-wrap">${esc(a.x)}</p><button class="btn small danger" data-delann="${i}">Supprimer</button></article>`).join('')}
  <p><button class="btn small" id="backchurch">Retour à ma page</button></p>`;
}

function html() {
  if (S.cv === 'form') return viewChurchForm();
  if (S.cv === 'manage' && S.mine) return viewManage();
  const c = myChurch();
  return c ? viewChurchHome(c) : viewChurchList();
}

/* Petite carte de l'écran « Aujourd'hui ». */
export function todayChurch() {
  const c = myChurch();
  if (!c) return `<div class="card"><h3>Mon église</h3><p class="small muted">Choisissez votre communauté pour voir ses horaires et ses annonces ici.</p><button class="btn small" data-go="church">Choisir mon église</button></div>`;
  const a = (c.a || [])[0];
  return `<div class="card"><h3>${esc(c.n)}</h3>${a ? `<p class="small" style="margin-bottom:4px"><b>${esc(a.t)}</b></p><p class="small muted">${esc(a.x)}</p>` : '<p class="small muted">Aucune annonce pour le moment.</p>'}<button class="btn small" data-go="church">Voir ma page</button></div>`;
}

function bind() {
  const pick = () => $$('[data-pick]').forEach(b => b.onclick = () => { S.church = b.dataset.pick; S.cv = 'home'; save(); render(); top(); toast('Église choisie'); });
  pick();
  const cs = $('#csearch'); if (cs) cs.oninput = () => { S.q = cs.value; $('#clist').innerHTML = listHtml(); pick(); };
  $$('[data-conf]').forEach(b => b.onclick = () => { S.conf = b.dataset.conf; render(); });
  on('#changeChurch', () => { S.church = null; save(); render(); });
  on('#joinForm', () => { S.cv = 'form'; save(); render(); top(); });
  on('#backchurch', () => { S.cv = 'home'; save(); render(); top(); });
  on('#gsign3', doSignIn);
  const rf = $('#rform');
  if (rf) rf.onsubmit = e => {
    e.preventDefault();
    S.req = { name: $('#rn').value.trim(), role: $('#rrole').value, church: $('#rchurch').value.trim(), city: $('#rcity').value.trim(), conf: $('#rconf').value, mail: $('#rmail').value.trim(), link: $('#rlink').value.trim(), status: 'pending' };
    S.cv = 'home'; save(); render(); top(); toast('Demande envoyée');
  };
  on('#approve', () => {
    S.req.status = 'ok';
    S.mine = { id: 'mine', n: S.req.church, v: S.req.city, f: S.req.conf, h: '', a: [], mine: true };
    S.church = 'mine'; save(); render(); toast('Validé (simulation)');
  });
  on('#cancelReq', () => { if (confirm('Annuler votre demande ?')) { if (S.church === 'mine') S.church = null; S.req = null; S.mine = null; S.cv = 'home'; save(); render(); } });
  on('#manage', () => { S.cv = 'manage'; save(); render(); top(); });
  const hf = $('#hform'); if (hf) hf.onsubmit = e => { e.preventDefault(); S.mine.h = $('#hval').value.trim(); save(); toast('Horaires enregistrés'); };
  const af = $('#aform'); if (af) af.onsubmit = e => { e.preventDefault(); S.mine.a.unshift({ t: $('#at').value.trim(), x: $('#ax').value.trim() }); save(); render(); toast('Annonce publiée'); };
  $$('[data-delann]').forEach(b => b.onclick = () => { if (confirm('Supprimer cette annonce ?')) { S.mine.a.splice(+b.dataset.delann, 1); save(); render(); } });
}

export const church = { html, bind };
