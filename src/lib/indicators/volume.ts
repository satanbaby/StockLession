/**
 * 量能指標。
 *
 * 台股特別吃量 —— 一檔股票的成交量往往比它的價格更早透露主力動向，
 * 所以量能指標在這套教材裡不是配角。
 */

import { round, typicalPrice, type Bar, type Point } from './types';
import { sma } from './ma';

/**
 * OBV —— 能量潮。
 *
 *   收盤上漲 → 整根量加進去
 *   收盤下跌 → 整根量減掉
 *   收平     → 不動
 *
 * 它的絕對數字沒有意義（起點是任意的 0），有意義的只有「走勢方向」，
 * 以及它跟股價之間的背離。所以圖上永遠不該標 OBV 的刻度值。
 */
export function obv(bars: readonly Bar[]): Point[] {
  let acc = 0;
  return bars.map((bar, i) => {
    if (i === 0) return { time: bar.time, value: 0 };
    const prev = bars[i - 1]!.close;
    if (bar.close > prev) acc += bar.volume;
    else if (bar.close < prev) acc -= bar.volume;
    return { time: bar.time, value: acc };
  });
}

export interface VolumeMaOptions {
  period?: number;
}

/** 均量線。「爆量」「窒息量」的判斷基準。 */
export function volumeMa(bars: readonly Bar[], options: VolumeMaOptions = {}): Point[] {
  const { period = 5 } = options;
  const result = sma(
    bars.map((b) => b.volume),
    period,
  );
  return bars.map((b, i) => ({ time: b.time, value: result[i] ?? null }));
}

/**
 * 量比：今日量 ÷ 近 n 日均量。
 * 1.0 是「跟平常一樣」，3.0 就是爆量。
 * 比看絕對張數直觀得多 —— 台積電的 3 萬張跟小型股的 3 萬張是完全不同的事。
 */
export function volumeRatio(bars: readonly Bar[], options: VolumeMaOptions = {}): Point[] {
  const { period = 5 } = options;
  const ma = volumeMa(bars, { period });
  return bars.map((b, i) => {
    const m = ma[i]?.value;
    return {
      time: b.time,
      value: m === null || m === undefined || m === 0 ? null : round(b.volume / m, 2),
    };
  });
}

/**
 * VWAP —— 成交量加權平均價（自序列起點起算的累積版本）。
 *
 * 注意：真正的 VWAP 是「當日盤中」指標，每天開盤歸零。
 * 日線圖上的累積 VWAP 是另一回事 —— 它代表「這段期間所有人的平均成本」，
 * 拿來看長期套牢區還行，但不要跟當沖用的 VWAP 混為一談。
 * 指數沒有成交量，餵進來只會得到一整排 null。
 */
export function vwap(bars: readonly Bar[]): Point[] {
  let pv = 0;
  let vol = 0;
  return bars.map((bar) => {
    pv += typicalPrice(bar) * bar.volume;
    vol += bar.volume;
    return { time: bar.time, value: vol === 0 ? null : round(pv / vol, 2) };
  });
}
