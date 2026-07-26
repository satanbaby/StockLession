/**
 * 合成型態資料的性質測試。
 *
 * 課文會直接引用這些資料的特徵（「第二個高點更高但 RSI 更低」、
 * 「這兩根之間是真的跳空」）。合成資料是程式產生的，改一個種子或控制點
 * 就可能讓課文的敘述變成謊話 —— 所以把敘述寫成斷言鎖住。
 */

import { describe, expect, it } from 'vitest';
import {
  ascendingTriangle,
  bearishDivergence,
  bullFlag,
  doubleBottom,
  headAndShoulders,
  islandReversal,
  rectangle,
  risingWedge,
  PATTERNS,
} from './patterns';
import { rsi } from '@/lib/indicators/rsi';
import { macd } from '@/lib/indicators/macd';
import type { Bar } from '@/lib/indicators/types';

/** 某段區間裡最高的那一根的索引 */
function peakIndex(bars: Bar[], from: number, to: number): number {
  let best = from;
  for (let i = from; i <= to; i += 1) {
    if (bars[i]!.high > bars[best]!.high) best = i;
  }
  return best;
}

describe('合成資料的基本健全性', () => {
  for (const [id, set] of Object.entries(PATTERNS)) {
    it(`${id} 的 OHLC 關係成立且日期遞增`, () => {
      expect(set.bars.length).toBeGreaterThan(50);
      for (let i = 0; i < set.bars.length; i += 1) {
        const b = set.bars[i]!;
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
        expect(b.volume).toBeGreaterThan(0);
        if (i > 0) expect(b.time > set.bars[i - 1]!.time).toBe(true);
      }
    });
  }
});

describe('頭肩頂', () => {
  const bars = headAndShoulders.bars;

  it('頭比兩肩都高，兩肩高度接近', () => {
    const left = bars[peakIndex(bars, 10, 25)]!.high;
    const head = bars[peakIndex(bars, 45, 60)]!.high;
    const right = bars[peakIndex(bars, 80, 92)]!.high;
    expect(head).toBeGreaterThan(left);
    expect(head).toBeGreaterThan(right);
    // 教科書要求的是「兩肩大致等高」，不是右肩一定要更低
    expect(Math.abs(right - left) / left).toBeLessThan(0.05);
  });

  it('頭部的量比左肩小（量價背離）', () => {
    const avg = (from: number, to: number) =>
      bars.slice(from, to).reduce((s, b) => s + b.volume, 0) / (to - from);
    expect(avg(45, 60)).toBeLessThan(avg(10, 25));
  });
});

describe('雙重底', () => {
  const bars = doubleBottom.bars;

  it('兩隻腳深度接近（差距在 8% 以內）', () => {
    const low = (from: number, to: number) => Math.min(...bars.slice(from, to).map((b) => b.low));
    const first = low(18, 30);
    const second = low(62, 74);
    expect(Math.abs(first - second) / first).toBeLessThan(0.08);
  });
});

describe('上升三角', () => {
  const bars = ascendingTriangle.bars;

  it('四次觸及壓力的高點落在同一條窄帶上', () => {
    const touches = [[5, 14], [26, 36], [48, 58], [68, 77]].map(
      ([a, b]) => bars[peakIndex(bars, a!, b!)]!.high,
    );
    const spread = Math.max(...touches) - Math.min(...touches);
    expect(spread / Math.min(...touches)).toBeLessThan(0.05);
  });

  it('低點一次比一次高', () => {
    const low = (from: number, to: number) => Math.min(...bars.slice(from, to).map((b) => b.low));
    const lows = [low(15, 24), low(37, 46), low(58, 66)];
    expect(lows[1]!).toBeGreaterThan(lows[0]!);
    expect(lows[2]!).toBeGreaterThan(lows[1]!);
  });
});

describe('多頭旗形', () => {
  const bars = bullFlag.bars;

  it('旗面的量明顯小於旗桿', () => {
    const avg = (from: number, to: number) =>
      bars.slice(from, to).reduce((s, b) => s + b.volume, 0) / (to - from);
    expect(avg(32, 62)).toBeLessThan(avg(6, 26) * 0.5);
  });

  it('旗面的回檔幅度小於旗桿漲幅的一半', () => {
    const poleLow = Math.min(...bars.slice(0, 8).map((b) => b.low));
    const poleHigh = Math.max(...bars.slice(20, 30).map((b) => b.high));
    const flagLow = Math.min(...bars.slice(30, 62).map((b) => b.low));
    expect(poleHigh - flagLow).toBeLessThan((poleHigh - poleLow) * 0.5);
  });
});

describe('上升楔形', () => {
  const bars = risingWedge.bars;

  it('每一波的漲幅越來越小（兩條邊界在收斂）', () => {
    const swing = (lowFrom: number, lowTo: number, highFrom: number, highTo: number) =>
      Math.max(...bars.slice(highFrom, highTo).map((b) => b.high)) -
      Math.min(...bars.slice(lowFrom, lowTo).map((b) => b.low));
    const first = swing(0, 6, 8, 14);
    const last = swing(76, 84, 88, 96);
    expect(last).toBeLessThan(first);
  });
});

describe('矩形整理', () => {
  const bars = rectangle.bars;

  it('整理期間完全被上下兩條線框住', () => {
    const box = bars.slice(8, 80);
    expect(Math.max(...box.map((b) => b.high))).toBeLessThan(84);
    expect(Math.min(...box.map((b) => b.low))).toBeGreaterThan(62);
  });
});

describe('島狀反轉', () => {
  const bars = islandReversal.bars;

  /** 真正的跳空：今天的最低仍高於昨天的最高（或反過來） */
  const gapUps = bars
    .map((b, i) => (i > 0 && b.low > bars[i - 1]!.high ? i : -1))
    .filter((i) => i > 0);
  const gapDowns = bars
    .map((b, i) => (i > 0 && b.high < bars[i - 1]!.low ? i : -1))
    .filter((i) => i > 0);

  it('存在一個向上與一個向下的真缺口', () => {
    expect(gapUps.length).toBe(1);
    expect(gapDowns.length).toBe(1);
    expect(gapDowns[0]!).toBeGreaterThan(gapUps[0]!);
  });

  it('兩個缺口把中間那段孤立成一座島', () => {
    const start = gapUps[0]!;
    const end = gapDowns[0]!;
    const islandLow = Math.min(...bars.slice(start, end).map((b) => b.low));
    // 島上的最低點，仍高於進島前與出島後的價格
    expect(islandLow).toBeGreaterThan(bars[start - 1]!.high);
    expect(islandLow).toBeGreaterThan(bars[end]!.high);
  });
});

describe('頂背離', () => {
  const bars = bearishDivergence.bars;
  const first = peakIndex(bars, 22, 38);
  const second = peakIndex(bars, 108, 125);

  it('第二個高點的價格比第一個高', () => {
    expect(bars[second]!.high).toBeGreaterThan(bars[first]!.high);
  });

  it('但 RSI 與 MACD 的 DIF 在第二個高點都比較低', () => {
    const r = rsi(bars, { period: 14 });
    const { dif } = macd(bars, { fast: 12, slow: 26, signal: 9 });
    expect(r[second]!.value).toBeLessThan(r[first]!.value!);
    expect(dif[second]!.value).toBeLessThan(dif[first]!.value!);
  });
});
