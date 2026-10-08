/* Les 12 versets du jour (Louis Segond 1910, domaine public).
   À garder identiques à la liste de la fonction push-send (phase 8). */
import { dayOfYear } from './util.js';

export const VERSES = [
  { t: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle.", r: "Jean 3:16" },
  { t: "L'Éternel est mon berger : je ne manquerai de rien.", r: "Psaume 23:1" },
  { t: "Je puis tout par celui qui me fortifie.", r: "Philippiens 4:13" },
  { t: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.", r: "Matthieu 11:28" },
  { t: "Ne t'effraie point et ne t'épouvante point, car l'Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.", r: "Josué 1:9" },
  { t: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse.", r: "Proverbes 3:5" },
  { t: "Ne crains rien, car je suis avec toi ; ne promène pas des regards inquiets, car je suis ton Dieu.", r: "Ésaïe 41:10" },
  { t: "Maintenant donc ces trois choses demeurent : la foi, l'espérance, la charité ; mais la plus grande de ces choses, c'est la charité.", r: "1 Corinthiens 13:13" },
  { t: "Dieu est pour nous un refuge et un appui, un secours qui ne manque jamais dans la détresse.", r: "Psaume 46:1" },
  { t: "Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne s'alarme point.", r: "Jean 14:27" },
  { t: "Ne vous inquiétez donc pas du lendemain ; car le lendemain aura soin de lui-même. À chaque jour suffit sa peine.", r: "Matthieu 6:34" },
  { t: "Le secours me vient de l'Éternel, qui a fait les cieux et la terre.", r: "Psaume 121:2" }
];

export function todayVerse() { return VERSES[dayOfYear() % VERSES.length]; }
