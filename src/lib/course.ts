/**
 * 課程結構。
 *
 * 首頁地圖、側欄、上下課導覽、進度條全部讀這一份，
 * 只要 MDX 檔的 frontmatter 寫對，各處自動同步。
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import type { BearId } from '@/components/bears/parts/geometry';

export type Lesson = CollectionEntry<'lessons'>;
export type StageId = Lesson['data']['stage'];

export interface Stage {
  id: StageId;
  /** 「第一階」 */
  ordinal: string;
  title: string;
  /** 這一階要解決的問題 */
  pitch: string;
  /** 代言的熊 */
  bear: BearId;
  accent: string;
}

export const STAGES: Stage[] = [
  {
    id: 'market',
    ordinal: '第一階',
    title: '市場篇',
    pitch: '先理解價格怎麼形成、誰在交易，以及成交量背後真正發生了什麼。',
    bear: 'jun',
    accent: 'var(--c-brown)',
  },
  {
    id: 'foundations',
    ordinal: '第二階',
    title: '讀圖篇',
    pitch: '學會讀 K 線、成交量、趨勢與支撐壓力，但不把任何訊號當成預言。',
    bear: 'duo',
    accent: 'var(--c-accent)',
  },
  {
    id: 'patterns',
    ordinal: '第三階',
    title: '型態篇',
    pitch: '把單根 K 線串成市場故事，理解反轉、整理，以及型態何時會失效。',
    bear: 'kong',
    accent: 'var(--c-brand)',
  },
  {
    id: 'indicators',
    ordinal: '第四階',
    title: '指標篇',
    pitch: '均線、MACD、KD、RSI、布林。不背買賣口訣，理解每個數字在量什麼。',
    bear: 'jun',
    accent: 'var(--c-brown)',
  },
  {
    id: 'fundamentals',
    ordinal: '第五階',
    title: '環境篇',
    pitch: '把公司、產業、大盤與籌碼放回分析中，知道技術面回答不了哪些問題。',
    bear: 'kong',
    accent: 'var(--c-brand)',
  },
  {
    id: 'advanced',
    ordinal: '第六階',
    title: '決策篇',
    pitch: '把工具組成可重複的方法：多重時間框架、風險控制、交易計畫與檢討。',
    bear: 'duo',
    accent: 'var(--c-accent)',
  },
];

export const STAGE_BY_ID: Record<StageId, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, Stage>;

/** 依階段與 order 排好的全部課程（不含草稿） */
export async function allLessons(): Promise<Lesson[]> {
  const stageRank = new Map(STAGES.map((s, i) => [s.id, i]));
  const entries = await getCollection('lessons', ({ data }) => !data.draft);
  return entries.sort((a, b) => {
    const sa = stageRank.get(a.data.stage) ?? 99;
    const sb = stageRank.get(b.data.stage) ?? 99;
    return sa === sb ? a.data.order - b.data.order : sa - sb;
  });
}

export interface StageGroup {
  stage: Stage;
  lessons: Lesson[];
}

/** 依階段分組，空的階段也會保留（首頁地圖要顯示「敬請期待」） */
export async function lessonsByStage(): Promise<StageGroup[]> {
  const lessons = await allLessons();
  return STAGES.map((stage) => ({
    stage,
    lessons: lessons.filter((l) => l.data.stage === stage.id),
  }));
}

export interface Neighbours {
  prev: Lesson | null;
  next: Lesson | null;
  /** 從 1 起算 */
  index: number;
  total: number;
}

/** 全課程扁平順序中的前後鄰居，供課末的「下一課」使用 */
export async function neighbours(id: string): Promise<Neighbours> {
  const lessons = await allLessons();
  const i = lessons.findIndex((l) => l.id === id);
  return {
    prev: i > 0 ? (lessons[i - 1] ?? null) : null,
    next: i >= 0 && i < lessons.length - 1 ? (lessons[i + 1] ?? null) : null,
    index: i + 1,
    total: lessons.length,
  };
}

const BASE_URL = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export const lessonHref = (id: string): string => `${BASE_URL}lessons/${id}/`;

/** 難度星星 */
export const difficultyStars = (n: number): string => '●'.repeat(n) + '○'.repeat(5 - n);
