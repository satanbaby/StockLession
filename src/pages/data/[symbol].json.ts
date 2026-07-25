/**
 * 把行情資料以靜態 JSON 端點輸出，給 /lab 這種需要「整段資料 + 前端切換標的」的頁面用。
 *
 * 課文裡的圖不走這裡 —— 那些只需要幾十根，直接在建置期內嵌進 HTML 更快。
 * 這個端點是為了避免 /lab 一次把三檔 1000 多根全部塞進 HTML。
 */

import type { APIRoute, GetStaticPaths } from 'astro';
import { DATASETS, SYMBOL_IDS, type SymbolId } from '@/lib/data';

export const getStaticPaths: GetStaticPaths = () =>
  SYMBOL_IDS.map((symbol) => ({ params: { symbol } }));

export const GET: APIRoute = ({ params }) => {
  const symbol = params.symbol as SymbolId;
  const data = DATASETS[symbol];

  if (!data) return new Response('Not found', { status: 404 });

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
