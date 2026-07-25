import { describe, expect, it } from 'vitest';
import { macd } from '../macd';
import { bollinger } from '../bollinger';
import { atr, trueRange } from '../atr';
import { dmi } from '../dmi';
import { obv, volumeRatio, vwap } from '../volume';
import { closesToBars, makeBars, values, firstDefined } from './helpers';

describe('macd', () => {
  const bars = closesToBars(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 6) * 10));

  it('DIF 從慢線暖機完成才開始（索引 slow−1）', () => {
    const { dif } = macd(bars, { fast: 12, slow: 26, signal: 9 });
    expect(firstDefined(values(dif))).toBe(25);
  });

  it('訊號線只從 DIF 有值之後才起算，不會把暖機期的 null 當成 0', () => {
    const { dea } = macd(bars, { fast: 12, slow: 26, signal: 9 });
    // DIF 從 25 開始，再套 9 期 EMA → 第一個 DEA 在 25 + 9 − 1 = 33
    expect(firstDefined(values(dea))).toBe(33);
  });

  it('柱狀圖等於 DIF − DEA', () => {
    const { dif, dea, hist } = macd(bars);
    for (let i = 0; i < bars.length; i += 1) {
      if (dif[i]!.value === null || dea[i]!.value === null) {
        expect(hist[i]!.value).toBeNull();
        continue;
      }
      expect(hist[i]!.value).toBeCloseTo(dif[i]!.value! - dea[i]!.value!, 3);
    }
  });

  it('doubleHistogram 只放大數值，不改變正負號', () => {
    const single = macd(bars);
    const double = macd(bars, { doubleHistogram: true });
    for (let i = 0; i < bars.length; i += 1) {
      const a = single.hist[i]!.value;
      const b = double.hist[i]!.value;
      if (a === null) continue;
      expect(b).toBeCloseTo(a * 2, 3);
      expect(Math.sign(b!)).toBe(Math.sign(a));
    }
  });

  it('fast 不小於 slow 時直接報錯，而不是安靜地算出反向的 DIF', () => {
    expect(() => macd(bars, { fast: 26, slow: 12 })).toThrow(RangeError);
  });
});

describe('bollinger', () => {
  /**
   * 教科書例：[2,4,4,4,5,5,7,9]，n=8
   * 平均 5，母體標準差 √(32/8) = 2，所以 2σ 通道是 1 ~ 9。
   * 若誤用樣本標準差（除以 n−1）會得到 σ≈2.138，通道變成 0.72 ~ 9.28。
   */
  it('用母體標準差（除以 n），不是樣本標準差', () => {
    const bars = closesToBars([2, 4, 4, 4, 5, 5, 7, 9]);
    const { upper, middle, lower } = bollinger(bars, { period: 8, multiplier: 2 });
    expect(middle[7]!.value).toBe(5);
    expect(upper[7]!.value).toBe(9);
    expect(lower[7]!.value).toBe(1);
  });

  it('%b 與帶寬', () => {
    const bars = closesToBars([2, 4, 4, 4, 5, 5, 7, 9]);
    const { percentB, bandwidth } = bollinger(bars, { period: 8, multiplier: 2 });
    // 收盤 9 剛好貼上軌 → %b = 1
    expect(percentB[7]!.value).toBe(1);
    // (9−1)/5 × 100 = 160
    expect(bandwidth[7]!.value).toBe(160);
  });

  it('完全無波動時通道收成一條線，%b 給中性的 0.5 而不是 NaN', () => {
    const { upper, lower, percentB } = bollinger(closesToBars(new Array(25).fill(50)), {
      period: 20,
    });
    expect(upper[24]!.value).toBe(50);
    expect(lower[24]!.value).toBe(50);
    expect(percentB[24]!.value).toBe(0.5);
  });
});

