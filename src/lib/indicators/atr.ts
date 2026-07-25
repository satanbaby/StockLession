/**
 * ATR —— 平均真實區間（Wilder 1978）。
 *
 * 真實區間 TR 取三者最大：
 *   今日最高 − 今日最低
 *   |今日最高 − 昨日收盤|
 *   |今日最低 − 昨日收盤|
 *
 * 後兩項是為了把「跳空」算進波動裡。只看高低差的話，
 * 一根跳空開高後窄幅整理的 K 棒會被當成「今天很平靜」，
 * 但持有部位的人明明就承受了一整段跳空風險。
 *
 * ATR 是波動的絕對值（單位跟股價一樣），不是方向指標 ——
 * 它只回答「這檔股票平常一天走多少」，不回答走哪邊。
 * 主要用途是設停損距離與部位大小。
 */

import { round, type Bar, type Point } from './types';

export interface AtrOptions {
  period?: number;
}

/** 逐根的真實區間。第一根沒有昨收，只能用高低差。 */
export function trueRange(bars: readonly Bar[]): (number | null)[] {
  return bars.map((bar, i) => {
    if (i === 0) return null;
    const prevClose = bars[i - 1]!.close;
    return round(
      Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose)),
      4,
    );
  });
}

export function atr(bars: readonly Bar[], options: AtrOptions = {}): Point[] {
  const { period = 14 } = options;
  if (period < 1) throw new RangeError('period 必須 >= 1');

  const n = bars.length;
  const tr = trueRange(bars);
  const out: (number | null)[] = new Array(n).fill(null);

  // TR 從索引 1 才有值，所以種子取 TR[1..period]，第一個 ATR 落在索引 period
  if (n <= period) return bars.map((b, i) => ({ time: b.time, value: out[i] ?? null }));

  let seed = 0;
  for (let i = 1; i <= period; i += 1) seed += tr[i]!;
  let prev = seed / period;
  out[period] = round(prev, 4);

  for (let i = period + 1; i < n; i += 1) {
    prev = (prev * (period - 1) + tr[i]!) / period;
    out[i] = round(prev, 4);
  }

  return bars.map((b, i) => ({ time: b.time, value: out[i] ?? null }));
}

/** ATR 佔股價的百分比。跨個股比較波動時要用這個，絕對值不能比。 */
export function atrPercent(bars: readonly Bar[], options: AtrOptions = {}): Point[] {
  const a = atr(bars, options);
  return bars.map((b, i) => {
    const v = a[i]?.value;
    return {
      time: b.time,
      value: v === null || v === undefined || b.close === 0 ? null : round((v / b.close) * 100, 2),
    };
  });
}
