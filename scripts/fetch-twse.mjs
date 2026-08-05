/**
 * 從證交所 (TWSE) 抓取日線資料，產出網站使用的靜態 JSON。
 *
 * 這支腳本是「一次性」的：抓完之後 src/data/ohlcv/*.json 就入庫，
 * 網站 runtime 完全不連網 —— 離線可用，而且每位學員看到的圖表完全一致。
 *
 *   node scripts/fetch-twse.mjs
 *
 * 兩個實測可用的端點（單次回傳一整個月）：
 *   個股  https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=YYYYMM01&stockNo=2330&response=json
 *   大盤  https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date=YYYYMM01&response=json
 *
 * TWSE 限流很嚴格，所以每次請求間隔 REQUEST_DELAY_MS，並把每個月的原始回應
 * 快取在 .cache/twse/ 之下。中途失敗直接重跑即可，已抓到的月份會跳過。
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache', 'twse');
const OUT_DIR = join(ROOT, 'src', 'data', 'ohlcv');

const START = { year: 2022, month: 1 };
// END 永遠是「現在」，這樣排程重跑時才會持續往前抓，不用手動再改一次日期。
// 查到「大於今日」時 fetchMonth 會自然中止，所以抓多幾個月份也不會出錯。
const now = new Date();
const END = { year: now.getFullYear(), month: now.getMonth() + 1 };

/** TWSE 大約每 5 秒容許 3 次請求，抓保守一點免得被擋。 */
const REQUEST_DELAY_MS = 3500;
const MAX_RETRIES = 4;

