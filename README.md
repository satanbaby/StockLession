# 熊熊小教室

一個從零開始學習台股技術分析的互動教學網站。

這裡不只解釋指標定義，也讓讀者直接操作真實台股線圖、調整參數，並同時觀察訊號成功與失效的案例。

<p align="center">
  <a href="https://satanbaby.github.io/StockLession/"><strong>前往 GitHub Pages 線上體驗</strong></a>
</p>

<p align="center">
  <a href="https://github.com/satanbaby/StockLession/actions/workflows/deploy.yml">
    <img src="https://github.com/satanbaby/StockLession/actions/workflows/deploy.yml/badge.svg" alt="GitHub Pages 部署狀態" />
  </a>
</p>

## 首頁 Demo

<p align="center">
  <a href="https://satanbaby.github.io/StockLession/">
    <img src="./public/images/readme/home-demo.png" alt="熊熊小教室首頁 Demo，三隻熊圍桌討論台股 K 線" width="1100" />
  </a>
</p>

## 網站特色

- 使用證交所真實日線資料，課文中的案例與數字可以回頭驗證。
- 每個概念都搭配可互動的線圖，能直接調整指標週期與參數。
- 同時呈現有效案例與失效案例，不把技術指標包裝成必勝訊號。
- 納入漲跌停、除權息缺口與當沖等台股特有情境。
- 以三位熊老師的不同立場，帶出進場、風險與計算觀點。
- 支援響應式版面、深色模式與靜態網站部署。

## 技術棧

- Astro 7
- MDX Content Collections
- Tailwind CSS 4
- lightweight-charts 5
- TypeScript
- Vitest
- KaTeX
- 原生 Custom Elements，無 React runtime

## 本機開發

使用 Node.js `24.18.0` 與 pnpm `11.17.0`。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

開發伺服器預設位於：

```text
http://localhost:4321/StockLession/
```

## 常用指令

```bash
pnpm dev           # 啟動 Astro 開發伺服器
pnpm check         # 檢查 TypeScript 與內容 schema
pnpm test          # 執行指標計算單元測試
pnpm build         # 建立靜態網站至 dist/
pnpm fetch:twse    # 重新抓取 TWSE 行情資料
pnpm build:font    # 重新產生粉圓字型子集
pnpm preview:bears # 產生三熊表情接觸表
```

送出變更前請執行：

```bash
pnpm check && pnpm test && pnpm build
```

## 專案結構

```text
scripts/                    一次性資料與資產工具
src/
  components/
    bears/                  熊老師角色元件
    charts/                 lightweight-charts 圖表元件
    learn/                  測驗、公式與教學元件
  content/lessons/          四階段 MDX 課程
  data/
    ohlcv/                  TWSE 真實日線資料
    synthetic/              教學用合成型態資料
  lib/
    chart/                  全站圖表 API 封裝
    indicators/             指標函式、登錄表與測試
  pages/                    Astro 頁面
```

## 教材與計算原則

- 指標暖機期一律回傳 `null`，不使用 `0` 或首值補齊。
- KD 初始 K、D 值採台股慣例的 `50`。
- RSI 使用 Wilder 平滑，EMA 使用前 N 根 SMA 作為種子。
- 真實資料與合成示意資料會清楚區分。
- 圖表採台股慣例：紅漲、綠跌。

## GitHub Pages 部署

推送至 `master` 分支後，GitHub Actions 會依序執行檢查、測試與建置，成功後自動部署至：

<https://satanbaby.github.io/StockLession/>

## 免責聲明

本專案僅供技術分析教育與程式展示，不構成任何投資建議。所有交易工具皆可能失效，使用前請自行評估風險。
