/* Carte de verset à partager (image dessinée dans un canvas). */
import { S, save } from '../lib/state.js';
import { $, $$, esc, modal, toast } from '../lib/util.js';
import { todayVerse } from '../lib/verses.js';

const CARD_THEMES = {
  classique: { n: 'Classique', a: '#2F4BA0', b: '#16213E', ink: '#F6F2E6', gold: '#F0C768' },
  aurore: { n: 'Aurore', a: '#F2A65A', b: '#B4476B', ink: '#FFF8EE', gold: '#FFE3A3' },
  foret: { n: 'Forêt', a: '#3F6B58', b: '#16302A', ink: '#F2F7F1', gold: '#CDE8B0' },
  nuit: { n: 'Nuit étoilée', a: '#1B1B3A', b: '#050510', ink: '#F4F1FF', gold: '#F0C768', stars: true },
  sable: { n: 'Sable', a: '#F1E3C6', b: '#D6B98A', ink: '#3A2A12', gold: '#8A5A12' },
  bordeaux: { n: 'Bordeaux', a: '#8E2F4A', b: '#3E1220', ink: '#FBEFF2', gold: '#F3C58A' }
};

function wrapText(c, text, max) {
  const w = text.split(' '); let l = ''; const out = [];
  w.forEach(x => { const t = l ? l + ' ' + x : x; if (c.measureText(t).width > max && l) { out.push(l); l = x; } else l = t; });
  if (l) out.push(l);
  return out;
}

function drawCard(cv, key) {
  const T = CARD_THEMES[key] || CARD_THEMES.classique, v = todayVerse();
  cv.width = 1080; cv.height = 1350;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
  if (T.stars) { c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 60; i++) { const x = (i * 173) % 1080, y = (i * 389) % 1350, z = 2 + (i % 3); c.fillRect(x, y, z, z); } }
  c.fillStyle = T.gold; c.fillRect(90, 170, 120, 6); c.textBaseline = 'top';
  let s = 64, lines = [];
  for (; s >= 34; s -= 2) { c.font = `italic ${s}px Georgia, "Times New Roman", serif`; lines = wrapText(c, `« ${v.t} »`, 900); if (lines.length * s * 1.35 <= 760) break; }
  c.fillStyle = T.ink; lines.forEach((l, i) => c.fillText(l, 90, 240 + i * s * 1.35));
  const y = 240 + lines.length * s * 1.35 + 40;
  c.fillStyle = T.gold; c.font = '600 40px system-ui, sans-serif'; c.fillText(v.r + ' · Louis Segond 1910', 90, y);
  c.fillStyle = T.ink; c.globalAlpha = .8; c.font = '600 34px system-ui, sans-serif'; c.fillText('Parvis', 90, 1230); c.globalAlpha = 1;
}

export function cardModal(key) {
  key = key || S.ctheme || 'classique';
  if (!CARD_THEMES[key]) key = 'classique';
  S.ctheme = key; save();
  modal(`<h3>Carte de verset</h3>
    <div class="chips" style="margin:0 -20px;padding-left:20px;padding-right:20px">${Object.entries(CARD_THEMES).map(([k, t]) => `<button class="chip" aria-pressed="${k === key}" data-ct="${k}">${esc(t.n)}</button>`).join('')}</div>
    <canvas id="vcv" style="width:100%;border-radius:12px;margin:8px 0" aria-label="Aperçu de la carte de verset"></canvas>
    <button class="btn primary" id="vsave" style="width:100%;margin-bottom:10px">Partager l'image</button>`);
  drawCard($('#vcv'), key);
  $$('[data-ct]').forEach(b => b.onclick = () => cardModal(b.dataset.ct));
  $('#vsave').onclick = () => {
    $('#vcv').toBlob(async blob => {
      if (!blob) { toast('Image impossible sur cet appareil'); return; }
      const f = new File([blob], 'verset-du-jour.png', { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { return; }
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'verset-du-jour.png'; document.body.appendChild(a); a.click(); a.remove(); toast('Image enregistrée'); } catch (e) { toast('Partage d\'image indisponible ici'); }
    });
  };
}
