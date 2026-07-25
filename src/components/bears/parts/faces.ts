/**
 * 八種表情。跟角色完全解耦 —— 只吃 geometry.ts 的錨點，所以三隻熊共用一套。
 *
 * 顏色一律走 CSS 變數（--bear-eye / --bear-mouth / --bear-blush），
 * 由各角色在 <svg> 上設定，深色模式也就自動跟著走。
 */

import { BROW_Y, EYE_L, EYE_R, EYE_R_DOT, MOUTH, type BearMood } from './geometry';

const ink = 'var(--bear-eye)';
const mouthColor = 'var(--bear-mouth)';
const blush = 'var(--bear-blush)';

/** 圓點眼，可放大（驚訝）或縮小（瞇眼） */
function dotEyes(r = EYE_R_DOT, withHighlight = false): string {
  const eye = (x: number, y: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>` +
    (withHighlight
      ? `<circle cx="${x + r * 0.34}" cy="${y - r * 0.36}" r="${r * 0.3}" fill="#fff" opacity="0.9"/>`
      : '');
  return eye(EYE_L.x, EYE_L.y) + eye(EYE_R.x, EYE_R.y);
}

/** 閉眼弧線。up=true 是笑瞇瞇的 ∩，false 是睏倦的 ∪ */
function arcEyes(up: boolean, w = 11, h = 5): string {
  const arc = (x: number, y: number) =>
    `<path d="M${x - w / 2} ${y + (up ? h / 2 : -h / 2)} q${w / 2} ${up ? -h * 1.6 : h * 1.6} ${w} 0" ` +
    `fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
  return arc(EYE_L.x, EYE_L.y) + arc(EYE_R.x, EYE_R.y);
}

/**
 * 眉毛。tilt 是「內側端點相對外側端點的高低」：
 * 負值＝內側翹起來（擔心／可憐），正值＝內側壓下去（生氣／專注）。
 */
function brows(tilt: number, lift = 0): string {
  const y = BROW_Y - lift;
  const half = 7;
  const left = `<path d="M${EYE_L.x - half} ${y} L${EYE_L.x + half} ${y + tilt}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  const right = `<path d="M${EYE_R.x + half} ${y} L${EYE_R.x - half} ${y + tilt}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  return left + right;
}

/** 微笑弧線 */
function smile(width: number, depth: number, y = MOUTH.y): string {
  return (
    `<path d="M${MOUTH.cx - width / 2} ${y} q${width / 2} ${depth} ${width} 0" ` +
    `fill="none" stroke="${mouthColor}" stroke-width="3" stroke-linecap="round"/>`
  );
}

/** 張開的嘴（實心橢圓）—— 用在「震驚」的那種 O 型嘴 */
function openMouth(rx: number, ry: number, y = MOUTH.y + 3): string {
  return `<ellipse cx="${MOUTH.cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${mouthColor}"/>`;
}

/**
 * 咧嘴笑（上緣平、下緣半圓的 D 字形）。
 * 跟 openMouth 的圓嘴刻意做出區別 —— 不然「興奮」跟「震驚」看起來會是同一張臉。
 */
function grin(w: number, h: number, y = MOUTH.y - 1): string {
  const x = MOUTH.cx - w / 2;
  return (
    `<path d="M${x} ${y} h${w} a${w / 2} ${h} 0 0 1 ${-w} 0 z" fill="${mouthColor}"/>` +
    `<path d="M${x + w * 0.22} ${y + h * 0.72} a${w * 0.28} ${h * 0.3} 0 0 0 ${w * 0.56} 0 z" fill="#e8837f"/>`
  );
}

/** 腮紅 */
function cheeks(opacity = 0.75): string {
  return (
    `<ellipse cx="26" cy="64" rx="8" ry="5" fill="${blush}" opacity="${opacity}"/>` +
    `<ellipse cx="94" cy="64" rx="8" ry="5" fill="${blush}" opacity="${opacity}"/>`
  );
}

export const FACES: Record<BearMood, string> = {
  /** 預設。平靜、微微上揚 */
  neutral: dotEyes() + smile(13, 4),

  /** 開心。笑瞇眼 + 腮紅 */
  happy: cheeks(0.6) + arcEyes(true) + smile(18, 8),

  /** 興奮。瞪大眼、咧嘴笑、旁邊加放射線 */
  excited:
    cheeks(0.8) +
    brows(-1.5, 3) +
    dotEyes(7, true) +
    grin(20, 11) +
    `<path d="M14 30 l-6 -5 M16 40 l-7 0 M106 30 l6 -5 M104 40 l7 0" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" opacity="0.65"/>`,

  /** 擔心。眉毛內側翹起 + 波浪嘴 —— 小空的預設狀態 */
  worried:
    brows(-5) +
    dotEyes(5) +
    `<path d="M51 ${MOUTH.y + 2} q4.5 -4.5 9 0 q4.5 4.5 9 0" fill="none" stroke="${mouthColor}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M100 44 q4 5 0 10 M105 42 q5 7 0 14" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" opacity="0.4"/>`,

  /** 思考。眼往上飄、單邊挑眉、嘴偏一邊 */
  thinking:
    brows(3, 4) +
    `<circle cx="${EYE_L.x + 2}" cy="${EYE_L.y - 2}" r="5" fill="${ink}"/>` +
    `<circle cx="${EYE_R.x + 2}" cy="${EYE_R.y - 2}" r="5" fill="${ink}"/>` +
    `<path d="M56 ${MOUTH.y + 1} q6 4 11 -1" fill="none" stroke="${mouthColor}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="103" cy="26" r="3.4" fill="${ink}" opacity="0.35"/>` +
    `<circle cx="111" cy="18" r="2.1" fill="${ink}" opacity="0.25"/>`,

  /** 震驚。眼睛超大、嘴巴張成 O、頭頂噴汗 */
  shocked:
    brows(-2, 6) +
    dotEyes(8, true) +
    openMouth(6.5, 8.5, MOUTH.y + 4) +
    `<path d="M96 22 q5 7 0 11 q-5 -4 0 -11z" fill="var(--c-brand)" opacity="0.75"/>`,

  /** 得意。閉眼笑 + 大腮紅 —— 「我就說吧」 */
  proud:
    cheeks(0.85) +
    arcEyes(true, 12, 6) +
    smile(20, 9) +
    `<path d="M60 ${MOUTH.y + 9} q5 3 9 -1" fill="none" stroke="${mouthColor}" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>`,

  /** 想睡。閉眼向下 + 小嘴 + Z */
  sleepy:
    arcEyes(false, 11, 4) +
    `<ellipse cx="${MOUTH.cx}" cy="${MOUTH.y + 3}" rx="3.6" ry="4.4" fill="${mouthColor}"/>` +
    `<text x="99" y="26" font-size="19" font-weight="700" fill="${ink}" opacity="0.6" font-family="inherit">z</text>` +
    `<text x="110" y="13" font-size="12" font-weight="700" fill="${ink}" opacity="0.4" font-family="inherit">z</text>`,
};
