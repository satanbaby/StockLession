/**
 * DMI / ADX —— 趨向指標（Wilder 1978）。
 *
 *   +DM = 今日最高 − 昨日最高   （只在它為正、且大於 −DM 時才算數）
 *   −DM = 昨日最低 − 今日最低   （同理）
 *   +DI = 100 × 平滑(+DM) / 平滑(TR)
 *   −DI = 100 × 平滑(−DM) / 平滑(TR)
 *   DX  = 100 × |+DI − −DI| / (+DI + −DI)
 *   ADX = 平滑(DX)
 *
 * 這組指標的價值在於它把「方向」跟「強度」拆開：
 *   +DI 與 −DI 誰在上面 → 方向
 *   ADX 高不高          → 這個方向有多堅定（ADX 本身不分多空）
 *
 * ADX 低於 20 通常代表盤整，此時所有順勢指標的訊號都該打折 ——
 * 這是把它當「濾網」而非「進場訊號」的理由。
 */

import { round, type Bar, type Point } from './types';
import { trueRange } from './atr';

export interface DmiOptions {
  period?: number;
  /** ADX 的平滑期數，慣例與 period 相同 */
  adxPeriod?: number;
}

export interface DmiResult {
  plusDi: Point[];
  minusDi: Point[];
  adx: Point[];
}

/** Wilder 的累加式平滑：first = sum(前 n 期)，之後 next = prev − prev/n + 本期 */
function wilderAccumulate(
  values: readonly (number | null)[],
  period: number,
  startIndex: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const firstAt = startIndex + period - 1;
  if (firstAt >= values.length) return out;

  let acc = 0;
  for (let i = startIndex; i <= firstAt; i += 1) acc += values[i] ?? 0;
  out[firstAt] = acc;

  for (let i = firstAt + 1; i < values.length; i += 1) {
    acc = acc - acc / period + (values[i] ?? 0);
    out[i] = acc;
  }
  return out;
}

export function dmi(bars: readonly Bar[], options: DmiOptions = {}): DmiResult {
  const { period = 14, adxPeriod = period } = options;
  if (period < 1) throw new RangeError('period 必須 >= 1');

  const n = bars.length;
  const tr = trueRange(bars);
  const plusDm: (number | null)[] = new Array(n).fill(null);
  const minusDm: (number | null)[] = new Array(n).fill(null);

  for (let i = 1; i < n; i += 1) {
    const up = bars[i]!.high - bars[i - 1]!.high;
    const down = bars[i - 1]!.low - bars[i]!.low;
    // 只有「明顯往某一邊多走」才記分；兩邊都擴張時只算比較大的那邊
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
  }

  // TR / DM 都是從索引 1 開始有值
  const trSmooth = wilderAccumulate(tr, period, 1);
  const plusSmooth = wilderAccumulate(plusDm, period, 1);
  const minusSmooth = wilderAccumulate(minusDm, period, 1);

  const plusDi: (number | null)[] = new Array(n).fill(null);
  const minusDi: (number | null)[] = new Array(n).fill(null);
  const dx: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i += 1) {
    const t = trSmooth[i] ?? null;
    const p = plusSmooth[i] ?? null;
    const m = minusSmooth[i] ?? null;
    if (t === null || p === null || m === null || t === 0) continue;

    const pdi = (p / t) * 100;
    const mdi = (m / t) * 100;
    plusDi[i] = round(pdi, 2);
    minusDi[i] = round(mdi, 2);

    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : round((Math.abs(pdi - mdi) / sum) * 100, 2);
  }

  // ADX 是 DX 的 Wilder 平滑，種子取 DX 有值之後的前 adxPeriod 期簡單平均
  const adx: (number | null)[] = new Array(n).fill(null);
  const dxStart = dx.findIndex((v) => v !== null);
  if (dxStart !== -1 && dxStart + adxPeriod - 1 < n) {
    const firstAt = dxStart + adxPeriod - 1;
    let seed = 0;
    for (let i = dxStart; i <= firstAt; i += 1) seed += dx[i]!;
    let prev = seed / adxPeriod;
    adx[firstAt] = round(prev, 2);

    for (let i = firstAt + 1; i < n; i += 1) {
      prev = (prev * (adxPeriod - 1) + dx[i]!) / adxPeriod;
      adx[i] = round(prev, 2);
    }
  }

  const at = (arr: (number | null)[]): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: arr[i] ?? null }));

  return { plusDi: at(plusDi), minusDi: at(minusDi), adx: at(adx) };
}
