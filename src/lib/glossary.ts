/**
 * 名詞索引。
 *
 * 指標類的詞條直接讀 lib/indicators 的登錄表，不重複維護；
 * 這裡只手寫「不是指標」的那些詞——它們往往才是新手真正卡住的地方
 * （「鈍化」「背離」「填息」在多數教材裡都是一句帶過）。
 */

import { INDICATORS, CATEGORY_LABELS, type IndicatorSpec } from './indicators';

export type TermGroup = '看圖基礎' | '型態與結構' | '指標' | '台股制度' | '交易與風險';

export interface Term {
  term: string;
  /** 英文或常見別名 */
  alias?: string;
  group: TermGroup;
  /** 一句話定義 */
  brief: string;
  /** 補充：常見誤解、實務上的注意事項 */
  note?: string;
  /** 對應課程的 id */
  lesson?: string;
}

const MANUAL: Term[] = [
  {
    term: 'K 線',
    alias: 'Candlestick',
    group: '看圖基礎',
    brief: '把一段時間的開盤、最高、最低、收盤四個價格畫成一根棒子。',
    note: '日線一根＝一天。四個價格裡收盤價份量最重，多數指標只吃收盤價。',
    lesson: '1-foundations/02-read-candles',
  },
  {
    term: '影線',
    group: '看圖基礎',
    brief: '實體上下方的細線，代表盤中到過但沒守住的價格。',
    note: '長上影＝拉上去被打回來，長下影＝殺下去被接回來。影線是「被否定的價格」。',
    lesson: '1-foundations/02-read-candles',
  },
  {
    term: '實體',
    group: '看圖基礎',
    brief: '開盤價與收盤價之間的方塊，代表當日多空拉鋸的淨結果。',
    lesson: '1-foundations/02-read-candles',
  },
  {
    term: '陽線／陰線',
    alias: '紅K／黑K',
    group: '看圖基礎',
    brief: '收盤高於開盤是陽線（台股畫紅色），低於開盤是陰線（台股畫綠色）。',
    note: '歐美配色相反：綠漲紅跌。台股口語的「黑 K」指的是綠色的下跌 K 棒，源自報紙黑白印刷時代。',
    lesson: '1-foundations/02-read-candles',
  },
  {
    term: '一字線',
    group: '看圖基礎',
    brief: '開高低收四價相同，畫出來是一條橫線。',
    note: '台股獨有的景象，因為有 10% 漲跌幅限制，開盤即鎖死漲停或跌停時就會長這樣。',
    lesson: '1-foundations/02-read-candles',
  },
  {
    term: '跳空缺口',
    alias: 'Gap',
    group: '看圖基礎',
    brief: '今天的開盤價與昨天的收盤價之間出現沒有成交的空白區間。',
    note: '台股日線上最常見的缺口其實不是行情造成的，而是除權息——因為交易所提供的歷史價格未還原權值。',
  },
  {
    term: '頸線',
    alias: 'Neckline',
    group: '型態與結構',
    brief: '頭肩型態中，兩次回檔低點（或反彈高點）連成的線。',
    note: '型態的完成條件是「跌破／突破頸線」，不是形狀畫完。在那之前都只是「長得像」。',
    lesson: '2-patterns/03-reversal-patterns',
  },
  {
    term: '頭肩頂／頭肩底',
    group: '型態與結構',
    brief: '三個高點（或低點）中間高、兩側低的反轉型態。',
    note: '判斷可信度要看量能：頭部量縮、跌破放量。形狀可以是巧合，量能特徵不容易是巧合。',
    lesson: '2-patterns/03-reversal-patterns',
  },
  {
    term: '假突破',
    alias: '假跌破',
    group: '型態與結構',
    brief: '價格突破關鍵位置後迅速拉回，原本的訊號失效。',
    note: '低量的突破特別容易是假的。要求「帶量」與「站穩數日」能過濾不少，代價是進場價變差。',
    lesson: '2-patterns/03-reversal-patterns',
  },
  {
    term: '背離',
    alias: 'Divergence',
    group: '型態與結構',
    brief: '價格創新高（低）但指標沒有跟著創新高（低）。',
    note: '背離代表動能衰退，但不代表會立刻反轉——強趨勢中背離可以持續很久。它是警訊，不是進場訊號。',
  },
  {
    term: '鈍化',
    group: '指標',
    brief: '振盪指標（KD、RSI）長時間卡在超買或超賣區不動。',
    note: '這是趨勢行情的正常現象，不是指標故障。此時「超買賣出」會讓你在主升段下車。',
    lesson: '3-indicators/05-kd',
  },
  {
    term: '多頭排列／空頭排列',
    group: '指標',
    brief: '短、中、長期均線由上而下依序排列（多頭），或相反（空頭）。',
    note: '代表各時間尺度的持有者都處在獲利（或套牢）狀態，是趨勢結構是否健康的快速判斷。',
    lesson: '3-indicators/02-moving-average',
  },
  {
    term: '黃金交叉／死亡交叉',
    group: '指標',
    brief: '短期均線向上（向下）穿越長期均線的那個瞬間。',
    note: '流傳最廣也最被高估的訊號。台積電四年半的實測是三勝三敗、累積報酬略輸買進持有。',
    lesson: '3-indicators/02-moving-average',
  },
  {
    term: '暖機期',
    group: '指標',
    brief: '指標在資料量不足以計算時的那段起始期間。',
    note: 'MA20 在第 20 根之前沒有值。此時若填 0 或首根收盤價，圖上會多出一段虛構的線——本站一律留白。',
  },
  {
    term: '漲跌幅限制',
    alias: '漲停／跌停',
    group: '台股制度',
    brief: '台股單日漲跌以前一日收盤價的 ±10% 為限。',
    note: '這個制度讓台股會出現一字線，也讓恐慌與追價的能量被延後到隔天釋放，跟無漲跌停的美股行為明顯不同。',
  },
  {
    term: '除權息',
    group: '台股制度',
    brief: '配發股利時，從股價中扣掉對應金額。',
    note: '交易所的歷史日線是未還原權值，所以除息當天會出現一個「看起來像崩盤、其實不是」的向下跳空。看到日線上突兀的大缺口，先查是不是除權息。',
  },
  {
    term: '填息／貼息',
    group: '台股制度',
    brief: '除息後股價漲回原本價位叫填息，繼續下跌叫貼息。',
    note: '沒填息的話，領到的股利只是把左口袋的錢換到右口袋。',
  },
  {
    term: '張',
    group: '台股制度',
    brief: '台股的交易單位，1 張 ＝ 1000 股。',
    note: '本站圖表的成交量一律以張為單位。',
  },
  {
    term: '停損',
    alias: 'Stop loss',
    group: '交易與風險',
    brief: '事先設定的認賠出場價位。',
    note: '停損距離該由波動決定（例如用 ATR 的倍數），而不是由「我最多能接受賠多少」決定——後者只會讓你被日常震盪掃出場。',
  },
  {
    term: '盈虧比',
    alias: 'Risk/Reward',
    group: '交易與風險',
    brief: '一筆交易預期獲利與預期虧損的比值。',
    note: '勝率與盈虧比要一起看。勝率 30% 但盈虧比 5:1 的策略，長期期望值遠勝勝率 70% 但盈虧比 1:3 的策略。',
  },
  {
    term: '過度最佳化',
    alias: 'Overfitting',
    group: '交易與風險',
    brief: '把參數調到在歷史資料上表現極好，但那些參數只是在配合雜訊。',
    note: '判斷方法之一：微調參數如果績效就崩盤，那個參數八成是湊出來的。真正穩健的設定周邊應該是一片平緩的高原，不是一根針。',
  },
];

/** 指標自動生成的詞條 */
function fromIndicators(): Term[] {
  const lessonOf: Record<string, string> = {
    ma: '3-indicators/02-moving-average',
    kd: '3-indicators/05-kd',
  };

  return INDICATORS.map((spec: IndicatorSpec) => ({
    term: spec.name,
    alias: spec.short,
    group: '指標' as const,
    brief: spec.question,
    note: `${CATEGORY_LABELS[spec.category]}類。${spec.description}`,
    lesson: lessonOf[spec.id],
  }));
}

export const GROUP_ORDER: TermGroup[] = [
  '看圖基礎',
  '型態與結構',
  '指標',
  '台股制度',
  '交易與風險',
];

export function allTerms(): Term[] {
  return [...MANUAL, ...fromIndicators()].sort((a, b) => a.term.localeCompare(b.term, 'zh-Hant'));
}

export function termsByGroup(): { group: TermGroup; terms: Term[] }[] {
  const all = allTerms();
  return GROUP_ORDER.map((group) => ({ group, terms: all.filter((t) => t.group === group) }));
}
