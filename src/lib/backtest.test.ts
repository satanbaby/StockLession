import { describe, expect, it } from 'vitest';
import { maCrossBacktest, sweep } from './backtest';
import { dataset } from './data';
import type { Bar } from './indicators/types';

/** 用收盤價序列造 bar，開盤價 = 前一根收盤（成交在下一根開盤這件事才驗得出來） */
function bars(closes: number[]): Bar[] {
  return closes.map((c, i) => {
    const open = i === 0 ? c : closes[i - 1]!;
    return {
      time: `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      open,
      high: Math.max(open, c),
      low: Math.min(open, c),
      close: c,
      volume: 1000,
    };
  });
}

describe('maCrossBacktest', () => {
  it('fast >= slow 直接回傳空結果，不會拋錯', () => {
    const r = maCrossBacktest(bars([1, 2, 3, 4, 5]), { fast: 20, slow: 5 });
    expect(r.tradeCount).toBe(0);
    expect(r.totalReturn).toBe(0);
  });

  it('資料不足以完成暖機時也回傳空結果', () => {
    const r = maCrossBacktest(bars([1, 2, 3]), { fast: 2, slow: 60 });
    expect(r.tradeCount).toBe(0);
  });

  /** 先跌 40 根再漲 80 根 —— 中間會出現一次貨真價實的黃金交叉 */
  const vShape = bars([
    ...Array.from({ length: 40 }, (_, i) => 140 - i),
    ...Array.from({ length: 80 }, (_, i) => 100 + i),
  ]);

  it('先跌後漲會進場一次，並抱到最後', () => {
    const r = maCrossBacktest(vShape, { fast: 5, slow: 20 });
    expect(r.tradeCount).toBe(1);
    expect(r.totalReturn).toBeGreaterThan(0);
    expect(r.trades[0]!.exitTime).toBe(vShape.at(-1)!.time);
  });

  it('一路單邊上漲不會產生訊號 —— 沒有交叉就是沒有交叉', () => {
    // 均線可用時 MA5 早就在 MA20 上方，從頭到尾沒有「由下往上穿越」這件事發生。
    // 這是刻意的：訊號是事件，不是狀態。
    const alwaysUp = bars(Array.from({ length: 120 }, (_, i) => 100 + i));
    expect(maCrossBacktest(alwaysUp, { fast: 5, slow: 20 }).tradeCount).toBe(0);
  });

  it('成本會確實吃掉報酬', () => {
    const free = maCrossBacktest(vShape, { fast: 5, slow: 20, cost: 0 });
    const paid = maCrossBacktest(vShape, { fast: 5, slow: 20, cost: 0.585 });
    expect(paid.totalReturn).toBeLessThan(free.totalReturn);
    // 一筆交易吃一次成本，報酬差距至少 0.4 個百分點
    expect(free.totalReturn - paid.totalReturn).toBeGreaterThan(0.4);
  });

  it('成交價用的是訊號隔天的開盤，不是訊號當天的收盤', () => {
    const r = maCrossBacktest(vShape, { fast: 5, slow: 20, cost: 0 });
    const trade = r.trades[0]!;
    const entryBar = vShape.find((b) => b.time === trade.entryTime)!;
    expect(trade.entry).toBe(entryBar.open);
    // 這裡的開盤等於前一根（訊號日）的收盤，而不是這一根的收盤
    expect(trade.entry).toBeLessThan(entryBar.close);
  });

  it('最大回落是正數且不超過 100%', () => {
    const r = maCrossBacktest(dataset('2330').bars, { fast: 20, slow: 60 });
    expect(r.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(r.maxDrawdown).toBeLessThan(100);
  });

  it('每一筆交易的出場都不早於進場', () => {
    const r = maCrossBacktest(dataset('2330').bars, { fast: 5, slow: 20 });
    expect(r.tradeCount).toBeGreaterThan(3);
    for (const t of r.trades) {
      expect(t.exitTime > t.entryTime).toBe(true);
      expect(t.bars).toBeGreaterThan(0);
    }
  });

  it('在市場裡的時間佔比落在 0~1 之間', () => {
    const r = maCrossBacktest(dataset('2330').bars, { fast: 10, slow: 40 });
    expect(r.exposure).toBeGreaterThan(0);
    expect(r.exposure).toBeLessThanOrEqual(1);
  });
});

describe('sweep', () => {
  const grid = sweep(dataset('2330').bars, [5, 10, 20], [20, 60, 120]);

  it('跳過 fast >= slow 的組合', () => {
    expect(grid.every((c) => c.fast < c.slow)).toBe(true);
    // 3×3 扣掉 fast=20/slow=20 這一組
    expect(grid).toHaveLength(8);
  });

  it('每一格都有完整結果', () => {
    for (const cell of grid) {
      expect(Number.isFinite(cell.result.totalReturn)).toBe(true);
      expect(Number.isFinite(cell.result.buyHold)).toBe(true);
    }
  });
});
