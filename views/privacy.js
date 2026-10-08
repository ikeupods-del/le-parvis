/* Écran « Confidentialité » : brouillon à faire relire. Les [crochets] restent à compléter. */
function html() {
  return `<h2>Confidentialité</h2>
  <p class="muted small">Brouillon à faire relire avant la mise en ligne. Les passages entre crochets restent à compléter.</p>
  <div class="card small">
    <h3>Qui est responsable ?</h3><p>[Nom de l'éditeur], [adresse ou e-mail de contact].</p>
    <h3>Quelles données ?</h3>
    <ul style="padding-left:20px;margin:0 0 12px"><li>E-mail du compte Google et pseudo.</li><li>Messages écrits dans les salons.</li><li>Carnet de prière et progression de lecture.</li><li>Maraudes : vos inscriptions et, si vous organisez, les informations de la sortie. Aucune donnée sur les personnes rencontrées.</li><li>Si vous activez les rappels : un identifiant technique de votre appareil et les heures choisies.</li><li>Pour un responsable de communauté : nom, fonction, e-mail officiel et lien de vérification.</li></ul>
    <h3>Pourquoi ?</h3><p>Faire fonctionner l'application et modérer les salons. Pas de publicité ciblée, pas de revente.</p>
    <h3>Sur quelle base ?</h3><p>Votre consentement, y compris pour les données qui révèlent une pratique religieuse. Vous pouvez le retirer à tout moment.</p>
    <h3>Combien de temps ?</h3><p>Messages des salons : 7 jours. Carnet et compte : jusqu'à la suppression de votre compte. Signalements : [durée à fixer].</p>
    <h3>Qui reçoit les données ?</h3><p>Nos prestataires techniques : Google (connexion) et [Supabase] (hébergement des données).</p>
    <h3>Vos droits</h3><p>Accès, rectification, effacement, export, opposition. Écrivez à [contact]. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
    <h3>Âge minimum</h3><p>15 ans.</p>
    <h3>Mentions légales</h3><p>[Éditeur, statut, SIRET, hébergeur].</p>
  </div>
  <p><button class="btn small" data-go="more">Retour</button></p>`;
}

export const privacy = { html, bind() {} };
