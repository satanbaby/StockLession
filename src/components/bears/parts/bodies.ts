/** Three bear identities and their mood-specific raster assets. */

import { BEAR_MOODS, type BearId, type BearMood } from './geometry';

export interface BearSkin {
  id: BearId;
  name: string;
  role: string;
  duty: string;
  themeColor: string;
  images: Record<BearMood, string>;
}

function moodImages(folder: string): Record<BearMood, string> {
  return Object.fromEntries(
    BEAR_MOODS.map((mood) => [mood, `/images/bears/${folder}/${mood}.webp`]),
  ) as Record<BearMood, string>;
}

const duo: BearSkin = {
  id: 'duo',
  name: '大大',
  role: '熱血行動派',
  duty: '負責鼓舞士氣，把複雜的市場訊號化成簡單行動。',
  themeColor: 'var(--bear-duo-cloth)',
  images: moodImages('grizzly'),
};

const kong: BearSkin = {
  id: 'kong',
  name: '胖達',
  role: '情緒觀察員',
  duty: '提醒你留意追高、恐慌與市場情緒，讓判斷更冷靜。',
  themeColor: 'var(--bear-kong-cloth)',
  images: moodImages('panda'),
};

const jun: BearSkin = {
  id: 'jun',
  name: '阿極',
  role: '冷靜分析派',
  duty: '把數據、風險與交易紀律整理成清楚可執行的步驟。',
  themeColor: 'var(--bear-jun-cloth)',
  images: moodImages('ice-bear'),
};

export const BEARS: Record<BearId, BearSkin> = { duo, kong, jun };
