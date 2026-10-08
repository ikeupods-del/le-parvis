/* Écran « Lecture » : plans de lecture et progression. */
import { S, save } from '../lib/state.js';
import { $$, esc, on } from '../lib/util.js';
import { PLANS } from '../lib/plans.js';
import { render } from '../lib/router.js';

function html() {
  const p = PLANS.find(x => x.id === S.plan); const done = S.done[p.id] || []; const nextIdx = p.days.findIndex((_, i) => !done.includes(i));
  return `
  <h2>Plans de lecture</h2>
  <div class="chips" role="group" aria-label="Choisir un plan">
    ${PLANS.map(x => `<button class="chip" aria-pressed="${x.id === S.plan}" data-plan="${x.id}">${esc(x.name)}<span class="muted"> · ${esc(x.sub)}</span></button>`).join('')}
  </div>
  <p class="muted small">${done.length} jour(s) sur ${p.days.length}. Touchez un jour pour le cocher.</p>
  <div class="days">
    ${p.days.map((d, i) => `<button class="day ${i === nextIdx ? 'next' : ''}" aria-pressed="${done.includes(i)}" data-day="${i}"><b>Jour ${i + 1}</b><span>${esc(d)}</span></button>`).join('')}
  </div>
  ${done.length ? `<p style="margin-top:16px"><button class="btn small danger" id="resetPlan">Recommencer ce plan</button></p>` : ''}`;
}

function bind() {
  $$('[data-plan]').forEach(b => b.onclick = () => { S.plan = b.dataset.plan; save(); render(); });
  $$('[data-day]').forEach(b => b.onclick = () => {
    const i = +b.dataset.day; const a = S.done[S.plan] || [];
    S.done[S.plan] = a.includes(i) ? a.filter(x => x !== i) : [...a, i]; save(); render();
  });
  on('#resetPlan', () => { if (confirm('Remettre ce plan à zéro ?')) { S.done[S.plan] = []; save(); render(); } });
}

export const read = { html, bind };
