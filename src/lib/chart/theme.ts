/**
 * 圖表配色。
 *
 * 這裡刻意不從 CSS 變數讀色 —— lightweight-charts 需要的是實際色碼字串，
 * 而 getComputedStyle 在圖表初始化時機上不可靠（字型／樣式可能還沒套用完）。
 * 主題切換時由 createPriceChart 監聽並整批 applyOptions，反應一樣即時。
 *
 * 兩個原則：
 * 1. 紅漲綠跌是台股慣例，預設就是它。想切歐美配色（綠漲紅跌）走 direction 參數。
 * 2. 指標線的顏色一律避開紅綠系。紅綠在這張圖上必須專屬於漲跌，
 *    多一條紅色的均線就會讓學員的顏色直覺失效。
 */

export type ThemeName = 'light' | 'dark';
export type ColorDirection = 'tw' | 'us';

/** 指標線的分類色，跟漲跌色刻意拉開色相距離 */
export interface ChartPalette {
  background: string;
  text: string;
  textFaint: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  upWash: string;
  downWash: string;
  /** 指標線 1~5，依序取用 */
  series: [string, string, string, string, string];
  /** 零軸、超買超賣這類參考線 */
  guide: string;
  guideStrong: string;
}

const LIGHT: ChartPalette = {
  background: '#ffffff',
  text: '#5b4d47',
  textFaint: '#a89890',
  grid: '#f0e6da',
  border: '#dccbba',
  crosshair: '#9c8a80',
  up: '#e64545',
  down: '#26a06a',
  upWash: 'rgba(230, 69, 69, 0.45)',
  downWash: 'rgba(38, 160, 106, 0.45)',
  series: ['#3e7fb5', '#e0913c', '#8b6fb8', '#2e9e9e', '#c4608e'],
  guide: '#d8c7b5',
  guideStrong: '#a08d80',
};

const DARK: ChartPalette = {
  background: '#2b2420',
  text: '#c3b3a6',
  textFaint: '#8d7f74',
  grid: '#3d332c',
  border: '#4e423a',
  crosshair: '#a4948a',
  up: '#ff6b6b',
  down: '#3fca8e',
  upWash: 'rgba(255, 107, 107, 0.45)',
  downWash: 'rgba(63, 202, 142, 0.45)',
  series: ['#6fb3e0', '#f0ad60', '#b193dd', '#4cc4c4', '#e58cb6'],
  guide: '#4e423a',
  guideStrong: '#7d6d62',
};

export function palette(theme: ThemeName): ChartPalette {
  return theme === 'dark' ? DARK : LIGHT;
}

/**
 * 依配色慣例取漲跌色。
 * tw = 紅漲綠跌（台股、陸股、日股）
 * us = 綠漲紅跌（歐美）
 */
export function directional(
  p: ChartPalette,
  direction: ColorDirection = 'tw',
): { up: string; down: string; upWash: string; downWash: string } {
  return direction === 'tw'
    ? { up: p.up, down: p.down, upWash: p.upWash, downWash: p.downWash }
    : { up: p.down, down: p.up, upWash: p.downWash, downWash: p.upWash };
}

/** 讀出目前生效的主題（跟 BaseLayout 的 data-theme + 系統偏好一致） */
export function currentTheme(): ThemeName {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 主題變動時回呼。同時涵蓋兩種來源：
 * 使用者按切換鈕（data-theme 屬性變動）與系統偏好改變（媒體查詢）。
 */
export function onThemeChange(fn: (theme: ThemeName) => void): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const emit = () => fn(currentTheme());

  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  mql.addEventListener('change', emit);

  return () => {
    observer.disconnect();
    mql.removeEventListener('change', emit);
  };
}
