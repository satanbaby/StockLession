/**
 * 教學用的合成型態資料。
 *
 * 為什麼需要它：真實行情裡幾乎找不到教科書那麼標準的頭肩頂。
 * 第一次介紹一個型態時，學員需要看到「乾淨的原型」才能建立辨識基準；
 * 等原型記住了，下一步才是拿真實線圖去找歪掉的版本。
 *
 * 用這裡的資料畫的圖，一律標示「示意圖」—— 絕不混充真實行情。
 *
 * 產生方式是決定性的（固定種子的 LCG），所以每次建置出來的圖完全一樣，
 * 課文寫「第三個高點」時，那個高點永遠在同一個位置。
 */

import type { Bar } from '@/lib/indicators/types';

/** 線性同餘產生器。要的是「每次都一樣」，不是密碼學品質的亂數。 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 交易日序列，跳過週末（合成資料也該長得像真的） */
function tradingDays(start: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

interface BuildOptions {
  /** [位置比例 0~1, 價格] 的控制點，中間線性內插 */
  path: [number, number][];
  count: number;
  start: string;
  seed: number;
  /** 日內波動幅度，佔價格的百分比 */
  wiggle?: number;
  /** 基礎成交量（張） */
  baseVolume?: number;
  /** 特定區間放大量：[起比例, 迄比例, 倍數] */
  volumeBursts?: [number, number, number][];
}

function build({
  path,
  count,
  start,
  seed,
  wiggle = 0.012,
  baseVolume = 30000,
  volumeBursts = [],
}: BuildOptions): Bar[] {
  const rand = rng(seed);
  const days = tradingDays(start, count);

  /** 在控制點之間內插出當日的「中心價」 */
  const centerAt = (t: number): number => {
    for (let i = 1; i < path.length; i += 1) {
      const [t0, p0] = path[i - 1]!;
      const [t1, p1] = path[i]!;
      if (t <= t1) {
        const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        // 用平滑步進而不是直線，轉折處才不會出現生硬的尖角
        const smooth = k * k * (3 - 2 * k);
        return p0 + (p1 - p0) * smooth;
      }
    }
    return path[path.length - 1]![1];
  };

  const bars: Bar[] = [];
  let prevClose = centerAt(0);

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const center = centerAt(t);

    // 圍繞中心價的雜訊，讓線圖不會是一條完美的曲線
    const noise = (rand() - 0.5) * 2 * center * wiggle;
    const close = center + noise;
    const open = prevClose + (rand() - 0.5) * center * wiggle * 0.6;

    const span = center * wiggle * (0.6 + rand() * 0.9);
    const high = Math.max(open, close) + rand() * span;
    const low = Math.min(open, close) - rand() * span;

    let volume = baseVolume * (0.65 + rand() * 0.7);
    for (const [from, to, mult] of volumeBursts) {
      if (t >= from && t <= to) volume *= mult;
    }
    // 上漲日通常帶量
    if (close > open) volume *= 1.15;

    bars.push({
      time: days[i]!,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(volume),
    });
    prevClose = close;
  }

  return bars;
}

const round = (v: number): number => Math.round(v * 10) / 10;

export interface PatternSet {
  id: string;
  name: string;
  /** 課文要引用的關鍵位置，例如頸線價位 */
  meta: Record<string, number | string>;
  bars: Bar[];
}

/**
 * 頭肩頂。
 *
 * 左肩 → 回檔 → 頭（更高）→ 回檔到差不多位置 → 右肩（比頭低）→ 跌破頸線。
 * 兩次回檔的低點連起來就是頸線，跌破它才算型態完成 —— 在那之前都只是「像」。
 */
export const headAndShoulders: PatternSet = {
  id: 'head-and-shoulders',
  name: '頭肩頂',
  meta: { neckline: 104, leftShoulder: 118, head: 132, rightShoulder: 119 },
  bars: build({
    count: 130,
    start: '2024-01-02',
    seed: 20240102,
    wiggle: 0.011,
    path: [
      [0, 88],
      [0.14, 118], // 左肩
      [0.24, 104], // 回檔到頸線
      [0.4, 132], // 頭
      [0.52, 105], // 再次回到頸線附近
      [0.66, 119], // 右肩，明顯低於頭
      [0.78, 103], // 跌破頸線
      [0.88, 92],
      [1, 86],
    ],
    // 教科書上的量能：左肩量最大，頭部量縮（背離），跌破時再放量
    volumeBursts: [
      [0.08, 0.18, 1.9],
      [0.36, 0.44, 0.75],
      [0.62, 0.7, 0.7],
      [0.76, 0.86, 2.1],
    ],
  }),
};

/** 雙重底（W 底）。兩個差不多深的低點，中間的反彈高點就是頸線。 */
export const doubleBottom: PatternSet = {
  id: 'double-bottom',
  name: '雙重底',
  meta: { neckline: 72, firstLow: 55, secondLow: 56 },
  bars: build({
    count: 120,
    start: '2024-01-02',
    seed: 777,
    wiggle: 0.013,
    baseVolume: 22000,
    path: [
      [0, 86],
      [0.2, 55], // 第一隻腳
      [0.38, 72], // 反彈到頸線
      [0.56, 56], // 第二隻腳，與第一隻幾乎同高
      [0.72, 73], // 回到頸線
      [0.84, 84], // 突破
      [1, 92],
    ],
    volumeBursts: [
      [0.16, 0.24, 1.6],
      [0.5, 0.6, 0.6], // 第二隻腳量縮 —— 賣壓衰竭的訊號
      [0.78, 0.9, 2.2], // 突破放量
    ],
  }),
};

export const PATTERNS: Record<string, PatternSet> = {
  [headAndShoulders.id]: headAndShoulders,
  [doubleBottom.id]: doubleBottom,
};
