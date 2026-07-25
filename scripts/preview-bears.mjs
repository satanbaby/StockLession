/**
 * Builds a 3 × 8 contact sheet from the real mood-specific bear assets.
 * Run with: node scripts/preview-bears.mjs
 */

import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'preview-bears.png');

const SCALE = 2;
const CELL = 130 * SCALE;
const COLS = 8;
const HEADER = 34 * SCALE;
const ROWS = 3;
const W = CELL * COLS;
const H = HEADER + CELL * ROWS;
const ART = 118 * SCALE;

const MOODS = [
  ['neutral', '平常'],
  ['happy', '開心'],
  ['excited', '興奮'],
  ['worried', '擔心'],
  ['thinking', '思考'],
  ['shocked', '震驚'],
  ['proud', '得意'],
  ['sleepy', '想睡'],
];
const BEARS = ['grizzly', 'panda', 'ice-bear'];

const labels = MOODS.map(
  ([, label], index) =>
    `<text x="${index * CELL + CELL / 2}" y="44" text-anchor="middle" font-size="30" font-weight="700" fill="#776b66">${label}</text>`,
).join('');

const guides = Array.from(
  { length: ROWS + 1 },
  (_, row) =>
    `<line x1="0" y1="${HEADER + row * CELL}" x2="${W}" y2="${HEADER + row * CELL}" stroke="#e4d6c6" stroke-width="2"/>`,
).join('');

const background = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#fff8f0"/>
    <style>text{font-family:"Microsoft JhengHei",sans-serif}</style>
    ${guides}${labels}
  </svg>`,
);

const assets = BEARS.flatMap((bear) =>
  MOODS.map(([mood]) => join(ROOT, `public/images/bears/${bear}/${mood}.webp`)),
);
const resized = await Promise.all(
  assets.map((asset) =>
    sharp(asset).resize(ART, ART, { fit: 'contain', position: 'center' }).png().toBuffer(),
  ),
);

const cells = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    cells.push({
      input: resized[row * COLS + col],
      left: col * CELL + Math.round((CELL - ART) / 2),
      top: HEADER + row * CELL + Math.round((CELL - ART) / 2),
    });
  }
}

await sharp(background).composite(cells).png().toFile(OUT);
console.log(`Wrote ${OUT} (${W}×${H})`);
