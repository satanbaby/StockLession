// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
  // `@/*` 別名由 tsconfig.json 的 paths 提供，Astro 原生支援，
  // 不在此處另設 vite alias（Windows 下 URL.pathname 會給出 /D:/... 的壞路徑）。
  vite: {
    plugins: [tailwindcss()],
  },
});
