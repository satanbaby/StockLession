# 熊熊小教室 — 台股技術分析教學網站

由淺入深帶新手理解技術分析。核心價值不是「把指標定義抄一遍」，而是：

1. 每個概念都配一張**可以動手拉參數的真實台股線圖**
2. 每個工具都同時給**成功案例與失效案例**——只教訊號會生出照訊號下單的新手

## 指令

```bash
npm run dev          # http://localhost:4321
npm run build        # 靜態輸出到 dist/
npm run check        # astro check（TS ＋ content schema）
npm test             # vitest，指標計算的單元測試
npm run fetch:twse   # 重新抓 TWSE 行情（一次性，約 10 分鐘）
npm run build:font   # 重新子集化粉圓字型（build 會自動先跑）
npm run preview:bears # 產生三熊接觸表 PNG（需先跑 dev）
```

送出前跑：`npm run check && npm test && npm run build`。

## 技術棧與版本限制

**Node 20.13.1 → Astro 鎖在 `^5.18`。** Astro 6 需要 Node `^20.19.1`、Astro 7 需要 `>=22.12.0`，兩者都不相容。升級 Node 22 LTS 之後才能跟進 Astro 7。

- Astro 5 + MDX + Content Collections
- Tailwind CSS 4（走 `@tailwindcss/vite`，**不是**已棄用的 `@astrojs/tailwind`）
- lightweight-charts **5**（v5 是破壞性改版，網路上多數範例還停在 v4）
- KaTeX 建置期渲染，前端不載入 KaTeX 的 JS
- **不用 React。** 互動元件一律原生 Custom Element。lightweight-charts 本身是命令式 API，包一層框架只是多下載一份 runtime。

## 目錄

```
scripts/         一次性工具：抓資料、切字型、產角色接觸表
src/
  content/lessons/{1-foundations,2-patterns,3-indicators,4-advanced}/*.mdx
  data/ohlcv/    TWSE 真實日線（入庫，別手改）
  data/synthetic/ 教學用合成型態資料
  lib/indicators/ 指標函式庫 ＋ 登錄表 ＋ 測試
  lib/chart/      lightweight-charts 封裝，全站只有這裡碰圖表 API
  lib/course.ts   課程結構，首頁／側欄／導覽都讀它
  components/bears/  《熊熊遇見你》透明 WebP 角色元件
  components/charts/ 圖表元件
  components/learn/  Callout / FormulaBlock / Quiz / KeyTakeaways
```

## 不能違反的約定

### 指標計算

**暖機期一律回傳 `null`，不准填 0 或首值。** MA20 必須從第 20 根才開始畫。教學網站上畫錯線等於教錯。`Point.value: number | null`，繪圖層轉成 whitespace 資料點。

三個已知容易寫錯、且有測試鎖住的地方：

- **KD**：K/D 初始值是 **50**（台股慣例）；`H9 === L9` 時 RSV 沿用前值，給 0 會捏造出不存在的超賣訊號
- **RSI**：Wilder 平滑 α=1/N，**不是** EMA 的 α=2/(N+1)
- **EMA**：種子是前 N 根的 SMA，**不是**第一根收盤價

改指標必先跑 `npm test`。`registry.test.ts` 會拿三檔真實資料把每個登錄的指標掃過參數全範圍。

### 新增指標

只改 `src/lib/indicators/`：

1. 寫純函式（吃 `Bar[]`，吐 `Point[]`）＋ 測試
2. 在 `index.ts` 的 `INDICATORS` 加一筆 `IndicatorSpec`

UI 不用動。`IndicatorLab` 與 `/lab` 的控制項、圖例、公式說明全部由登錄表自動生成。

### 顏色

- **紅漲綠跌**（台股慣例）。紅綠在這個網站上**專屬於漲跌**——UI 元件、品牌色、圖表指標線一律避開紅綠系，否則會稀釋學員的顏色直覺。品牌色是天藍 `#5BA8D4` ＋ 奶油黃 `#F5C86B`。
- 圖表指標線的色碼同時存在兩個地方：`lib/chart/theme.ts`（canvas 用）與 `global.css` 的 `--chart-1..5`（圖例用）。**改色要兩邊一起改。**
- 描邊用深棕 `#3D3230` 不用純黑；陰影用實心位移 `4px 4px 0` 不用模糊——這是卡通風的關鍵。

