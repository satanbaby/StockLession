import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 課程內容集合。
 *
 * frontmatter 走 zod 驗證，寫錯欄位會在 astro check / build 直接擋下來 ——
 * 二十幾課手寫下來，靠 schema 比靠自律可靠。
 */
const lessons = defineCollection({
  loader: glob({ base: './src/content/lessons', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    /** 四個階段，決定課程在側欄的分組與代言的熊 */
    stage: z.enum(['foundations', 'patterns', 'indicators', 'advanced']),
    /** 階段內排序 */
    order: z.number().int().positive(),
    /** 列表頁與課程卡片上的一句話摘要 */
    summary: z.string().min(10),
    /** 1~5 顆星 */
    difficulty: z.number().int().min(1).max(5),
    /** 預估閱讀分鐘數 */
    minutes: z.number().int().positive(),
    /** 這一課學完之後，學員應該能做到什麼 */
    objectives: z.array(z.string()).min(1),
    /** 建議先讀的課程 id（例如 '1-foundations/02-read-candles'） */
    prerequisites: z.array(z.string()).default([]),
    /** 這一課出現的名詞，供名詞索引反查 */
    keywords: z.array(z.string()).default([]),
    /** 草稿不會出現在列表與導覽，但仍可直接用網址開啟 */
    draft: z.boolean().default(false),
  }),
});

export const collections = { lessons };
