import { describe, expect, it } from 'vitest';
import { kd } from '../kd';
import { makeBars, values, firstDefined } from './helpers';

describe('kd', () => {
  /**
   * 手算對照（rsvPeriod=3, kSmooth=3, dSmooth=3，K/D 初值 50）
   *
   * bars: (high, low, close)
   *   0  10  8   9
   *   1  11  9  10
   *   2  12 10  11   窗 0..2 → hi 12 lo 8  RSV=(11−8)/4×100=75
   *   3  13 11  12   窗 1..3 → hi 13 lo 9  RSV=(12−9)/4×100=75
   *   4  12 10  10   窗 2..4 → hi 13 lo 10 RSV=(10−10)/3×100=0
   *
   *   i=2  K=50×⅔+75×⅓=58.33   D=50×⅔+58.33×⅓=52.78
   *   i=3  K=58.33×⅔+75×⅓=63.89 D=52.78×⅔+63.89×⅓=56.48
   *   i=4  K=63.89×⅔+0×⅓=42.59  D=56.48×⅔+42.59×⅓=51.85
   */
  const bars = makeBars([
    [10, 8, 9],
    [11, 9, 10],
    [12, 10, 11],
    [13, 11, 12],
    [12, 10, 10],
  ]);

  it('K、D 的初始值是 50（台股慣例）', () => {
    const { k, d } = kd(bars, { rsvPeriod: 3 });
    // 初值 50 才會讓第一個 K 落在 58.33；若誤用首個 RSV 當初值會得到 75
    expect(k[2]!.value).toBeCloseTo(58.33, 2);
    expect(d[2]!.value).toBeCloseTo(52.78, 2);
  });

  it('遞迴平滑的後續值符合手算', () => {
    const { k, d } = kd(bars, { rsvPeriod: 3 });
    expect(k[3]!.value).toBeCloseTo(63.89, 2);
    expect(d[3]!.value).toBeCloseTo(56.48, 2);
    expect(k[4]!.value).toBeCloseTo(42.59, 2);
    expect(d[4]!.value).toBeCloseTo(51.85, 2);
  });

  it('RSV 是收盤價在區間中的百分位', () => {
    const { rsv } = kd(bars, { rsvPeriod: 3 });
    expect(values(rsv)).toEqual([null, null, 75, 75, 0]);
  });

  it('暖機期是 rsvPeriod−1 根', () => {
    const { k } = kd(bars, { rsvPeriod: 3 });
    expect(firstDefined(values(k))).toBe(2);
  });

  /**
   * 分母為 0 的處理，這是最容易寫錯的一段。
   * 連續 n 天完全沒波動（跌停鎖死、停牌復牌）時 hi === lo，
   * 若把 RSV 當成 0，K 會一路掉到超賣區，畫出一個根本不存在的訊號。
   */
  it('區間高低相同時 RSV 沿用前值，不會捏造超賣訊號', () => {
    const flat = makeBars([
      [10, 10, 10],
      [10, 10, 10],
      [10, 10, 10],
      [10, 10, 10],
    ]);
    const { k, d, rsv } = kd(flat, { rsvPeriod: 3 });
    // 沒有任何資訊 → 維持中性的 50
    expect(rsv[2]!.value).toBe(50);
    expect(k[3]!.value).toBe(50);
    expect(d[3]!.value).toBe(50);
  });

  it('K、D 永遠落在 0~100 之間', () => {
    const wild = makeBars(
      Array.from({ length: 200 }, (_, i) => {
        const base = 100 + Math.sin(i / 7) * 30 + (i % 11) * 2;
        return [base + 5, base - 5, base] as const;
      }),
    );
    for (const p of [...kd(wild).k, ...kd(wild).d]) {
      if (p.value === null) continue;
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it('連續漲停（每天都收在區間最高）會讓 K 逼近 100 但不超過', () => {
    const rally = makeBars(
      Array.from({ length: 60 }, (_, i) => [i + 1, i - 1, i + 1] as const),
    );
    const { k } = kd(rally, { rsvPeriod: 9 });
    const last = k[k.length - 1]!.value!;
    expect(last).toBeGreaterThan(95);
    expect(last).toBeLessThanOrEqual(100);
  });
});
