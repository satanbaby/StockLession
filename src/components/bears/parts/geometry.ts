/** 保留既有角色與 mood 型別，讓課程 MDX 不需要跟著改寫。 */

export type BearId = 'duo' | 'kong' | 'jun';

export type BearMood =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'worried'
  | 'thinking'
  | 'shocked'
  | 'proud'
  | 'sleepy';

export const BEAR_IDS: readonly BearId[] = ['duo', 'kong', 'jun'];

export const BEAR_MOODS: readonly BearMood[] = [
  'neutral',
  'happy',
  'excited',
  'worried',
  'thinking',
  'shocked',
  'proud',
  'sleepy',
];
