import { describe, expect, it } from 'vitest';
import { rsi } from '../rsi';
import { closesToBars, values, firstDefined } from './helpers';

describe('rsi', () => {
  /**
   * 手算對照（period = 3）
   *
   *   closes  10  11  10  12  11  13
   *   diff        +1  −1  +2  −1  +2
   *
   *   種子 i=1..3：gain=(1+0+2)/3=1     loss=(0+1+0)/3=1/3
   *        RSI = 100 × 1 / (1 + 1/3) = 75
   *   i=4  gain=(1×2+0)/3=2/3          loss=(⅓×2+1)/3=5/9
   *        RSI = 100 × (6/9)/(11/9) = 54.55
   *   i=5  gain=(⅔×2+2)/3=10/9         loss=(5/9×2+0)/3=10/27
   *        RSI = 100 × (30/27)/(40/27) = 75
   */
  it('Wilder 平滑的結果符合手算', () => {
    const out = rsi(closesToBars([10, 11, 10, 12, 11, 13]), { period: 3 });
    expect(values(out).slice(0, 3)).toEqual([null, null, null]);
    expect(out[3]!.value).toBeCloseTo(75, 2);
    expect(out[4]!.value).toBeCloseTo(54.55, 2);
    expect(out[5]!.value).toBeCloseTo(75, 2);
  });

  /**
   * Wilder 平滑（α = 1/N）不是 EMA（α = 2/(N+1)）。
   * 很多實作直接套 EMA，算出來會比正版敏感，跟券商軟體對不起來。
   */
  it('用的是 α=1/N 而不是 EMA 的 α=2/(N+1)', () => {
    const out = rsi(closesToBars([10, 11, 10, 12, 11, 13]), { period: 3 });
    // 若誤用 EMA(3)（α=0.5）：i=4 會得到 100×0.5/(0.5+0.6667)=42.86
    expect(out[4]!.value).not.toBeCloseTo(42.86, 1);
    expect(out[4]!.value).toBeCloseTo(54.55, 2);
  });

  it('暖機期是 period 根（第一個值落在索引 period）', () => {
    const out = rsi(closesToBars(Array.from({ length: 40 }, (_, i) => 100 + i)), { period: 14 });
    expect(firstDefined(values(out))).toBe(14);
  });

  it('一路上漲 → 100', () => {
    const out = rsi(closesToBars(Array.from({ length: 20 }, (_, i) => i + 1)), { period: 14 });
    expect(out[19]!.value).toBe(100);
  });

  it('一路下跌 → 0', () => {
    const out = rsi(closesToBars(Array.from({ length: 20 }, (_, i) => 100 - i)), { period: 14 });
    expect(out[19]!.value).toBe(0);
  });

  it('完全不動 → 50（不是 NaN，也不是 100）', () => {
    const out = rsi(closesToBars(new Array(20).fill(50)), { period: 14 });
    expect(out[19]!.value).toBe(50);
  });

  it('資料量不足 period+1 根時整條是 null', () => {
    expect(values(rsi(closesToBars([1, 2, 3]), { period: 14 }))).toEqual([null, null, null]);
  });

  it('永遠落在 0~100', () => {
    const noisy = closesToBars(
      Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 5) * 20 + ((i * 7) % 13)),
    );
    for (const p of rsi(noisy, { period: 14 })) {
      if (p.value === null) continue;
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});
