/**
 * KD 隨機指標（台股慣用 9,3,3）。
 *
 *   RSV = (今日收盤 − 近 n 日最低) / (近 n 日最高 − 近 n 日最低) × 100
 *   K   = ⅔ × 前一日 K + ⅓ × 今日 RSV
 *   D   = ⅔ × 前一日 D + ⅓ × 今日 K
 *
 * 三個容易錯的地方，這裡都刻意處理了：
 *
 * 1. K、D 的初值是 50，不是第一個 RSV。台股所有主流看盤軟體都用 50。
 * 2. ⅔ / ⅓ 這組係數其實就是 α = 1/3 的遞迴平滑，等價於「3 日」平滑。
 *    如果把 kSmooth 改成別的值，係數要跟著變成 (m−1)/m 與 1/m。
 * 3. 近 n 日最高 == 最低時（整整 n 天完全沒波動，跌停鎖死或停牌後常見），
 *    分母為 0。這時 RSV 沿用前一日，而不是給 0 或 50 ——
 *    給 0 會讓 K 值瞬間崩到超賣區，畫出一個根本不存在的訊號。
 */

import { round, type Bar, type Point } from './types';

export interface KdOptions {
  /** RSV 的回顧期間，台股慣例 9 */
  rsvPeriod?: number;
  /** K 的平滑期數，台股慣例 3 */
  kSmooth?: number;
  /** D 的平滑期數，台股慣例 3 */
  dSmooth?: number;
}

export interface KdResult {
  k: Point[];
  d: Point[];
  /** 未平滑的原始 RSV，教學上用來對照「平滑到底做了什麼」 */
  rsv: Point[];
}

export function kd(bars: readonly Bar[], options: KdOptions = {}): KdResult {
  const { rsvPeriod = 9, kSmooth = 3, dSmooth = 3 } = options;
  if (rsvPeriod < 1 || kSmooth < 1 || dSmooth < 1) throw new RangeError('週期必須 >= 1');

  const n = bars.length;
  const rsvArr: (number | null)[] = new Array(n).fill(null);
  const kArr: (number | null)[] = new Array(n).fill(null);
  const dArr: (number | null)[] = new Array(n).fill(null);

  const kAlpha = 1 / kSmooth;
  const dAlpha = 1 / dSmooth;

  let prevK = 50;
  let prevD = 50;
  let prevRsv = 50;

  for (let i = 0; i < n; i += 1) {
    if (i < rsvPeriod - 1) continue;

    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - rsvPeriod + 1; j <= i; j += 1) {
      const bar = bars[j]!;
      if (bar.high > hi) hi = bar.high;
      if (bar.low < lo) lo = bar.low;
    }

    const range = hi - lo;
    const rsv = range === 0 ? prevRsv : ((bars[i]!.close - lo) / range) * 100;
    prevRsv = rsv;

    prevK = prevK * (1 - kAlpha) + rsv * kAlpha;
    prevD = prevD * (1 - dAlpha) + prevK * dAlpha;

    rsvArr[i] = round(rsv, 2);
    kArr[i] = round(prevK, 2);
    dArr[i] = round(prevD, 2);
  }

  const at = (arr: (number | null)[]): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: arr[i] ?? null }));

  return { k: at(kArr), d: at(dArr), rsv: at(rsvArr) };
}
