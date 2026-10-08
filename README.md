# Parvis

Application web chrétienne, gratuite et sans publicité : verset du jour, plans de lecture, carnet de prière, salons, Mon église, maraudes.

## Organisation du code

- `index.html` : page d'accueil (vide, tout est dessiné par `main.js`).
- `main.js` : point d'entrée.
- `views/` : un fichier par écran (Aujourd'hui, Lecture, Prière, Salons, Profil, Mon église, Maraudes, Idées, Confidentialité).
- `lib/` : état et stockage (`state.js`), navigation (`router.js`), versets (`verses.js`), plans (`plans.js`), rappels, connexion, données d'exemple (`demo.js`).
- `styles/main.css` : toute l'apparence.
- `public/` : manifeste d'installation, icônes, service worker (`sw.js`).
- `scripts/make-icons.mjs` : régénère les icônes PNG depuis `public/icon.svg`.
- `reference/prototype-v1.html` : copie intacte du prototype d'origine.
- `.github/workflows/deploy.yml` : déploiement automatique sur GitHub Pages à chaque envoi sur `main`.

## Lancer en local

```bash
npm install
npm run dev
```

Aucun secret dans ce dépôt : voir `.env.example`. Les polices sont hébergées par le site lui-même (aucune requête vers Google).
