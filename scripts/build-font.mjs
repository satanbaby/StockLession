/**
 * 把 jf open 粉圓（4.7MB TTF）子集化成網站真正用得到的那些字。
 *
 *   node scripts/build-font.mjs      （build 前會自動跑，見 package.json 的 prebuild）
 *
 * 為什麼是「依內容子集化」而不是「unicode-range 分片」：
 *
 * 一開始用 cn-font-split 切成 104 個分片，想讓瀏覽器只抓需要的那幾片。
 * 實測結果是單一課程頁要抓 50 幾片、約 1.4MB —— 因為一篇長文的用字會散落在
 * 大半的分片裡，分片策略對「字很多的長文」根本省不到。
 *
 * 改成掃描全站實際用到的字（約 1100 個）做成單一子集後只剩一個檔、約 300KB，
 * 而且是整站共用、第一次載入之後全部命中快取。
 *
 * 代價：新增課程若用到全新的字，要重跑一次才會被收進去。
 * 所以這支腳本掛在 prebuild，正式建置一定是最新的；
 * dev 期間漏掉的字會退回系統字型，不影響閱讀。
 *
 * 字型授權：SIL OFL 1.1，可自由商用。https://github.com/justfont/open-huninn-font
 */

import subsetFont from 'subset-font';
import { readFile, writeFile, mkdir, readdir, rm, stat, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = join(ROOT, 'assets', 'fonts', 'jf-openhuninn-2.1.ttf');
const OUT_DIR = join(ROOT, 'public', 'fonts');
const OUT_FILE = join(OUT_DIR, 'huninn-subset.woff2');
const OUT_CSS = join(OUT_DIR, 'huninn.css');

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 一定要收進去的字，即使目前沒用到 —— 數字、標點、常見符號、注音 */
const ALWAYS = [
  ...' !"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'　、。〈〉《》「」『』【】〔〕（）％＋－×÷＝≈≠＜＞±°※→←↑↓─│…‧',
  ...'○●◎◇◆□■△▲▽▼☆★',
  ...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩˊˇˋ˙',
];

async function collectSourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectSourceFiles(path)));
    else if (/\.(astro|mdx|md|ts|tsx|json)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const chars = new Set(ALWAYS);
for (const file of await collectSourceFiles(join(ROOT, 'src'))) {
  for (const ch of await readFile(file, 'utf8')) chars.add(ch);
}

// 控制字元與代理對的半邊都不需要
for (const ch of [...chars]) {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x20 || (cp >= 0xd800 && cp <= 0xdfff)) chars.delete(ch);
}

const text = [...chars].join('');
console.log(`掃描到 ${chars.size} 個字元，子集化中…`);

await mkdir(OUT_DIR, { recursive: true });

const hasInputTtf = await fileExists(INPUT);
if (!hasInputTtf) {
  if (await fileExists(OUT_FILE)) {
    console.log('找不到原始字型 assets/fonts/jf-openhuninn-2.1.ttf，改用既有 public/fonts/huninn-subset.woff2。');
    console.log('若要更新字型子集，請先放回原始 TTF 再重跑 pnpm build:font。');
    process.exit(0);
  }
  throw new Error(
    '找不到原始字型 assets/fonts/jf-openhuninn-2.1.ttf，且 public/fonts/huninn-subset.woff2 也不存在。' +
      ' 請加入其中之一後再建置。',
  );
}

// 舊的分片版本留著只會佔空間又讓人困惑
await rm(join(OUT_DIR, 'huninn'), { recursive: true, force: true });

const subset = await subsetFont(await readFile(INPUT), text, { targetFormat: 'woff2' });
await writeFile(OUT_FILE, subset);

await writeFile(
  OUT_CSS,
  `/* 由 scripts/build-font.mjs 產生，請勿手改。
   jf open 粉圓（justfont）· SIL OFL 1.1 · https://github.com/justfont/open-huninn-font */
@font-face {
  font-family: "Huninn";
  src: local("jf open 粉圓"), local("jf-openhuninn"),
       url("./huninn-subset.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`,
  'utf8',
);

const original = (await stat(INPUT)).size;
console.log(
  `完成 → ${OUT_FILE}\n` +
    `  ${(original / 1024 / 1024).toFixed(2)} MB (TTF) → ${(subset.length / 1024).toFixed(0)} KB (woff2 子集)`,
);
