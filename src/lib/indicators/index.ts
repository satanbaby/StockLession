/**
 * 指標登錄表。
 *
 * 每個指標在這裡宣告一次：參數範圍、輸出了哪幾條線、公式、白話說明。
 * IndicatorLab 與 /lab 頁面完全依這份宣告自動生成控制項與圖層 ——
 * 之後新增指標只要在這裡加一筆，UI 不用改。
 */

import type { Bar, Point } from './types';
import { movingAverage, bias, type MaKind } from './ma';
import { macd } from './macd';
import { kd } from './kd';
import { rsi } from './rsi';
import { bollinger } from './bollinger';
import { atrPercent } from './atr';
import { dmi } from './dmi';
import { obv, volumeRatio, vwap } from './volume';

export * from './types';
export * from './ma';
export * from './macd';
export * from './kd';
export * from './rsi';
export * from './bollinger';
export * from './atr';
export * from './dmi';
export * from './volume';

/** 一個可調參數 */
export interface ParamSpec {
  key: string;
  label: string;
  kind: 'number' | 'choice';
  /** kind === 'number' */
  min?: number;
  max?: number;
  step?: number;
  /** kind === 'choice' */
  choices?: { value: string; label: string }[];
  default: number | string;
  hint?: string;
}

/** 一條輸出線 */
export interface SeriesSpec {
  key: string;
  label: string;
  type: 'line' | 'histogram';
  /** 對應 ChartPalette.series 的索引，或 'up'/'down' 代表漲跌色 */
  color: 0 | 1 | 2 | 3 | 4 | 'up' | 'down';
  /** 虛線 */
  dashed?: boolean;
  lineWidth?: 1 | 2 | 3;
}

/** 副圖上的水平參考線 */
export interface GuideSpec {
  value: number;
  label: string;
  emphasis?: boolean;
}

export type ParamValues = Record<string, number | string>;

export interface IndicatorSpec {
  id: string;
  name: string;
  /** 圖例上的短名 */
  short: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume';
  /** overlay = 疊在 K 線上；pane = 獨立副圖 */
  placement: 'overlay' | 'pane';
  /** 一句話：這個指標到底在回答什麼問題 */
  question: string;
  description: string;
  /** KaTeX 公式（不含 $$） */
  formula: string;
  params: ParamSpec[];
  series: SeriesSpec[];
  /** 副圖的固定刻度上下限，例如 KD / RSI 的 0~100 */
  range?: { min: number; max: number };
  guides?: GuideSpec[];
  compute(bars: readonly Bar[], params: ParamValues): Record<string, Point[]>;
}

const num = (p: ParamValues, k: string, fallback: number): number => {
  const v = p[k];
  return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || fallback : fallback;
};

const str = (p: ParamValues, k: string, fallback: string): string => {
  const v = p[k];
  return typeof v === 'string' ? v : fallback;
};

const PERIOD = (
  key: string,
  label: string,
  def: number,
  hint?: string,
  max = 120,
): ParamSpec => ({ key, label, kind: 'number', min: 2, max, step: 1, default: def, hint });

// ---------------------------------------------------------------------------

const maSpec: IndicatorSpec = {
  id: 'ma',
  name: '移動平均線',
  short: 'MA',
  category: 'trend',
  placement: 'overlay',
  question: '最近 N 天買進的人，平均成本在哪裡？',
  description:
    '把最近 N 天的收盤價平均起來，一天一個點連成線。它同時是「平均成本線」與「趨勢方向線」—— 股價站上均線，代表這段期間進場的人平均是賺的，賣壓自然輕。',
  formula: 'MA_n = \\frac{1}{n}\\sum_{i=0}^{n-1} Close_{t-i}',
  params: [
    PERIOD('period', '週期', 20, '台股常用 5(週線) 20(月線) 60(季線) 240(年線)', 240),
    {
      key: 'kind',
      label: '平均方式',
      kind: 'choice',
      default: 'sma',
      choices: [
        { value: 'sma', label: 'SMA 簡單' },
        { value: 'ema', label: 'EMA 指數' },
        { value: 'wma', label: 'WMA 加權' },
      ],
      hint: 'EMA 與 WMA 讓近期價格佔更大權重，轉折反應較快，但假訊號也更多',
    },
  ],
  series: [{ key: 'ma', label: 'MA', type: 'line', color: 0, lineWidth: 2 }],
  compute: (bars, p) => ({
    ma: movingAverage(bars, {
      period: num(p, 'period', 20),
      kind: str(p, 'kind', 'sma') as MaKind,
    }),
  }),
};

