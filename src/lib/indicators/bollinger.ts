/**
 * 布林通道。
 *
 *   中軌 = SMA(n)
 *   上軌 = 中軌 + k × σ
 *   下軌 = 中軌 − k × σ
 *
 * σ 用「母體標準差」（除以 n），不是樣本標準差（除以 n−1）。
 * 這是 John Bollinger 原始定義，也是所有看盤軟體的做法 ——
 * 用 n−1 算出來的通道會略寬，跟券商軟體對不起來。
 */

import { round, type Bar, type Point, type PriceSource } from './types';

export interface BollingerOptions {
  period?: number;
  /** 幾個標準差，慣例 2 */
  multiplier?: number;
  source?: PriceSource;
}

export interface BollingerResult {
  upper: Point[];
  middle: Point[];
  lower: Point[];
  /** 帶寬 (上−下)/中 ×100。收縮到極窄常是變盤前兆，所以獨立成一條。 */
  bandwidth: Point[];
  /** %b：收盤價在通道中的相對位置，0=下軌 1=上軌，可以超出 0~1 */
  percentB: Point[];
}

export function bollinger(bars: readonly Bar[], options: BollingerOptions = {}): BollingerResult {
  const { period = 20, multiplier = 2, source = 'close' } = options;
  if (period < 2) throw new RangeError('period 必須 >= 2');

  const n = bars.length;
  const values = bars.map((b) => b[source]);

  const up: (number | null)[] = new Array(n).fill(null);
  const mid: (number | null)[] = new Array(n).fill(null);
  const low: (number | null)[] = new Array(n).fill(null);
  const bw: (number | null)[] = new Array(n).fill(null);
  const pb: (number | null)[] = new Array(n).fill(null);

  for (let i = period - 1; i < n; i += 1) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j += 1) sum += values[j]!;
    const mean = sum / period;

    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      const dev = values[j]! - mean;
      sqSum += dev * dev;
    }
    const sigma = Math.sqrt(sqSum / period);

    const u = mean + multiplier * sigma;
    const l = mean - multiplier * sigma;
    const width = u - l;

    mid[i] = round(mean, 2);
    up[i] = round(u, 2);
    low[i] = round(l, 2);
    bw[i] = mean === 0 ? null : round((width / mean) * 100, 2);
    // 通道完全收平（連續 n 根同價）時 %b 沒有定義，給 0.5 代表「在中間」
    pb[i] = width === 0 ? 0.5 : round((bars[i]!.close - l) / width, 4);
  }

  const at = (arr: (number | null)[]): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: arr[i] ?? null }));

  return {
    upper: at(up),
    middle: at(mid),
    lower: at(low),
    bandwidth: at(bw),
    percentB: at(pb),
  };
}
