/**
 * 移動平均線。
 *
 * 三種平均的差別只在「怎麼給權重」：
 *   SMA 每根一樣重
 *   WMA 越近越重，權重是等差級數 1,2,3,…,n
 *   EMA 越近越重，權重是等比級數，理論上把所有歷史都算進去
 */

import { round, type Bar, type Point, type PriceSource } from './types';

/**
 * 簡單移動平均。
 * 用滑動視窗遞推（進一個、出一個）而不是每根重算一次，
 * 這樣 1000 根資料配 10 條均線也不會卡。
 */
export function sma(values: readonly number[], period: number): (number | null)[] {
  if (period < 1) throw new RangeError('period 必須 >= 1');
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;

  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = round(sum / period);
  }
  return out;
}

/**
 * 指數移動平均。
 *
 * 種子值用「前 period 根的 SMA」，不是用第一根收盤價 ——
 * 後者是很常見的實作偷懶，會讓前面幾十根 EMA 明顯偏離，
 * 兩條不同週期的 EMA 相減（也就是 MACD）時誤差會更明顯。
 */
export function ema(values: readonly number[], period: number): (number | null)[] {
  if (period < 1) throw new RangeError('period 必須 >= 1');
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);

  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i]!;
  let prev = seed / period;
  out[period - 1] = round(prev);

  for (let i = period; i < values.length; i += 1) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = round(prev);
  }
  return out;
}

/** 加權移動平均：權重 1..period，最近的一根權重最大。 */
export function wma(values: readonly number[], period: number): (number | null)[] {
  if (period < 1) throw new RangeError('period 必須 >= 1');
  const out: (number | null)[] = new Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;

  for (let i = period - 1; i < values.length; i += 1) {
    let acc = 0;
    for (let j = 0; j < period; j += 1) {
      acc += values[i - period + 1 + j]! * (j + 1);
    }
    out[i] = round(acc / denom);
  }
  return out;
}

/**
 * Wilder 平滑。RSI、ATR、DMI 都用這個，跟 EMA 是同一族但係數不同：
 * Wilder 的 α = 1/N，EMA 的 α = 2/(N+1)。
 * 換句話說 Wilder(N) 的反應速度大約等於 EMA(2N−1)，別把兩者混用。
 */
export function wilderSmooth(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i]!;
  let prev = seed / period;
  out[period - 1] = round(prev);

  for (let i = period; i < values.length; i += 1) {
    prev = (prev * (period - 1) + values[i]!) / period;
    out[i] = round(prev);
  }
  return out;
}

export type MaKind = 'sma' | 'ema' | 'wma';

const KIND: Record<MaKind, (v: readonly number[], p: number) => (number | null)[]> = {
  sma,
  ema,
  wma,
};

export interface MaOptions {
  period?: number;
  kind?: MaKind;
  source?: PriceSource;
}

/** 給圖表用的包裝：吃 Bar[]，吐 Point[] */
export function movingAverage(bars: readonly Bar[], options: MaOptions = {}): Point[] {
  const { period = 20, kind = 'sma', source = 'close' } = options;
  const values = bars.map((b) => b[source]);
  const result = KIND[kind](values, period);
  return bars.map((b, i) => ({ time: b.time, value: result[i] ?? null }));
}

/**
 * 乖離率 (Bias)：收盤價偏離均線多少百分比。
 * 「漲多了沒」這個直覺問題，乖離率就是它的量化版本。
 */
export function bias(bars: readonly Bar[], options: MaOptions = {}): Point[] {
  const ma = movingAverage(bars, options);
  return bars.map((b, i) => {
    const m = ma[i]?.value;
    return {
      time: b.time,
      value: m === null || m === undefined || m === 0 ? null : round(((b.close - m) / m) * 100, 2),
    };
  });
}