const biasSpec: IndicatorSpec = {
  id: 'bias',
  name: '乖離率',
  short: 'BIAS',
  category: 'trend',
  placement: 'pane',
  question: '現在漲多了嗎？離平均成本拉開多遠？',
  description:
    '收盤價偏離均線的百分比。價格終究會回到均線附近，所以乖離拉得太大就有「均值回歸」的壓力。多大算大沒有標準答案，要看個股自己的歷史區間。',
  formula: 'BIAS = \\frac{Close - MA_n}{MA_n} \\times 100\\%',
  params: [PERIOD('period', '均線週期', 20)],
  series: [{ key: 'bias', label: 'BIAS%', type: 'line', color: 2, lineWidth: 2 }],
  guides: [{ value: 0, label: '0', emphasis: true }],
  compute: (bars, p) => ({ bias: bias(bars, { period: num(p, 'period', 20) }) }),
};

const macdSpec: IndicatorSpec = {
  id: 'macd',
  name: 'MACD 指數平滑異同平均',
  short: 'MACD',
  category: 'momentum',
  placement: 'pane',
  question: '短期動能正在增強還是減弱？',
  description:
    '快慢兩條 EMA 的差（DIF）反映短期相對長期的強弱；DIF 再取一次均線得到訊號線 DEA。柱狀圖是兩者的差，代表「動能的加速度」—— 柱子由長轉短，往往比黃金交叉更早示警。',
  formula:
    '\\begin{aligned} DIF &= EMA_{fast} - EMA_{slow} \\\\ DEA &= EMA_{signal}(DIF) \\\\ OSC &= DIF - DEA \\end{aligned}',
  params: [
    PERIOD('fast', '快線', 12, undefined, 60),
    PERIOD('slow', '慢線', 26, undefined, 120),
    PERIOD('signal', '訊號線', 9, undefined, 60),
  ],
  series: [
    { key: 'hist', label: 'OSC 柱', type: 'histogram', color: 'up' },
    { key: 'dif', label: 'DIF', type: 'line', color: 0, lineWidth: 2 },
    { key: 'dea', label: 'DEA', type: 'line', color: 1, lineWidth: 2 },
  ],
  guides: [{ value: 0, label: '零軸', emphasis: true }],
  compute: (bars, p) => {
    const r = macd(bars, {
      fast: num(p, 'fast', 12),
      slow: num(p, 'slow', 26),
      signal: num(p, 'signal', 9),
    });
    return { dif: r.dif, dea: r.dea, hist: r.hist };
  },
};

const kdSpec: IndicatorSpec = {
  id: 'kd',
  name: 'KD 隨機指標',
  short: 'KD',
  category: 'momentum',
  placement: 'pane',
  question: '今天的收盤，站在最近這段區間的什麼位置？',
  description:
    '先算出收盤價在近 N 日高低區間中的百分位（RSV），再平滑兩次得到 K 與 D。收在區間頂端 → 值高；收在底部 → 值低。台股慣用 9,3,3，K、D 的初始值固定為 50。',
  formula:
    '\\begin{aligned} RSV &= \\frac{C - L_n}{H_n - L_n} \\times 100 \\\\ K &= \\tfrac{2}{3}K_{-1} + \\tfrac{1}{3}RSV \\\\ D &= \\tfrac{2}{3}D_{-1} + \\tfrac{1}{3}K \\end{aligned}',
  params: [
    PERIOD('rsvPeriod', 'RSV 期間', 9, '台股慣例 9 天', 60),
    PERIOD('kSmooth', 'K 平滑', 3, undefined, 20),
    PERIOD('dSmooth', 'D 平滑', 3, undefined, 20),
  ],
  series: [
    { key: 'k', label: 'K', type: 'line', color: 0, lineWidth: 2 },
    { key: 'd', label: 'D', type: 'line', color: 1, lineWidth: 2 },
  ],
  range: { min: 0, max: 100 },
  guides: [
    { value: 80, label: '80 超買' },
    { value: 50, label: '50' },
    { value: 20, label: '20 超賣' },
  ],
  compute: (bars, p) => {
    const r = kd(bars, {
      rsvPeriod: num(p, 'rsvPeriod', 9),
      kSmooth: num(p, 'kSmooth', 3),
      dSmooth: num(p, 'dSmooth', 3),
    });
    return { k: r.k, d: r.d };
  },
};