### 圖表

- 課文裡的圖用 `interaction: 'article'`（預設）：**關掉滾輪縮放與垂直觸控拖曳**，否則讀者捲到圖表就會卡住。只有 `/lab` 用 `'tool'`。
- 窗格高度用 `setStretchFactor` **不要用 `setHeight`**。`setHeight` 會讀「窗格當下已渲染的高度」換算，那個值要等下一次繪製才更新，同一 tick 連續呼叫會讀到過期數值，結果不收斂（實測：成交量窗格被擠成 38px、KD 膨脹到 162px）。
- 卸載時要 `destroy()`。

### 字型

粉圓是**依全站實際用字子集化**的單一檔案（1318 字、240KB），不是 unicode-range 分片。

一開始用 cn-font-split 切成 104 片，實測單一課程頁要抓 50 幾片、約 1.4MB —— 長文的用字會散落在大半分片裡，分片對這種內容根本省不到。改成單一子集後整站共用一個 240KB 檔案，第一次載入後全部命中快取。

代價是**新增課程若用到全新的字，要重跑 `npm run build:font`**。它掛在 `prebuild`，正式建置一定是最新的；`npm run dev` 期間漏掉的字會退回系統字型，不影響閱讀。

### 內容

- **真實資料與合成資料絕不混淆。** 合成的一律加 `synthetic` prop，圖上會出現「示意圖」徽章。
- TWSE 日線是**未還原權值**，除權息當日有跳空缺口。這不是 bug，是教材（見「缺口」與「台股遊戲規則」章節）。
- **課文引用的數字都要能從 `src/data/ohlcv/` 驗證。** 不確定就寫腳本算，不要憑印象。
- 每一課的固定骨架：阿多丟情境 → 直覺圖解 → 公式與白話（阿均）→ 互動實驗 → 有效案例 → **失效案例（小空）** → 常見誤用 → 重點回顧 → 小測驗。
- `Quiz` 的每個選項都要寫 `why`，包含錯的選項。只回一個紅叉是在浪費那次犯錯的價值。

### 三熊

| 角色 | | 負責 |
|---|---|---|
| 阿多 | 棕熊、紅頭巾 | 訊號出現了、型態成形了、可以進場 |
| 小空 | 貓熊、抱枕 | 訊號什麼時候會騙人、停損、風險 |
| 阿均 | 白熊、眼鏡 | 公式、計算、「你們兩個都對，因為……」 |

原創角色，致敬扁平圓潤的卡通畫風，**不使用任何版權角色的造型與名字**。

臉部錨點固定在 `parts/geometry.ts`，三隻共用 `parts/faces.ts` 的八種表情——身體各畫一次、表情只畫一次，3×8 種組合不需要 24 張圖。改造型後跑 `npm run preview:bears` 一次檢視全部組合。

小空的黑眼圈尺寸是被眉毛逼出來的：眉毛落在 y≈31~39，眼圈上緣必須壓在 39 以下，否則深色眉毛畫在深色眼圈上會直接消失。

## MDX 可用元件

不用 import，由 `src/components/mdx.ts` 注入：
`BearTalk` `BearAvatar` `BearScene` `PriceChart` `IndicatorLab` `CandleAnatomy` `ChartFrame` `Callout` `FormulaBlock` `Quiz` `KeyTakeaways`

`Callout` 的 `kind`：`key` 重點／`trap` 常見誤用／`note` 補充／`tw` 台股特有／`try` 動手試試。

`PriceChart` 與 `IndicatorLab` 記得給 `warmup`——想讓 MA60 從畫面第一根就有值，`warmup` 至少要 60，圖表會用 `visibleRange` 把顯示範圍收回你指定的區間。

## 課程進度

- 已完成 4 課（每一課各示範一種元件，剩下的就是純內容產出）
- 規劃約 26 課，四階段結構定義在 `src/lib/course.ts`
- 新增課程只要在 `src/content/lessons/<stage>/` 放 MDX，frontmatter 由 zod 驗證，首頁地圖／側欄／上下課導覽全部自動同步
