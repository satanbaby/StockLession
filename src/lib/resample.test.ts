import { describe, expect, it } from 'vitest';
import { resample } from './resample';
import { dataset } from './data';
import type { Bar } from './indicators/types';

const bar = (time: string, o: number, h: number, l: number, c: number, v = 100): Bar => ({
  time,
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

describe('resample', () => {
  it('day 原樣回傳，但不是同一個陣列', () => {
    const bars = [bar('2024-01-02', 1, 2, 0.5, 1.5)];
    const out = resample(bars, 'day');
    expect(out).toEqual(bars);
    expect(out).not.toBe(bars);
  });

  it('週線取第一個開盤、期間高低、最後一個收盤、量加總', () => {
    const week = [
      bar('2024-01-01', 10, 12, 9, 11, 100), // 週一
      bar('2024-01-02', 11, 15, 10, 14, 200),
      bar('2024-01-03', 14, 14, 8, 9, 300),
      bar('2024-01-04', 9, 13, 9, 12, 400),
      bar('2024-01-05', 12, 13, 11, 13, 500), // 週五
    ];
    const [w] = resample(week, 'week');
    expect(w).toEqual({
      time: '2024-01-05',
      open: 10,
      high: 15,
      low: 8,
      close: 13,
      volume: 1500,
    });
  });

  it('跨週會切成兩根', () => {
    const out = resample(
      [
        bar('2024-01-04', 9, 13, 9, 12), // 週四
        bar('2024-01-05', 12, 13, 11, 13), // 週五
        bar('2024-01-08', 13, 18, 13, 17), // 下週一
      ],
      'week',
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.close).toBe(13);
    expect(out[1]!.open).toBe(13);
    expect(out[1]!.high).toBe(18);
  });

  it('週日被歸到前一個週一起算的那一週', () => {
    // 2024-01-07 是週日，屬於 01-01 那一週
    const out = resample([bar('2024-01-05', 1, 1, 1, 1), bar('2024-01-07', 2, 2, 2, 2)], 'week');
    expect(out).toHaveLength(1);
  });

  it('月線依月份切', () => {
    const out = resample(
      [
        bar('2024-01-30', 10, 11, 9, 10),
        bar('2024-01-31', 10, 12, 10, 12),
        bar('2024-02-01', 12, 14, 11, 13),
      ],
      'month',
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ time: '2024-01-31', open: 10, high: 12, low: 9, close: 12 });
    expect(out[1]).toMatchObject({ time: '2024-02-01', open: 12, close: 13 });
  });
});

describe('用真實行情驗證', () => {
  const daily = dataset('2330').bars;

  it('週線與月線的日期嚴格遞增', () => {
    for (const tf of ['week', 'month'] as const) {
      const out = resample(daily, tf);
      for (let i = 1; i < out.length; i += 1) {
        expect(out[i]!.time > out[i - 1]!.time).toBe(true);
      }
    }
  });

  it('併起來的根數大致符合預期（4.5 年約 230 週、54 個月）', () => {
    expect(resample(daily, 'week').length).toBeGreaterThan(200);
    expect(resample(daily, 'week').length).toBeLessThan(250);
    expect(resample(daily, 'month')).toHaveLength(54);
  });

  it('總成交量與首開末收完全守恆', () => {
    const monthly = resample(daily, 'month');
    const sum = (bars: readonly Bar[]) => bars.reduce((s, b) => s + b.volume, 0);
    expect(sum(monthly)).toBe(sum(daily));
    expect(monthly[0]!.open).toBe(daily[0]!.open);
    expect(monthly.at(-1)!.close).toBe(daily.at(-1)!.close);
    expect(Math.max(...monthly.map((b) => b.high))).toBe(Math.max(...daily.map((b) => b.high)));
    expect(Math.min(...monthly.map((b) => b.low))).toBe(Math.min(...daily.map((b) => b.low)));
  });

  it('不會改動原始日線資料', () => {
    const before = JSON.stringify(daily.slice(0, 30));
    resample(daily, 'week');
    expect(JSON.stringify(daily.slice(0, 30))).toBe(before);
  });
});
