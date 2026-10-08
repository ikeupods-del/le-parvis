/* Apparence : automatique, clair ou sombre. */
import { S } from './state.js';

export function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
}
