/* Point d'entrée de Parvis. */
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500.css';
import './styles/main.css';

import { S } from './lib/state.js';
import { applyTheme } from './lib/theme.js';
import { setViews, hasView, render } from './lib/router.js';
import { checkNotif, syncReminders } from './lib/reminders.js';
import { today } from './views/today.js';
import { read } from './views/read.js';
import { prayer } from './views/prayer.js';
import { chat } from './views/chat.js';
import { more } from './views/more.js';
import { church } from './views/church.js';
import { ideas } from './views/ideas.js';
import { maraude } from './views/maraude.js';
import { privacy } from './views/privacy.js';

setViews({ today, read, prayer, chat, more, church, ideas, maraude, privacy });

/* Un onglet enregistré par une ancienne version (fil, groupes…) n'existe plus. */
if (!hasView(S.tab)) S.tab = 'today';
try {
  const q = new URLSearchParams(location.search).get('tab');
  if (q && hasView(q)) S.tab = q;
} catch (e) {}

applyTheme();
render();
setInterval(checkNotif, 30000);
syncReminders();

/* Installation et usage hors connexion (uniquement sur le site publié). */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
