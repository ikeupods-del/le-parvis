/* Écran « Profil » : compte, pseudo, apparence, données. */
import { S, save, resetState } from '../lib/state.js';
import { $, esc, modal, on, toast } from '../lib/util.js';
import { applyTheme } from '../lib/theme.js';
import { doSignIn, signOut, savePseudo, isSimulated } from '../lib/auth.js';
import { render } from '../lib/router.js';

function html() {
  return `
  <h2>Votre profil</h2>
  <div class="card">
    <p class="small" style="margin-bottom:8px">${S.user ? `Connecté avec Google : <b>${esc(S.user.email)}</b>${isSimulated ? ' (simulation)' : ''}` : 'Non connecté. La connexion Google est requise pour les salons.'}</p>
    ${S.user ? '<button class="btn small" id="gout">Se déconnecter</button>' : '<button class="btn small" id="gsign2">Se connecter avec Google</button>'}
  </div>
  <div class="card">
    <div class="field"><label for="pseudo">Pseudo (affiché dans les salons)</label><input type="text" id="pseudo" maxlength="24" value="${esc(S.pseudo)}" placeholder="Ex. Étienne"></div>
    <div class="field"><label for="theme">Apparence</label>
      <select id="theme"><option value="auto">Automatique</option><option value="light">Clair</option><option value="dark">Sombre</option></select></div>
  </div>
  <h2>Mes outils</h2>
  <div class="card"><div class="row"><button class="btn small" data-go="church">Mon église</button><button class="btn small" data-go="maraude">Maraudes</button><button class="btn small" data-go="ideas">Boîte à idées</button></div></div>
  <h2>À propos</h2>
  <div class="card small">
    <p>Ouvert à tous, toutes confessions. Textes bibliques : Louis Segond 1910 (domaine public). Parvis est gratuit et sans publicité.</p>
    <div class="row"><button class="btn small" id="showCharter">Lire la charte</button><button class="btn small" data-go="privacy">Confidentialité</button></div>
  </div>
  <div class="card small">
    <h3>Vos données</h3>
    <p class="muted">Dans ce prototype, tout reste sur votre appareil. Vous pouvez tout effacer ici.</p>
    <div class="row"><button class="btn small" id="exportAll">Exporter mes données</button><button class="btn small danger" id="wipe">Effacer toutes mes données</button></div>
  </div>`;
}

function bind() {
  on('#gsign2', doSignIn);
  on('#gout', signOut);
  const ps = $('#pseudo'); if (ps) ps.onchange = async () => { const ok = await savePseudo(ps.value.trim()); toast(ok ? 'Pseudo enregistré' : "Pseudo non enregistré, réessayez"); };
  const th = $('#theme'); if (th) { th.value = S.theme; th.onchange = () => { S.theme = th.value; save(); applyTheme(); }; }
  on('#showCharter', () => modal(`<h3>Charte de la communauté</h3><ul><li>Respect de chacun, quelle que soit sa confession.</li><li>Pas de prosélytisme agressif, pas de débat de confession.</li><li>Pas de harcèlement, de haine ni de contenu inapproprié.</li><li>Les demandes de prière sont accueillies avec bienveillance.</li><li>Les modérateurs peuvent supprimer un message et bannir.</li></ul>`));
  on('#exportAll', () => modal(`<h3>Mes données</h3><p class="small muted">Copie de tout ce que l'application garde pour vous.</p><textarea readonly style="min-height:220px">${esc(JSON.stringify(S, null, 2))}</textarea><div style="height:12px"></div>`));
  on('#wipe', () => {
    if (confirm('Effacer carnet, progression et messages de cet appareil ?')) {
      if (window.parvisPush && window.parvisPush.deleteAll) window.parvisPush.deleteAll();
      resetState(); applyTheme(); render(); toast('Données effacées');
    }
  });
}

export const more = { html, bind };
