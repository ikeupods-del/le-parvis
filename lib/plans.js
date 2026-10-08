/* Plans de lecture. */
function ntPlan(books, n) {
  const flat = [];
  books.forEach(([b, c]) => { for (let i = 1; i <= c; i++) flat.push([b, i]); });
  const per = flat.length / n, days = [];
  for (let d = 0; d < n; d++) {
    const a = flat[Math.floor(d * per)], z = flat[Math.min(flat.length - 1, Math.ceil((d + 1) * per) - 1)];
    days.push(a[0] === z[0] ? (a[1] === z[1] ? `${a[0]} ${a[1]}` : `${a[0]} ${a[1]} à ${z[1]}`) : `${a[0]} ${a[1]} → ${z[0]} ${z[1]}`);
  }
  return days;
}

const NT_BOOKS = [["Matthieu", 28], ["Marc", 16], ["Luc", 24], ["Jean", 21], ["Actes", 28], ["Romains", 16], ["1 Corinthiens", 16], ["2 Corinthiens", 13], ["Galates", 6], ["Éphésiens", 6], ["Philippiens", 4], ["Colossiens", 4], ["1 Thessaloniciens", 5], ["2 Thessaloniciens", 3], ["1 Timothée", 6], ["2 Timothée", 4], ["Tite", 3], ["Philémon", 1], ["Hébreux", 13], ["Jacques", 5], ["1 Pierre", 5], ["2 Pierre", 3], ["1 Jean", 5], ["2 Jean", 1], ["3 Jean", 1], ["Jude", 1], ["Apocalypse", 22]];

export const PLANS = [
  { id: 'jean', name: 'Évangile de Jean', sub: '21 jours', days: Array.from({ length: 21 }, (_, i) => `Jean ${i + 1}`) },
  { id: 'psaumes', name: 'Psaumes', sub: '30 jours', days: Array.from({ length: 30 }, (_, i) => `Psaumes ${i * 5 + 1} à ${i * 5 + 5}`) },
  { id: 'proverbes', name: 'Proverbes', sub: '31 jours', days: Array.from({ length: 31 }, (_, i) => `Proverbes ${i + 1}`) },
  { id: 'nt90', name: 'Nouveau Testament', sub: '90 jours', days: ntPlan(NT_BOOKS, 90) },
  { id: 'evang30', name: 'Les quatre Évangiles', sub: '30 jours', days: ntPlan(NT_BOOKS.slice(0, 4), 30) }
];
