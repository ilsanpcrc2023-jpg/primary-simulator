import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/og-image.svg');

await sharp(svg, { density: 96 })
  .resize(1200, 630)
  .png({ quality: 90 })
  .toFile('public/og-image.png');

console.log('wrote public/og-image.png (1200x630)');
