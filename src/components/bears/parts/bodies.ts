/**
 * 三隻熊的身體。臉部完全交給 faces.ts，這裡只負責「哪隻熊」。
 *
 * 疊圖順序（BearAvatar.astro 依此組合）：
 *   behind → head → eyeBase → FACES[mood] → overlay
 *
 * behind   身體、手臂、抱枕這些在頭後面的
 * head     頭、耳朵、吻部、鼻子
 * eyeBase  畫在表情「下面」的東西（小空的白眼圈）
 * overlay  蓋在表情「上面」的東西（阿均的眼鏡）
 *
 * 每個角色帶一組 CSS 變數，表情就會自動用對的顏色，深色模式也一併處理。
 */

import { BODY, EAR, EYE_L, EYE_R, HEAD, MUZZLE, NOSE, type BearId } from './geometry';

export interface BearSkin {
  id: BearId;
  /** 顯示用名字 */
  name: string;
  /** 一句話人設，用在 showcase 與課程封面 */
  role: string;
  /** 這隻熊在課程裡負責什麼 */
  duty: string;
  /** 代表色，用在章節標籤、進度條 */
  themeColor: string;
  /** 注入 <svg> 的 CSS 變數 */
  vars: Record<string, string>;
  behind(uid: string): string;
  head(uid: string): string;
  eyeBase(uid: string): string;
  overlay(uid: string): string;
}

/**
 * 描邊一律用「該角色毛色的深色版」而不是黑色。
 * 純黑描邊會把扁平柔和的味道打死；同色系的深一階則是在暖米白底上
 * 撐出輪廓 —— 阿均那種近白色的熊沒有這層描邊會直接消失在背景裡。
 */
const outline = (line?: string) =>
  line ? ` stroke="${line}" stroke-width="2" stroke-linejoin="round"` : '';

const headEllipse = (fill?: string, line?: string) =>
  `<ellipse cx="${HEAD.cx}" cy="${HEAD.cy}" rx="${HEAD.rx}" ry="${HEAD.ry}"` +
  (fill ? ` fill="${fill}"` : '') +
  outline(line) +
  `/>`;

const muzzle = (fill: string, line?: string) =>
  `<ellipse cx="${MUZZLE.cx}" cy="${MUZZLE.cy}" rx="${MUZZLE.rx}" ry="${MUZZLE.ry}" fill="${fill}"${outline(line)}/>`;

const nose = (fill: string) =>
  `<ellipse cx="${NOSE.cx}" cy="${NOSE.cy}" rx="${NOSE.rx}" ry="${NOSE.ry}" fill="${fill}"/>`;

/** 兩隻耳朵（左右鏡射） */
const ears = (outer: string, inner: string, line?: string) => {
  const one = (cx: number) =>
    `<circle cx="${cx}" cy="${EAR.cy}" r="${EAR.r}" fill="${outer}"${outline(line)}/>` +
    `<circle cx="${cx}" cy="${EAR.cy + 1}" r="${EAR.innerR}" fill="${inner}"/>`;
  return one(EAR.cx) + one(120 - EAR.cx);
};

const bodyShape = (fill: string, line?: string) =>
  `<rect x="${BODY.x}" y="${BODY.y}" width="${BODY.w}" height="${BODY.h}" rx="${BODY.r}" fill="${fill}"${outline(line)}/>`;

/** 肚子上的淺色塊 */
const belly = (fill: string) =>
  `<ellipse cx="60" cy="118" rx="29" ry="22" fill="${fill}"/>`;

// ---------------------------------------------------------------------------
// 阿多 —— 棕熊。熱血進攻手，紅頭巾。
// ---------------------------------------------------------------------------
const duo: BearSkin = {
  id: 'duo',
  name: '阿多',
  role: '熱血進攻手',
  duty: '訊號出現了、型態成形了、這裡可以進場',
  themeColor: 'var(--bear-duo-cloth)',
  vars: {
    '--bear-eye': '#3d3230',
    '--bear-mouth': '#3d3230',
    '--bear-blush': '#e8897b',
  },
  behind: () =>
    bodyShape('var(--bear-duo-fur)', 'var(--bear-duo-line)') +
    belly('var(--bear-duo-belly)') +
    // 舉起來的手，配合他那個「衝啊」的個性
    `<circle cx="16" cy="92" r="12" fill="var(--bear-duo-fur-dark)"/>` +
    `<circle cx="104" cy="92" r="12" fill="var(--bear-duo-fur-dark)"/>`,
  head: (uid) =>
    ears('var(--bear-duo-fur)', 'var(--bear-duo-fur-dark)', 'var(--bear-duo-line)') +
    headEllipse('var(--bear-duo-fur)', 'var(--bear-duo-line)') +
    // 頭巾：用 clipPath 裁在頭形裡，才不會超出輪廓
    `<clipPath id="duo-head-${uid}">${headEllipse()}</clipPath>` +
    `<g clip-path="url(#duo-head-${uid})">` +
    `<rect x="8" y="26" width="104" height="13" fill="var(--bear-duo-cloth)" transform="rotate(-6 60 32)"/>` +
    `</g>` +
    // 頭巾在右側打結後飄出來的兩條帶子。刻意放在耳朵下方、貼著頭的邊緣，
    // 擺太高會跟耳朵疊在一起，看起來像頭上插了根刺。
    `<path d="M96 37 L116 31 L111 43 Z" fill="var(--bear-duo-cloth)"/>` +
    `<path d="M97 42 L114 50 L109 37 Z" fill="var(--bear-duo-fur-dark)" opacity="0.25"/>` +
    `<path d="M97 42 L114 50 L109 38 Z" fill="var(--bear-duo-cloth)"/>` +
    muzzle('var(--bear-duo-belly)') +
    nose('#3d3230'),
  eyeBase: () => '',
  overlay: () => '',
};

