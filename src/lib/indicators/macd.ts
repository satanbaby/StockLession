/**
 * MACD —— 指數平滑異同移動平均。
 *
 *   DIF  = EMA(12) − EMA(26)          快線減慢線，衡量「短期比長期強多少」
 *   DEA  = EMA(9) of DIF              DIF 自己的均線，也就是訊號線
 *   OSC  = DIF − DEA                  柱狀圖，衡量「DIF 正在加速還是減速」
 *
 * 名詞在台股很亂：DEA 常被叫做「MACD 線」，OSC 常被叫做「MACD 柱」。
 * 這裡一律用 dif / dea / hist 三個欄位，避免歧義。
 */

import { ema } from './ma';
import { round, smoothAfterWarmup, type Bar, type Point } from './types';

export interface MacdOptions {
  fast?: number;
  slow?: number;
  signal?: number;
  /**
   * 柱狀圖要不要乘 2。
   * 部分台股看盤軟體會放大兩倍讓柱子好讀，數值大小會因此不同，
   * 但正負號與轉折時點完全一樣 —— 判讀邏輯不受影響。
   */
  doubleHistogram?: boolean;
}

export interface MacdResult {
  dif: Point[];
  dea: Point[];
  hist: Point[];
}

export function macd(bars: readonly Bar[], options: MacdOptions = {}): MacdResult {
  const { fast = 12, slow = 26, signal = 9, doubleHistogram = false } = options;
  if (fast >= slow) throw new RangeError('fast 必須小於 slow，否則 DIF 的正負意義會顛倒');

  const closes = bars.map((b) => b.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  // 慢線還沒暖機完成之前 DIF 沒有意義，所以兩者都要有值才算
  const difRaw = closes.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f === null || f === undefined || s === null || s === undefined ? null : round(f - s);
  });

  const deaRaw = smoothAfterWarmup(difRaw, (v) => ema(v, signal));

  const histRaw = difRaw.map((d, i) => {
    const s = deaRaw[i];
    if (d === null || s === null || s === undefined) return null;
    return round((d - s) * (doubleHistogram ? 2 : 1));
  });

  const at = (arr: (number | null)[]): Point[] =>
    bars.map((b, i) => ({ time: b.time, value: arr[i] ?? null }));

  return { dif: at(difRaw), dea: at(deaRaw), hist: at(histRaw) };
}
