/* Écran « Prière » : carnet privé, statistiques, rappels. */
import { S, save } from '../lib/state.js';
import { $, $$, esc, modal, on, toast } from '../lib/util.js';
import { prayRemHtml, bindNotif } from '../lib/reminders.js';
import { render } from '../lib/router.js';

const TYPES = { demande: 'Demande', merci: 'Remerciement', intercession: "Pour quelqu'un" };

function prayStats() {
  const n = S.prayers.length, ok = S.prayers.filter(x => x.ok).length;
  const by = Object.entries(TYPES).map(([k, v]) => `${v} : ${S.prayers.filter(x => x.type === k).length}`).join(' · ');
  return `<div class="card flat"><h3 style="margin:0 0 4px">Statistiques du carnet</h3>
    <div class="statrow"><div><b>${n}</b>entrées</div><div><b>${ok}</b>exaucées</div><div><b>${n ? Math.round(ok / n * 100) : 0} %</b>d'exaucées</div></div>
    <p class="small muted" style="margin:0">${n ? esc(by) : 'Écrivez une première prière pour voir vos statistiques.'}</p></div>`;
}

function html() {
  const list = [...S.prayers].sort((a, b) => b.d - a.d);
  return `
  <h2>Carnet de prière</h2>
  <p class="muted small">Privé : seul vous le voyez. Vous pouvez tout exporter ou tout effacer.</p>
  ${prayStats()}
  ${prayRemHtml()}
  <form class="card" id="pform" autocomplete="off">
    <div class="field"><label for="ptype">Type</label>
      <select id="ptype">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label for="ptext">Votre prière</label><textarea id="ptext" maxlength="1000" placeholder="Écrivez librement…"></textarea></div>
    <button class="btn primary" type="submit">Enregistrer</button>
  </form>
  ${list.length ? list.map(x => `
    <article class="card prayer ${x.ok ? 'answered' : ''}">
      <div class="meta"><span class="tag ${x.ok ? 'ok' : ''}">${x.ok ? 'Exaucée' : esc(TYPES[x.type])}</span>${esc(new Date(x.d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      <div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(x.t)}</div>
      <div class="actions">
        <button class="btn small" data-ok="${x.id}">${x.ok ? 'Remettre en cours' : 'Marquer exaucée'}</button>
        <button class="btn small danger" data-del="${x.id}">Supprimer</button>
      </div>
    </article>`).join('') : `<div class="empty"><b>Votre carnet est vide</b>Écrivez une première prière ou un motif de gratitude.</div>`}
  ${list.length ? `<div class="row" style="margin-top:8px"><button class="btn small" id="export">Exporter en texte</button></div>` : ''}`;
}

function bind() {
  const pf = $('#pform');
  if (pf) pf.onsubmit = e => {
    e.preventDefault(); const t = $('#ptext').value.trim(); if (!t) { toast("Écrivez quelques mots d'abord"); return; }
    S.prayers.push({ id: 'p' + Date.now(), type: $('#ptype').value, t, d: Date.now(), ok: false }); save(); render(); toast('Enregistré dans votre carnet');
  };
  $$('[data-ok]').forEach(b => b.onclick = () => { const p = S.prayers.find(x => x.id === b.dataset.ok); p.ok = !p.ok; save(); render(); });
  $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Supprimer cette entrée ?')) { S.prayers = S.prayers.filter(x => x.id !== b.dataset.del); save(); render(); } });
  on('#export', () => {
    const txt = S.prayers.map(x => `[${x.ok ? 'Exaucée' : TYPES[x.type]}] ${new Date(x.d).toLocaleDateString('fr-FR')}\n${x.t}`).join('\n\n');
    modal(`<h3>Export du carnet</h3><textarea readonly style="min-height:200px">${esc(txt)}</textarea><div style="height:12px"></div>`);
  });
  bindNotif();
}

export const prayer = { html, bind };
