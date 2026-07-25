import type { Bar, Point } from '../types';

/** 從 [high, low, close] 三元組造 K 棒。日期是假的，指標計算不看日期。 */
export function makeBars(rows: readonly (readonly [number, number, number])[], volume = 1000): Bar[] {
  return rows.map(([high, low, close], i) => ({
    time: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: close,
    high,
    low,
    close,
    volume,
  }));
}

/** 只有收盤價的 K 棒（高低都等於收盤），測 MA 這類只吃單一價格的指標用 */
export function closesToBars(closes: readonly number[], volumes?: readonly number[]): Bar[] {
  return closes.map((c, i) => ({
    time: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: volumes?.[i] ?? 1000,
  }));
}

export const values = (points: readonly Point[]): (number | null)[] => points.map((p) => p.value);

/** 第一個非 null 的索引，−1 代表整條都是 null */
export const firstDefined = (arr: readonly (number | null)[]): number =>
  arr.findIndex((v) => v !== null);

/**
 * 檢查 null 只出現在開頭。
 * 中間冒出 null 代表計算過程漏了某根，繪圖時會斷線。
 */
export function hasNoInteriorNulls(arr: readonly (number | null)[]): boolean {
  const start = firstDefined(arr);
  if (start === -1) return true;
  return arr.slice(start).every((v) => v !== null);
}
