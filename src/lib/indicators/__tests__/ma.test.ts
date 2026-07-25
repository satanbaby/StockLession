import { describe, expect, it } from 'vitest';
import { sma, ema, wma, wilderSmooth, movingAverage, bias } from '../ma';
import { closesToBars, values } from './helpers';

describe('sma', () => {
  it('前 period−1 根是暖機期，必須是 null 而不是 0', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('period 1 等於原始序列', () => {
    expect(sma([3, 1, 4], 1)).toEqual([3, 1, 4]);
  });

  it('資料不足時整條都是 null', () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });

  it('滑動視窗的遞推不會累積浮點誤差', () => {
    // 大數之後接小數，天真的加減會留下殘值
    const result = sma([1e9, 1e9, 1e9, 1, 1, 1], 3);
    expect(result[5]).toBe(1);
  });
});

describe('ema', () => {
  /**
   * 種子必須是「前 period 根的 SMA」。
   * 若誤用第一根收盤價當種子，index 2 會是 2.25 而不是 2 —— 這正是本測試要擋的 bug。
   */
  it('用前 period 根的 SMA 當種子', () => {
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('平滑係數是 2/(n+1)', () => {
    // period 3 → k = 0.5，所以每一步都是「新值與前值各半」
    const out = ema([10, 10, 10, 20], 3);
    expect(out[2]).toBe(10);
    expect(out[3]).toBe(15);
  });

  it('常數序列的 EMA 恆等於該常數', () => {
    expect(ema([7, 7, 7, 7, 7], 3)).toEqual([null, null, 7, 7, 7]);
  });
});

describe('wma', () => {
  it('權重是 1..n 的等差級數', () => {
    // (1×1 + 2×2 + 3×3) / 6 = 14/6
    const out = wma([1, 2, 3, 4, 5], 3);
    expect(out[2]).toBeCloseTo(14 / 6, 4);
    expect(out[3]).toBeCloseTo(20 / 6, 4);
    expect(out[4]).toBeCloseTo(26 / 6, 4);
  });
});

describe('wilderSmooth', () => {
  it('係數是 1/n，比同週期 EMA 慢', () => {
    const w = wilderSmooth([10, 10, 10, 20], 3);
    const e = ema([10, 10, 10, 20], 3);
    // Wilder α=1/3 → 10×2/3 + 20/3 = 13.333；EMA α=0.5 → 15
    expect(w[3]).toBeCloseTo(40 / 3, 4);
    expect(e[3]).toBe(15);
    expect(w[3]!).toBeLessThan(e[3]!);
  });
});

describe('movingAverage', () => {
  it('回傳的點數與 K 棒數相同，時間軸對齊', () => {
    const bars = closesToBars([1, 2, 3, 4, 5]);
    const out = movingAverage(bars, { period: 3 });
    expect(out).toHaveLength(5);
    expect(out.map((p) => p.time)).toEqual(bars.map((b) => b.time));
    expect(values(out)).toEqual([null, null, 2, 3, 4]);
  });

  it('可以改用其他價格欄位', () => {
    const bars = closesToBars([1, 2, 3]).map((b) => ({ ...b, high: b.close + 10 }));
    expect(values(movingAverage(bars, { period: 3, source: 'high' }))).toEqual([null, null, 12]);
  });
});

describe('bias', () => {
  it('乖離率是相對均線的百分比', () => {
    // MA3 在 index 2 是 2，收盤 3 → (3−2)/2 = +50%
    const out = bias(closesToBars([1, 2, 3]), { period: 3 });
    expect(values(out)).toEqual([null, null, 50]);
  });
});