const rsiSpec: IndicatorSpec = {
  id: 'rsi',
  name: 'RSI 相對強弱指標',
  short: 'RSI',
  category: 'momentum',
  placement: 'pane',
  question: '這段期間，多方的力氣佔了幾成？',
  description:
    '把期間內的上漲幅度與下跌幅度各自平均，看漲的那份佔總數的百分比。50 是多空均衡點 —— 比起盯著 70/30，「RSI 長期站穩 50 以上」更能說明趨勢還在。',
  formula: 'RSI = \\frac{\\overline{Gain}}{\\overline{Gain} + \\overline{Loss}} \\times 100',
  params: [PERIOD('period', '週期', 14, 'Wilder 原始建議 14；台股也常用 6 與 12', 60)],
  series: [{ key: 'rsi', label: 'RSI', type: 'line', color: 2, lineWidth: 2 }],
  range: { min: 0, max: 100 },
  guides: [
    { value: 70, label: '70 超買' },
    { value: 50, label: '50 多空分界', emphasis: true },
    { value: 30, label: '30 超賣' },
  ],
  compute: (bars, p) => ({ rsi: rsi(bars, { period: num(p, 'period', 14) }) }),
};

const bollingerSpec: IndicatorSpec = {
  id: 'bollinger',
  name: '布林通道',
  short: 'BB',
  category: 'volatility',
  placement: 'overlay',
  question: '目前的價格，以最近的波動水準來看算不算極端？',
  description:
    '以均線為中軸，上下各推 k 倍標準差。因為標準差會隨波動放大縮小，通道寬度本身就是資訊：擠成一條窄帶（收縮）常是變盤前兆，噴開（擴張）則代表趨勢正在發動。',
  formula: '\\text{Upper／Lower} = MA_n \\pm k\\sigma_n',
  params: [
    PERIOD('period', '週期', 20, undefined, 120),
    {
      key: 'multiplier',
      label: '標準差倍數',
      kind: 'number',
      min: 0.5,
      max: 4,
      step: 0.1,
      default: 2,
      hint: '2 倍在常態分布下涵蓋約 95%，但股價分布的尾部比常態厚得多',
    },
  ],
  series: [
    { key: 'upper', label: '上軌', type: 'line', color: 3, lineWidth: 1 },
    { key: 'middle', label: '中軌', type: 'line', color: 0, lineWidth: 2, dashed: true },
    { key: 'lower', label: '下軌', type: 'line', color: 3, lineWidth: 1 },
  ],
  compute: (bars, p) => {
    const r = bollinger(bars, {
      period: num(p, 'period', 20),
      multiplier: num(p, 'multiplier', 2),
    });
    return { upper: r.upper, middle: r.middle, lower: r.lower };
  },
};

const atrSpec: IndicatorSpec = {
  id: 'atr',
  name: 'ATR 平均真實區間',
  short: 'ATR',
  category: 'volatility',
  placement: 'pane',
  question: '這檔股票平常一天會走多少？',
  description:
    '把跳空也算進去的平均單日波動幅度。它不指方向，只量大小 —— 用途是把停損設在「正常波動之外」，避免被日常震盪掃出場，同時反推該買多少張。',
  formula:
    'TR = \\max(H-L,\\ |H-C_{-1}|,\\ |L-C_{-1}|),\\quad ATR_n = \\text{Wilder}_n(TR)',
  params: [PERIOD('period', '週期', 14, undefined, 60)],
  series: [{ key: 'atrPercent', label: 'ATR%', type: 'line', color: 4, lineWidth: 2 }],
  compute: (bars, p) => ({ atrPercent: atrPercent(bars, { period: num(p, 'period', 14) }) }),
};

const dmiSpec: IndicatorSpec = {
  id: 'dmi',
  name: 'DMI／ADX 趨向指標',
  short: 'DMI',
  category: 'trend',
  placement: 'pane',
  question: '現在到底有沒有趨勢？如果有，是哪一邊？',
  description:
    '+DI 與 −DI 比誰高，回答「方向」；ADX 高不高，回答「這個方向堅不堅定」（ADX 本身不分多空）。ADX 低於 20 大致等於盤整，此時所有順勢訊號都該打折 —— 這是把它當濾網而非進場訊號的理由。',
  formula:
    'DX = \\frac{|+DI - (-DI)|}{+DI + (-DI)} \\times 100,\\quad ADX = \\text{Wilder}_n(DX)',
  params: [PERIOD('period', '週期', 14, undefined, 60)],
  series: [
    { key: 'plusDi', label: '+DI', type: 'line', color: 'up', lineWidth: 2 },
    { key: 'minusDi', label: '−DI', type: 'line', color: 'down', lineWidth: 2 },
    { key: 'adx', label: 'ADX', type: 'line', color: 2, lineWidth: 3 },
  ],
  range: { min: 0, max: 100 },
  guides: [
    { value: 40, label: '40 強趨勢' },
    { value: 20, label: '20 盤整分界', emphasis: true },
  ],
  compute: (bars, p) => {
    const r = dmi(bars, { period: num(p, 'period', 14) });
    return { plusDi: r.plusDi, minusDi: r.minusDi, adx: r.adx };
  },
};

