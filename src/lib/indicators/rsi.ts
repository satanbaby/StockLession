/**
 * RSI —— 相對強弱指標（Wilder 1978 原版）。
 *
 *   RS  = 平均漲幅 / 平均跌幅
 *   RSI = 100 − 100 / (1 + RS)  =  100 × 平均漲幅 / (平均漲幅 + 平均跌幅)
 *
 * 「平均」是 Wilder 平滑，不是一般的 EMA，也不是每次重算的 SMA：
 *
 *   第一個值  取前 N 期漲幅／跌幅的簡單平均（種子）
 *   之後      avg = (前一個 avg × (N−1) + 本期值) / N        ← α = 1/N
 *
 * 很多網路實作直接套 EMA(N)（α = 2/(N+1)），算出來的 RSI 會比正版敏感，
 * 在 70／30 附近的穿越時點跟看盤軟體對不起來。教學網站上這種偏差不能有。
 */

import { round, type Bar, type Point } from './types';

export interface RsiOptions {
  period?: number;
}

export function rsi(bars: readonly Bar[], options: RsiOptions = {}): Point[] {
  const { period = 14 } = options;
  if (period < 1) throw new RangeError('period 必須 >= 1');

  const n = bars.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n <= period) return bars.map((b, i) => ({ time: b.time, value: out[i] ?? null }));

  // 種子：前 period 根的漲跌幅簡單平均。i 從 1 開始因為要跟前一根比。
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = bars[i]!.close - bars[i - 1]!.close;
    if (diff > 0) gainSum += diff;
    else lossSum -= diff;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const toRsi = (g: number, l: number): number => {
    // 期間內完全沒下跌 → RSI 定義為 100；完全沒上漲 → 0；完全沒動 → 50
    const total = g + l;
    if (total === 0) return 50;
    return (g / total) * 100;
  };

  out[period] = round(toRsi(avgGain, avgLoss), 2);

  for (let i = period + 1; i < n; i += 1) {
    const diff = bars[i]!.close - bars[i - 1]!.close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    out[i] = round(toRsi(avgGain, avgLoss), 2);
  }

  return bars.map((b, i) => ({ time: b.time, value: out[i] ?? null }));
}
