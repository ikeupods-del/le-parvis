// Génère les icônes PNG à partir de public/icon.svg (à relancer si l'icône change).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
const sizes = { 'icon-180.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512 };
for (const [name, size] of Object.entries(sizes)) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('créé', name);
}