describe('atr', () => {
  /**
   * bars (high, low, close)，period = 2
   *   0  10  8   9    TR 無（沒有昨收）
   *   1  11  9  10    TR = max(2, |11−9|, |9−9|)   = 2
   *   2  12 11  12    TR = max(1, |12−10|, |11−10|) = 2
   *   3  13  9  10    TR = max(4, |13−12|, |9−12|)  = 4
   *   種子 = (2+2)/2 = 2 → ATR[2] = 2
   *   ATR[3] = (2×1 + 4)/2 = 3
   */
  const bars = makeBars([
    [10, 8, 9],
    [11, 9, 10],
    [12, 11, 12],
    [13, 9, 10],
  ]);

  it('真實區間把跳空算進去', () => {
    expect(trueRange(bars)).toEqual([null, 2, 2, 4]);
  });

  it('第一根沒有昨收，TR 為 null', () => {
    expect(trueRange(bars)[0]).toBeNull();
  });

  it('Wilder 平滑後的 ATR 符合手算', () => {
    expect(values(atr(bars, { period: 2 }))).toEqual([null, null, 2, 3]);
  });

  it('跳空的窄幅 K 棒不會被當成低波動', () => {
    // 高低差只有 1，但整根跳空 10 元 —— TR 必須反映那 10 元的風險
    const gapped = makeBars([
      [100, 99, 100],
      [111, 110, 110],
    ]);
    expect(trueRange(gapped)[1]).toBe(11);
  });
});

describe('dmi', () => {
  const trending = makeBars(
    Array.from({ length: 80 }, (_, i) => [100 + i * 2 + 3, 100 + i * 2 - 3, 100 + i * 2] as const),
  );
  const choppy = makeBars(
    Array.from({ length: 80 }, (_, i) => {
      const base = 100 + (i % 2 === 0 ? 2 : -2);
      return [base + 3, base - 3, base] as const;
    }),
  );

  it('單邊上漲時 +DI 明顯高於 −DI', () => {
    const { plusDi, minusDi } = dmi(trending);
    const i = trending.length - 1;
    expect(plusDi[i]!.value!).toBeGreaterThan(minusDi[i]!.value!);
  });

  it('趨勢明確時 ADX 高，來回震盪時 ADX 低', () => {
    const trendAdx = dmi(trending).adx.at(-1)!.value!;
    const choppyAdx = dmi(choppy).adx.at(-1)!.value!;
    expect(trendAdx).toBeGreaterThan(40);
    expect(choppyAdx).toBeLessThan(25);
  });

  it('+DI／−DI／ADX 都落在 0~100', () => {
    const { plusDi, minusDi, adx } = dmi(choppy);
    for (const p of [...plusDi, ...minusDi, ...adx]) {
      if (p.value === null) continue;
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});

describe('volume', () => {
  it('OBV 收紅加量、收黑減量、平盤不動', () => {
    const bars = closesToBars([10, 11, 10, 10, 12], [100, 200, 300, 400, 500]);
    expect(values(obv(bars))).toEqual([0, 200, -100, -100, 400]);
  });

  it('量比是今日量除以均量', () => {
    const bars = closesToBars([1, 2, 3, 4, 5], [100, 100, 100, 100, 300]);
    // MA5 均量 = (100+100+100+100+300)/5 = 140 → 300/140 = 2.14
    expect(volumeRatio(bars, { period: 5 })[4]!.value).toBeCloseTo(2.14, 2);
  });

  it('VWAP 用典型價加權', () => {
    const bars = makeBars(
      [
        [12, 8, 10],
        [22, 18, 20],
      ],
      100,
    );
    // TP = (H+L+C)/3 → 10 與 20，等量加權後 = 15
    expect(vwap(bars)[1]!.value).toBeCloseTo(15, 4);
  });

  it('指數沒有成交量，VWAP 回 null 而不是 NaN', () => {
    const index = closesToBars([100, 101, 102], [0, 0, 0]);
    expect(values(vwap(index))).toEqual([null, null, null]);
  });
});
