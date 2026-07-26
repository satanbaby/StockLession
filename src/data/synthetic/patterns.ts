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
  /**
   * 跳空缺口：從 at（位置比例）那一根開始，整條路徑乘上 (1 + pct/100)。
   * 缺口那一根的開盤會直接跳到新的中心價，而不是延續前一根的收盤 ——
   * 否則畫出來會是一根長 K 棒，不是缺口。
   */
  gaps?: { at: number; pct: number }[];
}

function build({
  path,
  count,
  start,
  seed,
  wiggle = 0.012,
  baseVolume = 30000,
  volumeBursts = [],
  gaps = [],
}: BuildOptions): Bar[] {
  const rand = rng(seed);
  const days = tradingDays(start, count);
  // 用 ceil 而不是 round：gapFactor 是以 t >= at 判斷的，
  // round 會挑到 t 還沒跨過 at 的那一根，開盤跳了但中心價沒跳，缺口就補不起來
  const gapBars = new Set(gaps.map((g) => Math.ceil(g.at * (count - 1))));
  const gapFactor = (t: number): number =>
    gaps.reduce((f, g) => (t >= g.at ? f * (1 + g.pct / 100) : f), 1);

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
    const center = centerAt(t) * gapFactor(t);

    // 圍繞中心價的雜訊，讓線圖不會是一條完美的曲線
    const noise = (rand() - 0.5) * 2 * center * wiggle;
    const close = center + noise;
    const open = gapBars.has(i)
      ? center + (rand() - 0.5) * center * wiggle * 0.4
      : prevClose + (rand() - 0.5) * center * wiggle * 0.6;

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

/**
 * 上升三角。
 *
 * 高點被同一條水平線擋住三、四次，低點卻一次比一次高 ——
 * 賣單掛在固定價位慢慢被吃掉，買方卻越等越急。這是整理型態裡偏多的那一種。
 */
export const ascendingTriangle: PatternSet = {
  id: 'ascending-triangle',
  name: '上升三角',
  meta: { resistance: 100.5, base: 86, target: 115 },
  bars: build({
    count: 110,
    start: '2024-01-02',
    seed: 31415,
    wiggle: 0.01,
    baseVolume: 18000,
    path: [
      [0, 80],
      [0.08, 100], // 第一次觸及壓力
      [0.17, 86],
      [0.28, 100], // 第二次
      [0.37, 90],
      [0.48, 100], // 第三次
      [0.56, 94],
      [0.66, 100], // 第四次
      [0.72, 97],
      [0.8, 112], // 帶量突破
      [1, 120],
    ],
    // 整理期間量能持續萎縮，突破那一刻放大 —— 這是三角型態的標準量能節奏
    volumeBursts: [
      [0.3, 0.5, 0.7],
      [0.5, 0.75, 0.5],
      [0.76, 0.88, 3],
    ],
  }),
};

/**
 * 多頭旗形。
 *
 * 急漲一段（旗桿）之後，價格在一個小幅「向下傾斜」的窄通道裡整理，
 * 然後往原方向續攻。傾斜方向是關鍵：順著原趨勢傾斜的不是旗形，是趨勢走完了。
 */
export const bullFlag: PatternSet = {
  id: 'bull-flag',
  name: '多頭旗形',
  meta: { poleFrom: 52, poleTo: 88, flagLow: 78, breakout: 90 },
  bars: build({
    count: 95,
    start: '2024-01-02',
    seed: 8888,
    wiggle: 0.009,
    baseVolume: 26000,
    path: [
      [0, 52],
      [0.06, 55],
      [0.26, 88], // 旗桿：短時間內急漲
      [0.34, 82],
      [0.42, 85],
      [0.5, 80],
      [0.58, 83],
      [0.64, 79], // 旗面：小幅下傾的窄通道
      [0.72, 92], // 突破旗面
      [0.85, 110],
      [1, 122],
    ],
    volumeBursts: [
      [0.06, 0.28, 2.4], // 旗桿放量
      [0.32, 0.68, 0.45], // 旗面量縮
      [0.7, 0.82, 2.6], // 突破再放量
    ],
  }),
};

/**
 * 上升楔形。
 *
 * 高點與低點都在墊高，但兩條邊界正在收斂 —— 每一波漲幅都比前一波小。
 * 形狀往上，結局往下：這是最容易被誤讀成「多頭整理」的空方型態。
 */
export const risingWedge: PatternSet = {
  id: 'rising-wedge',
  name: '上升楔形',
  meta: { breakdown: 84, firstLow: 66, lastLow: 85 },
  bars: build({
    count: 120,
    start: '2024-01-02',
    seed: 20250601,
    wiggle: 0.008,
    baseVolume: 24000,
    path: [
      [0, 58],
      [0.09, 76], // 漲幅 18
      [0.17, 66],
      [0.27, 82], // 漲幅 16
      [0.35, 73],
      [0.45, 88], // 漲幅 15
      [0.52, 80],
      [0.62, 92], // 漲幅 12
      [0.68, 86],
      [0.76, 94], // 漲幅 8，越推越無力
      [0.82, 91],
      [0.86, 95],
      [0.9, 84], // 跌破下緣
      [1, 70],
    ],
    // 越往上量越小，直到跌破才放量 —— 這是楔形跟真旗形最大的差別
    volumeBursts: [
      [0.0, 0.2, 1.6],
      [0.45, 0.7, 0.6],
      [0.7, 0.88, 0.4],
      [0.88, 1, 2.4],
    ],
  }),
};

/** 矩形整理（箱型）。高低點都被兩條水平線框住，突破前完全沒有方向資訊。 */
export const rectangle: PatternSet = {
  id: 'rectangle',
  name: '矩形整理',
  meta: { top: 80.5, bottom: 66, height: 14.5, target: 95 },
  bars: build({
    count: 115,
    start: '2024-01-02',
    seed: 606,
    wiggle: 0.009,
    baseVolume: 15000,
    path: [
      [0, 56],
      [0.07, 80],
      [0.16, 66],
      [0.26, 80],
      [0.35, 66],
      [0.45, 80],
      [0.54, 66],
      [0.63, 80],
      [0.7, 68],
      [0.78, 92], // 向上突破，最小滿足點 = 80 + 箱高 14 = 94
      [1, 98],
    ],
    volumeBursts: [
      [0.2, 0.72, 0.55],
      [0.74, 0.86, 3.2],
    ],
  }),
};

/**
 * 島狀反轉。
 *
 * 向上跳空 → 在高檔孤立地盤整幾天 → 再向下跳空，把那幾根 K 棒留成一座「島」。
 * 兩個缺口幾乎落在同一個價位區間，島上所有人一次全部套牢。
 */
export const islandReversal: PatternSet = {
  id: 'island-reversal',
  name: '島狀反轉',
  // 實測值（由 patterns.test.ts 鎖住）：向上跳空 95.5 → 101.1，14 根之後向下跳空 99.6 → 94.8
  meta: { gapUpFrom: 95.5, gapUpTo: 101.1, gapDownFrom: 99.6, gapDownTo: 94.8, islandBars: 14 },
  bars: build({
    count: 90,
    start: '2024-01-02',
    seed: 424242,
    wiggle: 0.008,
    baseVolume: 20000,
    path: [
      [0, 78],
      [0.2, 88],
      [0.42, 95],
      [0.46, 96],
      [0.56, 96],
      [0.6, 95],
      [0.75, 84],
      [1, 72],
    ],
    gaps: [
      { at: 0.44, pct: 5.5 }, // 竭盡缺口：最後一次衝刺
      { at: 0.6, pct: -6.5 }, // 反轉，島就此形成
    ],
    volumeBursts: [
      [0.42, 0.48, 2.8],
      [0.48, 0.58, 0.55],
      [0.58, 0.7, 2.6],
    ],
  }),
};

/**
 * 頂背離的原型。
 *
 * 第二個高點比第一個高，但走上去的速度慢得多 ——
 * 動能指標算的是「漲得多快」而不是「漲得多高」，所以它會在第二個高點給出比較低的讀數。
 * 這組資料就是刻意把「更高的價、更弱的動能」湊在一起。
 */
export const bearishDivergence: PatternSet = {
  id: 'bearish-divergence',
  name: '頂背離',
  // 實測值：第一個高點 92.6（RSI 95.3、DIF 9.71），第二個高點 97.9（RSI 73.2、DIF 1.76）
  meta: { firstPeak: 92.6, secondPeak: 97.9, firstRsi: 95.3, secondRsi: 73.2 },
  bars: build({
    count: 150,
    start: '2024-01-02',
    seed: 987654,
    wiggle: 0.009,
    baseVolume: 28000,
    path: [
      [0, 58],
      [0.04, 60],
      [0.2, 92], // 第一個高點：又快又猛
      [0.32, 78],
      [0.42, 84],
      [0.55, 88],
      [0.68, 93],
      [0.78, 97], // 第二個高點：更高，但爬了快一倍的時間
      [0.86, 90],
      [1, 74],
    ],
    volumeBursts: [
      [0.06, 0.22, 2.2], // 第一波有量
      [0.5, 0.8, 0.6], // 第二波量能明顯衰退
      [0.86, 1, 1.8],
    ],
  }),
};

export const PATTERNS: Record<string, PatternSet> = {
  [headAndShoulders.id]: headAndShoulders,
  [doubleBottom.id]: doubleBottom,
  [ascendingTriangle.id]: ascendingTriangle,
  [bullFlag.id]: bullFlag,
  [risingWedge.id]: risingWedge,
  [rectangle.id]: rectangle,
  [islandReversal.id]: islandReversal,
  [bearishDivergence.id]: bearishDivergence,
};
