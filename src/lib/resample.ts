/**
 * 日線 → 週線／月線。
 *
 * 站上只有一份日線資料（TWSE 只給日線），週線與月線都是從它疊出來的。
 * 這是正確的做法：週 K 本來就是「這一週的第一個開盤、最高、最低、最後一個收盤」，
 * 不是另一組獨立的行情。
 *
 * 兩個容易寫錯的地方：
 *
 * 1. **收盤價不能取平均**。週 K 的收盤是該週最後一個交易日的收盤價，
 *    取平均會把一根長紅抹平成溫吞的小紅，型態全部走樣。
 * 2. **最後一根通常是不完整的**。資料收在 6/30（週二），那一週的週 K 只含兩天。
 *    這不是 bug，看盤軟體上「本週」那一根同樣是進行式 —— 但要知道它會變。
 */

import type { Bar } from './indicators/types';

export type Timeframe = 'day' | 'week' | 'month';

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  day: '日線',
  week: '週線',
  month: '月線',
};

/** 這一天所屬的那一週的星期一（ISO 週，以 UTC 計算避開時區位移） */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  // getUTCDay: 0 = 週日。台股一週從週一開始，所以週日要退回前一個週一。
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

const monthKey = (iso: string): string => iso.slice(0, 7);

/**
 * 把日線併成週線或月線。
 *
 * 併出來的那一根，時間標記用**該區間最後一個交易日** —— 跟台股看盤軟體一致，
 * 而且不完整的最後一根會誠實地顯示成當下日期，不會假裝已經走完一整週。
 */
export function resample(bars: readonly Bar[], timeframe: Timeframe): Bar[] {
  if (timeframe === 'day') return [...bars];

  const keyOf = timeframe === 'week' ? weekKey : monthKey;
  const out: Bar[] = [];
  let key: string | null = null;

  for (const bar of bars) {
    const k = keyOf(bar.time);

    if (k !== key) {
      key = k;
      out.push({ ...bar });
      continue;
    }

    const acc = out[out.length - 1]!;
    acc.high = Math.max(acc.high, bar.high);
    acc.low = Math.min(acc.low, bar.low);
    acc.close = bar.close;
    acc.volume += bar.volume;
    // 時間跟著往後推到這一段目前的最後一天
    acc.time = bar.time;
  }

  return out;
}
