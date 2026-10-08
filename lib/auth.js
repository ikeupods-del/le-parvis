/* Connexion (simulée jusqu'à la phase 3) et consentement RGPD. */
import { S, save } from './state.js';
import { $, closeOverlay, toast } from './util.js';
import { go, render } from './router.js';

export function doSignIn() {
  const fin = () => { S.user = { email: 'prenom.nom@gmail.com' }; save(); render(); toast('Connecté (simulation)'); };
  if (S.consent) { fin(); return; }
  $('#overlay').innerHTML = `<div class="modal-back" id="mb"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="ct">
    <h3 id="ct">Avant de vous connecter</h3>
    <p class="small">Une appartenance ou une pratique religieuse est une donnée sensible. Nous utilisons seulement votre e-mail Google et votre pseudo, pour permettre la modération des salons. Nous ne les vendons pas et n'affichons aucune publicité ciblée.</p>
    <label style="display:flex;gap:10px;font-weight:500;align-items:flex-start;margin-bottom:12px"><input type="checkbox" id="c1" style="margin-top:4px"><span>J'ai 15 ans ou plus et j'accepte le traitement de mes données décrit dans la politique de confidentialité.</span></label>
    <div class="row"><button class="btn primary" id="cok" disabled>Continuer</button><button class="btn" id="cpol">Lire la politique</button><button class="btn" id="cno">Annuler</button></div></div></div>`;
  const c = $('#c1'), ok = $('#cok');
  c.onchange = () => ok.disabled = !c.checked;
  ok.onclick = () => { S.consent = true; closeOverlay(); fin(); };
  $('#cno').onclick = closeOverlay;
  $('#cpol').onclick = () => { closeOverlay(); go('privacy'); };
  c.focus();
}
