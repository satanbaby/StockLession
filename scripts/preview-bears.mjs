/**
 * 產生角色接觸表（contact sheet）：3 隻 × 8 表情拼成一張 PNG。
 *
 *   npm run dev            # 另一個終端機先跑起來
 *   node scripts/preview-bears.mjs
 *
 * 為什麼要這個：改造型時，在瀏覽器上一格一格看很容易漏掉某個組合壞掉
 * （例如某個表情被眼鏡遮住、或某隻熊的閉眼弧線壓到黑眼圈）。
 * 拼成一張圖就一眼看得完。
 *
 * 直接從 dev server 抓已經渲染好的 /bears 頁面，
 * 所以看到的跟瀏覽器裡的完全是同一份 SVG，不會有第二套渲染邏輯。
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.PREVIEW_URL ?? 'http://localhost:4321/bears';
const OUT = join(ROOT, 'preview-bears.png');

const CELL = 130;
const COLS = 8;
const HEADER = 34;

const MOODS = ['平常', '開心', '興奮', '擔心', '思考', '震驚', '得意', '想睡'];

const res = await fetch(SRC).catch(() => null);
if (!res?.ok) {
  console.error(`抓不到 ${SRC}。請先在另一個終端機執行 npm run dev。`);
  process.exit(1);
}
const html = await res.text();

// 表情總表在 <table class="grid"> 裡，每一列 24 個 svg，順序就是 3 隻 × 8 表情
// class="grid" 之後還會有 Astro 的 scoped-CSS 與 dev-only 來源屬性，別鎖死結尾的 >
const table = /<table[^>]*class="grid"[^>]*>([\s\S]*?)<\/table>/.exec(html)?.[1];
if (!table) {
  console.error('頁面裡找不到 table.grid，/bears 的結構是不是改了？');
  process.exit(1);
}

const svgs = [...table.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
if (svgs.length !== 24) {
  console.error(`預期 24 個 SVG，實際抓到 ${svgs.length} 個。`);
  process.exit(1);
}

const rows = 3;
const W = CELL * COLS;
const H = HEADER + CELL * rows;

/**
 * resvg 不解析 CSS 自訂屬性，var(--x) 一律會 fallback 成黑色。
 * 所以這裡把調色盤攤平、手動代換掉 —— 值必須跟 src/styles/global.css 的淺色模式一致。
 */
const PALETTE = {
  '--bear-duo-fur': '#c9915c',
  '--bear-duo-fur-dark': '#a97441',
  '--bear-duo-line': '#9c6a3a',
  '--bear-duo-belly': '#efd4ae',
  '--bear-duo-cloth': '#e2574c',
  '--bear-kong-fur': '#fbf6ef',
  '--bear-kong-fur-dark': '#e2d8cb',
  '--bear-kong-line': '#cdbfae',
  '--bear-kong-patch': '#46393a',
  '--bear-kong-cloth': '#9ec7e8',
  '--bear-jun-fur': '#e9f0f7',
  '--bear-jun-fur-dark': '#c6d4e2',
  '--bear-jun-line': '#a9bccd',
  '--bear-jun-belly': '#f9fcff',
  '--bear-jun-cloth': '#6f8ba3',
  '--c-brand': '#5ba8d4',
};

/** 把 markup 裡所有 var(--x) 換成實際色碼 */
function resolveVars(markup, extra) {
  const map = { ...PALETTE, ...extra };
  return markup.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name) => map[name] ?? whole);
}

// 把每個 svg 轉成 <g transform> 塞進大畫布：換掉外層 <svg> 標籤即可
const cells = svgs
  .map((svg, i) => {
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

    // 每隻熊的 --bear-eye / --bear-mouth / --bear-blush 掛在自己的 style 屬性上
    const style = /style="([^"]*)"/.exec(svg)?.[1] ?? '';
    const own = Object.fromEntries(
      style
        .split(';')
        .filter(Boolean)
        .map((pair) => pair.split(':').map((s) => s.trim())),
    );

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL + (CELL - 120) / 2;
    const y = HEADER + row * CELL + (CELL - 120) / 2;
    return `<g transform="translate(${x},${y})">${resolveVars(inner, own)}</g>`;
  })
  .join('');

const labels = MOODS.map(
  (m, i) =>
    `<text x="${i * CELL + CELL / 2}" y="22" text-anchor="middle" font-size="15" fill="#7a6a63">${m}</text>`,
).join('');

const guides = Array.from(
  { length: rows },
  (_, r) =>
    `<line x1="0" y1="${HEADER + r * CELL}" x2="${W}" y2="${HEADER + r * CELL}" stroke="#e4d6c6" stroke-width="1"/>`,
).join('');

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>text{font-family:sans-serif}</style>
<rect width="${W}" height="${H}" fill="#fff8f0"/>
${guides}${labels}${cells}</svg>`;

const png = new Resvg(sheet, { fitTo: { mode: 'width', value: W * 2 } }).render().asPng();
writeFileSync(OUT, png);
console.log(`→ ${OUT}  (${W * 2}×${H * 2})`);