const obvSpec: IndicatorSpec = {
  id: 'obv',
  name: 'OBV 能量潮',
  short: 'OBV',
  category: 'volume',
  placement: 'pane',
  question: '成交量正在往買方累積，還是往賣方累積？',
  description:
    '收紅就把當日整根量加進去，收黑就減掉。它的絕對數字沒有意義（起點是任意的 0），有意義的只有走勢方向，以及它跟股價之間的背離 —— 價創新高但 OBV 沒有，代表這波上漲沒有量在撐。',
  formula: 'OBV_t = OBV_{t-1} + \\begin{cases} V_t & C_t > C_{t-1} \\\\ -V_t & C_t < C_{t-1} \\\\ 0 & \\text{otherwise} \\end{cases}',
  params: [],
  series: [{ key: 'obv', label: 'OBV', type: 'line', color: 3, lineWidth: 2 }],
  compute: (bars) => ({ obv: obv(bars) }),
};

const volumeRatioSpec: IndicatorSpec = {
  id: 'volumeRatio',
  name: '量比',
  short: 'VR',
  category: 'volume',
  placement: 'pane',
  question: '今天這個量，跟平常比算大還是小？',
  description:
    '今日成交量除以近 N 日均量。1.0 就是跟平常一樣，3.0 以上是爆量，0.5 以下是窒息量。用比值而不是絕對張數，才能跨個股比較 —— 台積電的三萬張跟小型股的三萬張完全是兩回事。',
  formula: 'VR = \\frac{V_t}{\\overline{V_n}}',
  params: [PERIOD('period', '均量期間', 5, undefined, 60)],
  series: [{ key: 'volumeRatio', label: '量比', type: 'histogram', color: 3 }],
  guides: [
    { value: 3, label: '3 爆量' },
    { value: 1, label: '1 平均量', emphasis: true },
  ],
  compute: (bars, p) => ({ volumeRatio: volumeRatio(bars, { period: num(p, 'period', 5) }) }),
};

const vwapSpec: IndicatorSpec = {
  id: 'vwap',
  name: 'VWAP 成交量加權均價',
  short: 'VWAP',
  category: 'volume',
  placement: 'overlay',
  question: '這段期間，所有人的平均成本大約在哪？',
  description:
    '以成交量加權的平均價，代表「這段期間市場的整體成本」，是常見的套牢區參考。注意這是自序列起點累積的版本，跟當沖用的「當日 VWAP」（每天開盤歸零）不是同一個東西。',
  formula: 'VWAP = \\frac{\\sum (TP_i \\times V_i)}{\\sum V_i},\\quad TP = \\frac{H+L+C}{3}',
  params: [],
  series: [{ key: 'vwap', label: 'VWAP', type: 'line', color: 4, lineWidth: 2, dashed: true }],
  compute: (bars) => ({ vwap: vwap(bars) }),
};

export const INDICATORS: IndicatorSpec[] = [
  maSpec,
  bollingerSpec,
  vwapSpec,
  macdSpec,
  kdSpec,
  rsiSpec,
  biasSpec,
  atrSpec,
  dmiSpec,
  obvSpec,
  volumeRatioSpec,
];

export const INDICATOR_BY_ID: Record<string, IndicatorSpec> = Object.fromEntries(
  INDICATORS.map((i) => [i.id, i]),
);

export const CATEGORY_LABELS: Record<IndicatorSpec['category'], string> = {
  trend: '趨勢',
  momentum: '動能',
  volatility: '波動',
  volume: '量能',
};

/** 取出某個指標的預設參數 */
export function defaultParams(spec: IndicatorSpec): ParamValues {
  return Object.fromEntries(spec.params.map((p) => [p.key, p.default]));
}
