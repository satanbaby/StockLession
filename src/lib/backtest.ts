/**
 * 一個刻意簡陋的均線交叉回測。
 *
 * 它存在的目的不是「找出好參數」，而是要在課堂上示範**過度最佳化長什麼樣子**：
 * 把參數掃過一整片網格，你會看到報酬率的地形圖上有針尖也有高原，
 * 而回測冠軍幾乎總是站在針尖上 —— 換一段期間就掉下來。
 *
 * 因此這裡刻意不做任何讓數字變好看的事：
 *
 * - **訊號當天不成交**。黃金交叉是用收盤價算出來的，那個當下你已經買不到收盤價了。
 *   一律用「下一根的開盤價」成交。少了這一條，回測報酬會憑空多出一大截。
 * - **算交易成本**。台股來回是買賣手續費各 0.1425% 加賣出證交稅 0.3%，
 *   共 0.585%（多數券商手續費有折讓，實際略低）。交易越頻繁，這一項吃掉越多。
 * - **只做多、全額進出**。沒有槓桿、沒有加碼、沒有停損。
 *
 * 這些限制讓它不能拿來當交易系統，但正好讓它適合當教材：
 * 它排除了所有「靠技巧美化績效」的空間，剩下的就是參數本身的效果。
 */

import type { Bar } from './indicators/types';
import { movingAverage, type MaKind } from './indicators/ma';

export interface BacktestOptions {
  fast: number;
  slow: number;
  kind?: MaKind;
  /** 來回總成本（%），預設 0.585 = 台股未打折的手續費加證交稅 */
  cost?: number;
}

export interface Trade {
  entryTime: string;
  exitTime: string;
  entry: number;
  exit: number;
  /** 已扣成本的報酬率（%） */
  returnPct: number;
  bars: number;
}

export interface BacktestResult {
  trades: Trade[];
  tradeCount: number;
  /** 勝率 0~1；沒有交易時為 0 */
  winRate: number;
  /** 策略累積報酬（%） */
  totalReturn: number;
  /** 同期間買進持有的報酬（%），對照組 */
  buyHold: number;
  /** 權益曲線的最大回落（%，正數） */
  maxDrawdown: number;
  /** 平均每筆持有幾根 K 棒 */
  avgHoldBars: number;
  /** 在市場裡的時間佔比 0~1 */
  exposure: number;
}

const EMPTY: Omit<BacktestResult, 'buyHold'> = {
  trades: [],
  tradeCount: 0,
  winRate: 0,
  totalReturn: 0,
  maxDrawdown: 0,
  avgHoldBars: 0,
  exposure: 0,
};

export function maCrossBacktest(
  bars: readonly Bar[],
  { fast, slow, kind = 'sma', cost = 0.585 }: BacktestOptions,
): BacktestResult {
  const first = bars[0];
  const last = bars[bars.length - 1];
  const buyHold = first && last ? (last.close / first.close - 1) * 100 : 0;

  if (fast >= slow || bars.length < slow + 2) return { ...EMPTY, buyHold };

  const f = movingAverage(bars, { period: fast, kind });
  const s = movingAverage(bars, { period: slow, kind });

  const trades: Trade[] = [];
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let heldBars = 0;

  /** null = 空手 */
  let position: { entry: number; time: string; index: number } | null = null;

  const markEquity = (value: number): void => {
    peak = Math.max(peak, value);
    maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
  };

  for (let i = 1; i < bars.length - 1; i += 1) {
    const fNow = f[i]?.value;
    const fPrev = f[i - 1]?.value;
    const sNow = s[i]?.value;
    const sPrev = s[i - 1]?.value;
    if (fNow == null || fPrev == null || sNow == null || sPrev == null) continue;

    const crossUp = fPrev <= sPrev && fNow > sNow;
    const crossDown = fPrev >= sPrev && fNow < sNow;

    // 訊號在第 i 根收盤成立，成交價只能是第 i+1 根的開盤
    const fill = bars[i + 1]!;

    if (!position && crossUp) {
      position = { entry: fill.open, time: fill.time, index: i + 1 };
    } else if (position && crossDown) {
      const gross = fill.open / position.entry;
      const net = gross * (1 - cost / 100);
      equity *= net;
      markEquity(equity);
      heldBars += i + 1 - position.index;
      trades.push({
        entryTime: position.time,
        exitTime: fill.time,
        entry: position.entry,
        exit: fill.open,
        returnPct: (net - 1) * 100,
        bars: i + 1 - position.index,
      });
      position = null;
    }
  }

  // 回測結束時還抱著就用最後一根收盤結算，不要假裝那筆不存在
  if (position && last) {
    const net = (last.close / position.entry) * (1 - cost / 100);
    equity *= net;
    markEquity(equity);
    const heldTo = bars.length - 1;
    heldBars += heldTo - position.index;
    trades.push({
      entryTime: position.time,
      exitTime: last.time,
      entry: position.entry,
      exit: last.close,
      returnPct: (net - 1) * 100,
      bars: heldTo - position.index,
    });
  }

  const wins = trades.filter((t) => t.returnPct > 0).length;

  return {
    trades,
    tradeCount: trades.length,
    winRate: trades.length ? wins / trades.length : 0,
    totalReturn: (equity - 1) * 100,
    buyHold,
    maxDrawdown: maxDrawdown * 100,
    avgHoldBars: trades.length ? heldBars / trades.length : 0,
    exposure: bars.length ? heldBars / bars.length : 0,
  };
}

export interface SweepCell {
  fast: number;
  slow: number;
  result: BacktestResult;
}

/** 掃過整片 fast × slow 網格。fast >= slow 的組合直接跳過。 */
export function sweep(
  bars: readonly Bar[],
  fastValues: readonly number[],
  slowValues: readonly number[],
  options: Omit<BacktestOptions, 'fast' | 'slow'> = {},
): SweepCell[] {
  const cells: SweepCell[] = [];
  for (const slow of slowValues) {
    for (const fast of fastValues) {
      if (fast >= slow) continue;
      cells.push({ fast, slow, result: maCrossBacktest(bars, { ...options, fast, slow }) });
    }
  }
  return cells;
}
