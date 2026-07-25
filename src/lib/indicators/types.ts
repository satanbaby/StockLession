/** 一根 K 棒。time 一律用 'YYYY-MM-DD'，跟 lightweight-charts 的 BusinessDay 字串格式相容。 */
export interface Bar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 成交量。個股是「張」，指數為 0。 */
  volume: number;
}

/**
 * 指標的單一輸出點。
 *
 * value 為 null 代表「暖機期，這裡還算不出值」。
 *
 * 這件事很重要，不是潔癖：MA20 在第 20 根之前根本沒有 20 筆資料可以平均，
 * 硬要給 0 或給首根收盤價，畫在圖上就會多出一段完全虛構的線。
 * 教學網站上畫錯線等於教錯，所以整套函式庫一律回 null，繪圖層負責跳過。
 */
export interface Point {
  time: string;
  value: number | null;
}

/** 從 K 棒陣列取出某個價格欄位 */
export type PriceSource = 'open' | 'high' | 'low' | 'close';

/** 建立一個暖機期的空點 */
export const blank = (time: string): Point => ({ time, value: null });

/** 把數值陣列（含 null）配上時間軸 */
export function toPoints(bars: readonly Bar[], values: readonly (number | null)[]): Point[] {
  return bars.map((b, i) => ({ time: b.time, value: values[i] ?? null }));
}

/** 取價格序列 */
export function pick(bars: readonly Bar[], source: PriceSource = 'close'): number[] {
  return bars.map((b) => b[source]);
}

/**
 * 典型價 (High + Low + Close) / 3。
 * CCI、VWAP 這類指標用它代表「這根 K 棒的代表價位」，比單看收盤更穩。
 */
export function typicalPrice(bar: Bar): number {
  return (bar.high + bar.low + bar.close) / 3;
}

/** 四捨五入到指定小數位，避免浮點誤差在畫面上跑出 12 位小數 */
export function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * 對「前面有一段 null 暖機期」的序列再套一層平滑。
 *
 * MACD 的訊號線就是這種情況：DIF 本身前 25 根是 null，
 * 訊號線必須從 DIF 真正有值的地方才開始算 9 期 EMA，
 * 把 null 當成 0 餵進去會讓訊號線前段整個歪掉。
 *
 * 假設 null 只出現在開頭（本函式庫的指標都符合這個前提）。
 */
export function smoothAfterWarmup(
  values: readonly (number | null)[],
  fn: (v: readonly number[]) => (number | null)[],
): (number | null)[] {
  const start = values.findIndex((v) => v !== null);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (start === -1) return out;

  const tail = values.slice(start) as number[];
  const smoothed = fn(tail);
  for (let i = 0; i < smoothed.length; i += 1) out[start + i] = smoothed[i] ?? null;
  return out;
}