/** @type {{ id: string, name: string, kind: 'stock' | 'index', note: string }[]} */
const TARGETS = [
  { id: '2330', name: '台積電', kind: 'stock', note: '權值王，趨勢乾淨，適合講均線與趨勢' },
  { id: 'taiex', name: '加權指數', kind: 'index', note: '大盤，適合講多重時間框架與指數對照' },
  { id: '2603', name: '長榮', kind: 'stock', note: '波動劇烈，適合講爆量、缺口、鈍化與失效案例' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 產生 START..END 之間的每個月，格式 { year, month, key: '202401' } */
function monthRange() {
  const out = [];
  let y = START.year;
  let m = START.month;
  while (y < END.year || (y === END.year && m <= END.month)) {
    out.push({ year: y, month: m, key: `${y}${String(m).padStart(2, '0')}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function urlFor(target, monthKey) {
  const date = `${monthKey}01`;
  return target.kind === 'index'
    ? `https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST?date=${date}&response=json`
    : `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${date}&stockNo=${target.id}&response=json`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 抓一個月，優先讀快取。回傳 TWSE 的原始 JSON 物件。 */
async function fetchMonth(target, monthKey) {
  const cachePath = join(CACHE_DIR, `${target.id}-${monthKey}.json`);
  if (await exists(cachePath)) {
    return { data: JSON.parse(await readFile(cachePath, 'utf8')), cached: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(urlFor(target, monthKey), {
        headers: {
          // 不帶 UA 有時候會被擋掉
          'User-Agent': 'Mozilla/5.0 (compatible; stock-ta-school/0.1; educational use)',
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // stat 不是 OK 通常是「查詢日期大於今日」或被限流。
      // 前者是正常結束條件，後者要重試 —— 用訊息內容區分。
      if (json.stat !== 'OK') {
        if (/沒有|無資料|大於/.test(json.stat ?? '')) {
          return { data: null, cached: false, reason: json.stat };
        }
        throw new Error(`stat=${json.stat}`);
      }

      await writeFile(cachePath, JSON.stringify(json), 'utf8');
      return { data: json, cached: false };
    } catch (err) {
      lastError = err;
      const backoff = REQUEST_DELAY_MS * attempt * 2;
      process.stdout.write(`  ! ${monthKey} 第 ${attempt} 次失敗 (${err.message})，${backoff}ms 後重試\n`);
      await sleep(backoff);
    }
  }
  throw new Error(`${target.id} ${monthKey} 重試 ${MAX_RETRIES} 次仍失敗: ${lastError?.message}`);
}

/** '1,234.56' -> 1234.56；'--' 或空字串 -> null */
function num(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '' || cleaned === '--' || cleaned === '---') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** '113/01/02' -> '2024-01-02'（民國年 + 1911） */
function rocDateToISO(raw) {
  const m = /^(\d{2,3})\/(\d{2})\/(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  return `${Number(m[1]) + 1911}-${m[2]}-${m[3]}`;
}

/**
 * 個股欄位：日期 成交股數 成交金額 開盤價 最高價 最低價 收盤價 漲跌價差 成交筆數 註記
 * 指數欄位：日期 開盤指數 最高指數 最低指數 收盤指數（無量）
 */
function parseRows(rows, kind) {
  const bars = [];
  for (const row of rows ?? []) {
    const time = rocDateToISO(row[0] ?? '');
    if (!time) continue;

    const open = num(row[kind === 'index' ? 1 : 3]);
    const high = num(row[kind === 'index' ? 2 : 4]);
    const low = num(row[kind === 'index' ? 3 : 5]);
    const close = num(row[kind === 'index' ? 4 : 6]);

    // 全日無成交（欄位為 '--'）的交易日直接跳過，留著會在圖上畫出假的平盤棒。
    if (open === null || high === null || low === null || close === null) continue;

    // 成交股數 -> 張（台股慣用單位，1 張 = 1000 股）。指數無量，記 0。
    const shares = kind === 'index' ? null : num(row[1]);
    const volume = shares === null ? 0 : Math.round(shares / 1000);

    bars.push({ time, open, high, low, close, volume });
  }
  return bars;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const months = monthRange();
  const today = new Date().toISOString().slice(0, 10);
  let requestCount = 0;

  for (const target of TARGETS) {
    console.log(`\n=== ${target.id} ${target.name} (${months.length} 個月) ===`);
    /** @type {any[]} */
    const bars = [];

    for (const { key } of months) {
      const { data, cached, reason } = await fetchMonth(target, key);

      if (!data) {
        console.log(`  - ${key} 無資料（${reason}），視為已抓到最新月份，停止`);
        break;
      }

      const monthBars = parseRows(data.data, target.kind);
      bars.push(...monthBars);
      console.log(`  ${cached ? '·' : '↓'} ${key}  ${String(monthBars.length).padStart(2)} 根`);

      // 只有真的打了網路才需要等，讀快取不用。
      if (!cached) {
        requestCount += 1;
        await sleep(REQUEST_DELAY_MS);
      }
    }

    // 保險：TWSE 偶爾會在跨月回應裡重複同一天，去重後依日期排序。
    const byTime = new Map(bars.map((b) => [b.time, b]));
    const sorted = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));

    const payload = {
      symbol: target.id,
      name: target.name,
      market: 'TWSE',
      interval: '1d',
      // 重要：STOCK_DAY 是「未還原權值」價格，除權息當日線圖會有跳空缺口。
      // 這不是 bug，是台股實務，課程裡會直接拿來當教材。
      priceAdjusted: false,
      volumeUnit: target.kind === 'index' ? 'none' : '張',
      note: target.note,
      source: target.kind === 'index' ? 'TWSE MI_5MINS_HIST' : 'TWSE STOCK_DAY',
      fetchedAt: today,
      range: sorted.length ? { from: sorted[0].time, to: sorted[sorted.length - 1].time } : null,
      count: sorted.length,
      bars: sorted,
    };

    const outPath = join(OUT_DIR, `${target.id}.json`);
    await writeFile(outPath, JSON.stringify(payload), 'utf8');
    console.log(`  → ${outPath}  共 ${sorted.length} 根 (${payload.range?.from} ~ ${payload.range?.to})`);
  }

  console.log(`\n完成。實際網路請求 ${requestCount} 次，其餘讀自 .cache/twse/。`);
}

main().catch((err) => {
  console.error('\n抓取失敗:', err.message);
  console.error('已抓到的月份都在 .cache/twse/，直接重跑會從中斷處續抓。');
  process.exit(1);
});