// ---------------------------------------------------------------------------
// 小空 —— 貓熊。擔心鬼，永遠抱著抱枕。
// ---------------------------------------------------------------------------
const kong: BearSkin = {
  id: 'kong',
  name: '小空',
  role: '謹慎擔心鬼',
  duty: '訊號什麼時候會騙人、停損放哪、風險在哪',
  themeColor: 'var(--bear-kong-cloth)',
  vars: {
    '--bear-eye': '#2e2526',
    '--bear-mouth': '#46393a',
    '--bear-blush': '#f0a7a0',
  },
  behind: () =>
    bodyShape('var(--bear-kong-fur)', 'var(--bear-kong-line)') +
    // 貓熊的黑肩膀與手臂
    `<path d="M14 108 v-12 a26 26 0 0 1 26 -14 v26 z" fill="var(--bear-kong-patch)"/>` +
    `<path d="M106 108 v-12 a26 26 0 0 0 -26 -14 v26 z" fill="var(--bear-kong-patch)"/>` +
    // 抱枕：他從不放手
    `<rect x="33" y="96" width="54" height="34" rx="12" fill="var(--bear-kong-cloth)" transform="rotate(-5 60 112)"/>` +
    `<rect x="41" y="103" width="38" height="20" rx="8" fill="none" stroke="#fff" stroke-width="2" opacity="0.45" transform="rotate(-5 60 112)"/>` +
    // 抓著抱枕的兩隻手
    `<circle cx="30" cy="104" r="11" fill="var(--bear-kong-patch)"/>` +
    `<circle cx="90" cy="104" r="11" fill="var(--bear-kong-patch)"/>`,
  head: () =>
    ears('var(--bear-kong-patch)', '#5d4c4d') +
    headEllipse('var(--bear-kong-fur)', 'var(--bear-kong-line)') +
    muzzle('var(--bear-kong-fur)', 'var(--bear-kong-line)') +
    nose('#2e2526'),
  // 黑眼圈 + 裡面的白底。表情畫在白底上，八種都讀得出來。
  //
  // 尺寸與位置是被眉毛逼出來的：眉毛在 y≈31~39 之間，黑眼圈上緣必須壓在 39 以下，
  // 否則深色的眉毛會畫在深色的眼圈上直接消失。旋轉後的垂直半徑約 12.8，
  // 所以 cy=52 讓上緣落在 39.2 —— 剛好讓開。
  eyeBase: () => {
    const patch = (x: number, y: number, rot: number) =>
      `<ellipse cx="${x}" cy="${y}" rx="15" ry="12.5" fill="var(--bear-kong-patch)" transform="rotate(${rot} ${x} ${y})"/>` +
      `<circle cx="${x}" cy="${y - 1}" r="9.2" fill="var(--bear-kong-fur)"/>`;
    return patch(EYE_L.x - 1, EYE_L.y + 2, -18) + patch(EYE_R.x + 1, EYE_R.y + 2, 18);
  },
  overlay: () => '',
};

// ---------------------------------------------------------------------------
// 阿均 —— 白熊。冷面學霸，細框眼鏡。
// ---------------------------------------------------------------------------
const jun: BearSkin = {
  id: 'jun',
  name: '阿均',
  role: '冷面學霸',
  duty: '公式怎麼來的、數字實際上在算什麼',
  themeColor: 'var(--bear-jun-cloth)',
  vars: {
    '--bear-eye': '#3a4753',
    '--bear-mouth': '#3a4753',
    '--bear-blush': '#a8c4d8',
  },
  behind: () =>
    bodyShape('var(--bear-jun-fur)', 'var(--bear-jun-line)') +
    belly('var(--bear-jun-belly)') +
    // 圍巾，只有他有 —— 冷面配冷色
    `<path d="M14 92 q46 16 92 0 v13 q-46 15 -92 0 z" fill="var(--bear-jun-cloth)"/>` +
    `<path d="M84 100 l14 26 -13 3 -6 -25 z" fill="var(--bear-jun-cloth)" opacity="0.85"/>`,
  head: () =>
    ears('var(--bear-jun-fur)', 'var(--bear-jun-fur-dark)', 'var(--bear-jun-line)') +
    headEllipse('var(--bear-jun-fur)', 'var(--bear-jun-line)') +
    muzzle('var(--bear-jun-belly)', 'var(--bear-jun-line)') +
    nose('#3a4753'),
  eyeBase: () => '',
  // 眼鏡蓋在表情上面，所以八種表情都是「透過鏡片」看到的
  overlay: () => {
    const lens = (x: number) =>
      `<rect x="${x - 12}" y="${EYE_L.y - 11}" width="24" height="22" rx="9" ` +
      `fill="#ffffff" fill-opacity="0.16" stroke="#3a4753" stroke-width="2.4"/>`;
    return (
      lens(EYE_L.x) +
      lens(EYE_R.x) +
      `<path d="M${EYE_L.x + 12} ${EYE_L.y - 2} h${EYE_R.x - EYE_L.x - 24}" stroke="#3a4753" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M${EYE_L.x - 12} ${EYE_L.y - 5} l-11 -4 M${EYE_R.x + 12} ${EYE_R.y - 5} l11 -4" stroke="#3a4753" stroke-width="2.4" stroke-linecap="round"/>`
    );
  },
};

export const BEARS: Record<BearId, BearSkin> = { duo, kong, jun };
