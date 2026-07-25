/**
 * 把登錄表裡的每個指標都拿真實台股資料跑一遍。
 *
 * 上面幾支測試驗的是「數學對不對」，這支驗的是「接上真實資料會不會爆」——
 * 1086 根含除權息跳空、漲跌停、長假斷點的實際行情，
 * 比任何手造的測資都更會踩到邊界條件。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { INDICATORS, defaultParams, type IndicatorSpec } from '../index';
import type { Bar } from '../types';
import { hasNoInteriorNulls } from './helpers';

function load(symbol: string): Bar[] {
  const raw = readFileSync(`src/data/ohlcv/${symbol}.json`, 'utf8');
  return (JSON.parse(raw) as { bars: Bar[] }).bars;
}

const DATASETS: [string, Bar[]][] = [
  ['2330 台積電', load('2330')],
  ['taiex 加權指數', load('taiex')],
  ['2603 長榮', load('2603')],
];

describe('資料本身', () => {
  it.each(DATASETS)('%s 的 OHLC 關係成立且依日期排序', (_name, bars) => {
    expect(bars.length).toBeGreaterThan(900);
    for (let i = 0; i < bars.length; i += 1) {
      const b = bars[i]!;
      expect(b.high).toBeGreaterThanOrEqual(b.low);
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      if (i > 0) expect(b.time > bars[i - 1]!.time).toBe(true);
    }
  });
});

describe.each(DATASETS)('指標跑真實資料：%s', (_name, bars) => {
  const cases: [string, IndicatorSpec][] = INDICATORS.map((s) => [s.name, s]);

  it.each(cases)('%s 沒有 NaN、沒有中途斷點', (_label, spec) => {
    const result = spec.compute(bars, defaultParams(spec));

    for (const [key, points] of Object.entries(result)) {
      expect(points, `${spec.id}.${key} 長度必須與 K 棒數一致`).toHaveLength(bars.length);

      for (let i = 0; i < points.length; i += 1) {
        expect(points[i]!.time, `${spec.id}.${key}[${i}] 時間軸沒對齊`).toBe(bars[i]!.time);
        const v = points[i]!.value;
        if (v !== null) expect(Number.isFinite(v), `${spec.id}.${key}[${i}] 不是有限數`).toBe(true);
      }

      // 暖機期的 null 只能出現在開頭。中間冒出 null 會讓圖表斷線。
      expect(
        hasNoInteriorNulls(points.map((p) => p.value)),
        `${spec.id}.${key} 中間出現了 null`,
      ).toBe(true);
    }
  });

  it.each(cases.filter(([, s]) => s.range))('%s 沒有超出宣告的刻度範圍', (_label, spec) => {
    const result = spec.compute(bars, defaultParams(spec));
    const { min, max } = spec.range!;
    for (const points of Object.values(result)) {
      for (const p of points) {
        if (p.value === null) continue;
        expect(p.value).toBeGreaterThanOrEqual(min);
        expect(p.value).toBeLessThanOrEqual(max);
      }
    }
  });

  it.each(cases)('%s 在參數掃過整個可調範圍時都不會爆', (_label, spec) => {
    for (const param of spec.params) {
      if (param.kind === 'number') {
        for (const v of [param.min!, param.default as number, param.max!]) {
          const params = { ...defaultParams(spec), [param.key]: v };
          // MACD 的 fast 必須小於 slow，掃到違規組合時報 RangeError 是正確行為
          let out;
          try {
            out = spec.compute(bars, params);
          } catch (err) {
            expect(err).toBeInstanceOf(RangeError);
            continue;
          }
          for (const points of Object.values(out)) {
            expect(points).toHaveLength(bars.length);
            for (const p of points) {
              if (p.value !== null) expect(Number.isFinite(p.value)).toBe(true);
            }
          }
        }
      } else {
        for (const choice of param.choices ?? []) {
          const out = spec.compute(bars, { ...defaultParams(spec), [param.key]: choice.value });
          for (const points of Object.values(out)) {
            expect(points).toHaveLength(bars.length);
          }
        }
      }
    }
  });
});

describe('登錄表本身', () => {
  it('id 不重複', () => {
    const ids = INDICATORS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每個宣告的輸出線，compute 都真的有回傳', () => {
    const bars = load('2330').slice(0, 400);
    for (const spec of INDICATORS) {
      const result = spec.compute(bars, defaultParams(spec));
      for (const s of spec.series) {
        expect(result[s.key], `${spec.id} 宣告了 ${s.key} 卻沒回傳`).toBeDefined();
      }
    }
  });

  it('每個指標都有公式與白話說明 —— 這是教學網站，缺一不可', () => {
    for (const spec of INDICATORS) {
      expect(spec.formula.length, `${spec.id} 缺公式`).toBeGreaterThan(0);
      expect(spec.question.length, `${spec.id} 缺提問`).toBeGreaterThan(0);
      expect(spec.description.length, `${spec.id} 說明太短`).toBeGreaterThan(30);
    }
  });
});
