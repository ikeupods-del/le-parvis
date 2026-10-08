/* Rappels : verset du matin et moments de prière. */
import { S, save } from './state.js';
import { $, $$, esc, mins, TIMEINPUT, toast } from './util.js';
import { render } from './router.js';
import { todayVerse } from './verses.js';

export const MAX_PRAY_REM = 5;

function bgPush() { return !!(window.parvisPush && window.parvisPush.supported); }

export function notifCard() {
  const n = S.notif || { on: false, time: '08:00' };
  return `<div class="card"><h3>Le verset chaque matin</h3>
    <p class="small muted">${n.on ? `Rappel activé à ${esc(n.time)}.` : 'Recevez le verset du jour en notification.'}</p>
    <div class="row" style="align-items:flex-end">
      <div class="field" style="margin:0"><label for="ntime">Heure</label><input type="time" id="ntime" value="${esc(n.time)}" style="${TIMEINPUT}"></div>
      <button class="btn small ${n.on ? '' : 'primary'}" id="ntoggle">${n.on ? 'Désactiver' : 'Activer'}</button>
    </div>
    <p class="small muted" style="margin:10px 0 0">${bgPush() ? "Le rappel arrive même application fermée, une fois l'application installée sur l'écran d'accueil." : "Prototype : le rappel s'affiche tant que l'application est ouverte."}</p></div>`;
}

export function prayRemHtml() {
  const l = S.prayRem || [];
  return `<h2 style="font-size:20px;margin-top:20px">Rappels de prière</h2>
  <p class="muted small">Un rappel quotidien pour prendre un temps de prière. Jusqu'à ${MAX_PRAY_REM} rappels.</p>
  ${l.map(r => `<div class="card flat" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><h3 style="margin:0">${esc(r.label)}</h3><p class="small muted" style="margin:0">Tous les jours à ${esc(r.time)}</p></div><div class="row" style="flex-wrap:nowrap"><button class="btn small" data-rmtoggle="${esc(r.id)}">${r.on ? 'Actif' : 'En pause'}</button><button class="btn small danger" data-rmdel="${esc(r.id)}" aria-label="Supprimer le rappel ${esc(r.label)}">✕</button></div></div>`).join('')}
  ${l.length < MAX_PRAY_REM ? `<form class="card" id="rmform" autocomplete="off"><div class="field"><label for="rml">Nom du rappel</label><input type="text" id="rml" maxlength="40" placeholder="Prière du soir"></div><div class="field"><label for="rmt">Heure</label><input type="time" id="rmt" value="21:00" required style="${TIMEINPUT}"></div><button class="btn small primary" type="submit">Ajouter le rappel</button></form>` : ''}`;
}

function notify(title, body) { try { new Notification(title, { body }); return true; } catch (e) { return false; } }
function sendVerse() { const v = todayVerse(); return notify('Verset du jour', `« ${v.t} » — ${v.r}`); }

async function ensurePerm() {
  if (!('Notification' in window)) { toast('Notifications indisponibles sur cet appareil'); return false; }
  let p = Notification.permission;
  try { if (p !== 'granted') p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
  if (p !== 'granted') { toast('Autorisation refusée. Activez-la dans les réglages du navigateur.'); return false; }
  return true;
}

function buildReminders() {
  const out = []; const n = S.notif;
  if (n && n.on) out.push({ id: 'verse', kind: 'verse', label: '', time: n.time });
  (S.prayRem || []).filter(r => r.on).forEach(r => out.push({ id: r.id, kind: 'prayer', label: r.label, time: r.time }));
  return out;
}

export function syncReminders() { if (window.parvisPush && window.parvisPush.sync) window.parvisPush.sync(buildReminders()); }

/* Tant que l'application est ouverte : vérifie toutes les 30 s s'il faut notifier. */
export function checkNotif() {
  if (window.parvisPush && window.parvisPush.active) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(), hm = now.toTimeString().slice(0, 5), day = now.toDateString(), n = S.notif;
  if (n && n.on && hm >= n.time && n.last !== day && sendVerse()) { n.last = day; save(); }
  (S.prayRem || []).forEach(r => {
    const late = mins(hm) - mins(r.time);
    if (r.on && r.last !== day && late >= 0 && late <= 120 && notify('Moment de prière', r.label)) { r.last = day; save(); }
  });
}

async function toggleNotif() {
  const n = S.notif;
  if (n.on) { n.on = false; save(); render(); syncReminders(); toast('Rappel désactivé'); return; }
  if (!(await ensurePerm())) return;
  n.on = true; n.last = ''; save(); render(); syncReminders(); sendVerse(); toast("Rappel activé. Un essai vient d'être envoyé.");
}

export function bindNotif() {
  const t = $('#ntoggle'); if (t) t.onclick = toggleNotif;
  const i = $('#ntime'); if (i) i.onchange = () => { S.notif.time = i.value || '08:00'; S.notif.last = ''; save(); render(); syncReminders(); };
  const f = $('#rmform');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); if (!(await ensurePerm())) return;
    S.prayRem.push({ id: 'r' + Date.now(), label: $('#rml').value.trim() || 'Moment de prière', time: $('#rmt').value || '21:00', on: true, last: '' });
    save(); render(); syncReminders(); toast('Rappel ajouté');
  };
  $$('[data-rmtoggle]').forEach(b => b.onclick = () => { const r = S.prayRem.find(x => x.id === b.dataset.rmtoggle); r.on = !r.on; save(); render(); syncReminders(); });
  $$('[data-rmdel]').forEach(b => b.onclick = () => { S.prayRem = S.prayRem.filter(x => x.id !== b.dataset.rmdel); save(); render(); syncReminders(); });
}
