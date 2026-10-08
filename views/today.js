/* Écran « Aujourd'hui » : verset, lecture, carnet, église, maraudes, idées, partenaires. */
import { S } from '../lib/state.js';
import { esc, fmtDate, modal, on, toast } from '../lib/util.js';
import { todayVerse } from '../lib/verses.js';
import { PLANS } from '../lib/plans.js';
import { PARTNERS } from '../lib/demo.js';
import { notifCard, bindNotif } from '../lib/reminders.js';
import { todayChurch } from './church.js';
import { todayMaraude } from './maraude.js';
import { cardModal } from './card.js';

function html() {
  const v = todayVerse();
  const p = PLANS.find(x => x.id === S.plan); const done = (S.done[p.id] || []); const nextIdx = p.days.findIndex((_, i) => !done.includes(i));
  const pct = Math.round(done.length / p.days.length * 100);
  return `
  <section class="arch" aria-labelledby="vt">
    <div class="date">${esc(fmtDate(new Date()))}</div>
    <blockquote id="vt">« ${esc(v.t)} »</blockquote>
    <cite>${esc(v.r)}</cite>
    <div class="src">Louis Segond 1910</div>
    <div class="row">
      <button class="btn ghost-light" id="share">Partager</button>
      <button class="btn ghost-light" id="vcard">Carte à partager</button>
    </div>
  </section>
  ${notifCard()}
  <div class="card">
    <h3>Votre lecture</h3>
    <p class="muted small" style="margin-bottom:4px">${esc(p.name)}, ${esc(p.sub)}</p>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <p class="small">${nextIdx === -1 ? 'Plan terminé. Bravo !' : `Prochaine étape : <b>${esc(p.days[nextIdx])}</b>`}</p>
    <button class="btn primary small" data-go="read">${done.length ? 'Continuer' : 'Commencer'}</button>
  </div>
  <div class="card">
    <h3>Carnet de prière</h3>
    <p class="small muted">${S.prayers.length ? `${S.prayers.filter(x => !x.ok).length} en cours, ${S.prayers.filter(x => x.ok).length} exaucée(s).` : "Rien d'écrit pour l'instant. Notez une première intention, elle reste privée."}</p>
    <button class="btn small" data-go="prayer">Ouvrir le carnet</button>
  </div>
  ${todayChurch()}
  ${todayMaraude()}
  <div class="card"><h3>Une idée pour Parvis ?</h3><p class="small muted">Proposez une fonction ou signalez un souci. Les idées les plus soutenues passent en priorité.</p><button class="btn small" data-go="ideas">Ouvrir la boîte à idées</button></div>
  <div class="partners-head"><h2>Entreprises chrétiennes à découvrir</h2><span class="lbl">Partenaires</span></div>
  <p class="muted small" style="margin-top:0">Ces entreprises soutiennent le projet. Leur présence ici est un partenariat.</p>
  <div class="partners" role="list">
    ${PARTNERS.map(p => `<article class="partner" role="listitem"><div class="cat">${esc(p.c)}</div><h3>${esc(p.n)}</h3><p>${esc(p.d)}</p></article>`).join('')}
    <article class="partner cta" role="listitem"><div><div class="cat">Votre entreprise</div><h3>Devenir partenaire</h3><p>Présentez votre activité à la communauté et aidez à financer l'application.</p></div><button class="btn small" id="becomePartner">En savoir plus</button></article>
  </div>`;
}

function bind() {
  on('#share', async () => {
    const v = todayVerse(); const txt = `« ${v.t} » — ${v.r} (Louis Segond 1910)`;
    try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(txt); toast('Verset copié'); } catch (e) { toast('Copie impossible sur cet appareil'); }
  });
  on('#vcard', () => cardModal());
  on('#becomePartner', () => modal(`<h3>Devenir partenaire</h3><p>Les entreprises chrétiennes peuvent figurer dans ce bandeau en soutenant le projet. Chaque partenaire est clairement identifié comme tel, et les emplacements sont limités. Les modalités et le contact seront ajoutés ici.</p>`));
  bindNotif();
}

export const today = { html, bind };
