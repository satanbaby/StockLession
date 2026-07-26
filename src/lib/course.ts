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
    id: 'foundations',
    ordinal: '第一階',
    title: '基礎篇',
    pitch: '先學會讀圖。K 線在說什麼、量在說什麼、支撐壓力怎麼看出來。',
    bear: 'duo',
    accent: 'var(--c-accent)',
  },
  {
    id: 'patterns',
    ordinal: '第二階',
    title: '型態篇',
    pitch: '把單根 K 線串成故事。反轉與整理的形狀，還有它們什麼時候會騙人。',
    bear: 'kong',
    accent: 'var(--c-brand)',
  },
  {
    id: 'indicators',
    ordinal: '第三階',
    title: '指標篇',
    pitch: '均線、MACD、KD、RSI、布林。不背公式，理解每個數字在算什麼。',
    bear: 'jun',
    accent: 'var(--c-brown)',
  },
  {
    id: 'advanced',
    ordinal: '第四階',
    title: '進階篇',
    pitch: '把工具組起來變成方法：多重時間框架、訊號濾網、風險控制。',
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
