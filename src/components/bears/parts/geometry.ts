/**
 * 三熊共用的座標系。
 *
 * 全部角色都畫在同一個 120×120 的 viewBox 裡，而且**臉部錨點固定**——
 * 這是整套素材能維護的關鍵：身體各畫一次，八種表情只畫一次，
 * 3 隻 × 8 表情 = 24 種組合不需要 24 張圖。
 *
 * 佈局（由上而下）：
 *   耳朵 cy=20 ── 頭 cy=52 ── 眉 y≈36 ── 眼 y=50 ── 鼻 y=63 ── 嘴 y≈74 ── 身體 y=82↓
 */

export const VIEWBOX = 120;

/** 頭 */
export const HEAD = { cx: 60, cy: 52, rx: 44, ry: 36 } as const;

/** 耳朵（左右對稱） */
export const EAR = { cx: 27, cy: 20, r: 14, innerR: 7 } as const;

/** 吻部：鼻子與嘴巴都落在這塊上面 */
export const MUZZLE = { cx: 60, cy: 70, rx: 25, ry: 16 } as const;

/** 眼睛錨點——所有表情都以這兩點為中心 */
export const EYE_L = { x: 44, y: 50 } as const;
export const EYE_R = { x: 76, y: 50 } as const;
export const EYE_R_DOT = 5.4;

/** 眉毛基準線 */
export const BROW_Y = 36;

/** 鼻子 */
export const NOSE = { cx: 60, cy: 62, rx: 7, ry: 5.2 } as const;

/** 嘴巴基準點（吻部中央偏下） */
export const MOUTH = { cx: 60, y: 73 } as const;

/** 身體／肩膀 */
export const BODY = { x: 14, y: 82, w: 92, h: 46, r: 26 } as const;

export type BearId = 'duo' | 'kong' | 'jun';

export type BearMood =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'worried'
  | 'thinking'
  | 'shocked'
  | 'proud'
  | 'sleepy';

export const BEAR_IDS: readonly BearId[] = ['duo', 'kong', 'jun'];

export const BEAR_MOODS: readonly BearMood[] = [
  'neutral',
  'happy',
  'excited',
  'worried',
  'thinking',
  'shocked',
  'proud',
  'sleepy',
];
