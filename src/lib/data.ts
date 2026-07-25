/**
 * 行情資料存取。
 *
 * 資料是建置期就打包好的靜態 JSON（見 scripts/fetch-twse.mjs），
 * 網站 runtime 完全不連網 —— 離線可讀，而且每個人看到的圖完全一樣。
 * 教材寫「2024 年 3 月那根長黑」的時候，那根長黑永遠都在。
 */

import twse2330 from '@/data/ohlcv/2330.json';
import taiex from '@/data/ohlcv/taiex.json';
import twse2603 from '@/data/ohlcv/2603.json';
import type { Bar } from './indicators/types';

export interface Dataset {
  symbol: string;
  name: string;
  market: string;
  interval: string;
  /** TWSE 的日線是未還原權值，除權息當日會有跳空缺口 */
  priceAdjusted: boolean;
  volumeUnit: string;
  note: string;
  source: string;
  fetchedAt: string;
  range: { from: string; to: string } | null;
  count: number;
  bars: Bar[];
}

export const DATASETS = {
  '2330': twse2330 as Dataset,
  taiex: taiex as Dataset,
  '2603': twse2603 as Dataset,
} satisfies Record<string, Dataset>;

export type SymbolId = keyof typeof DATASETS;

export const SYMBOL_IDS = Object.keys(DATASETS) as SymbolId[];

export function dataset(symbol: SymbolId): Dataset {
  return DATASETS[symbol];
}

/** 顯示用標籤，例如「2330 台積電」；指數不重複顯示代號 */
export function label(symbol: SymbolId): string {
  const d = DATASETS[symbol];
  return d.symbol === 'taiex' ? d.name : `${d.symbol} ${d.name}`;
}

export interface SliceOptions {
  /** 起訖日 'YYYY-MM-DD'（含端點） */
  from?: string;
  to?: string;
  /**
   * 在 from 之前多留幾根當暖機。
   *
   * 這個參數是必要的：想讓學員看 2024/03 那一段的 MA60，
   * 就得把 2023/12 之後的資料也餵進去算，否則畫面左半邊會是一片空白。
   * 圖表顯示範圍再用 visibleRange 收回 from~to。
   */
  warmup?: number;
  /** 只取最後 n 根 */
  last?: number;
}

/**
 * 取一段 K 棒。
 * 回傳 bars（含暖機段）與 visibleRange（實際想讓學員看的那一段），
 * 兩者一起交給 PriceChart 就能得到「指標從第一根就有值」的乾淨畫面。
 */
export function slice(
  symbol: SymbolId,
  options: SliceOptions = {},
): { bars: Bar[]; visibleRange?: { from: string; to: string } } {
  const all = DATASETS[symbol].bars;
  const { from, to, warmup = 0, last } = options;

  if (last !== undefined) {
    const start = Math.max(0, all.length - last - warmup);
    const bars = all.slice(start);
    const visibleFrom = all[Math.max(0, all.length - last)]?.time;
    const visibleTo = all[all.length - 1]?.time;
    return {
      bars,
      visibleRange: warmup > 0 && visibleFrom && visibleTo
        ? { from: visibleFrom, to: visibleTo }
        : undefined,
    };
  }

  let startIndex = from ? all.findIndex((b) => b.time >= from) : 0;
  if (startIndex === -1) startIndex = 0;

  let endIndex = to ? all.findLastIndex((b) => b.time <= to) : all.length - 1;
  if (endIndex === -1) endIndex = all.length - 1;

  const warmedStart = Math.max(0, startIndex - warmup);
  const bars = all.slice(warmedStart, endIndex + 1);

  const visibleFrom = all[startIndex]?.time;
  const visibleTo = all[endIndex]?.time;

  return {
    bars,
    visibleRange:
      warmedStart < startIndex && visibleFrom && visibleTo
        ? { from: visibleFrom, to: visibleTo }
        : undefined,
  };
}

/** 合成的教學用資料（型態課需要教科書級的乾淨範例，真實行情很少這麼標準） */
export interface SyntheticSet {
  id: string;
  name: string;
  /** 一律標示為示意圖，絕不混充真實行情 */
  synthetic: true;
  description: string;
  bars: Bar[];
}
