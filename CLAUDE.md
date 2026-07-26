# 熊熊小教室 — 台股技術分析教學網站

由淺入深帶新手理解技術分析。核心價值不是「把指標定義抄一遍」，而是：

1. 每個概念都配一張**可以動手拉參數的真實台股線圖**
2. 每個工具都同時給**成功案例與失效案例**——只教訊號會生出照訊號下單的新手

## 指令

```bash
pnpm dev          # http://localhost:4321
pnpm build        # 靜態輸出到 dist/
pnpm check        # astro check（TS ＋ content schema）
pnpm test         # vitest，指標計算的單元測試
pnpm fetch:twse   # 重新抓 TWSE 行情（一次性，約 10 分鐘）
pnpm build:font   # 重新子集化粉圓字型（build 會自動先跑）
pnpm preview:bears # 產生三熊接觸表 PNG（3×8 表情一次看完）
```

`.claude/launch.json` 有兩組設定：`dev`（4321）與 `preview`（4330，跑 `dist/`）。
瀏覽器分頁若沒有實際合成畫面，`IntersectionObserver` 不會觸發，**圖表會停在未初始化狀態**——那是環境限制不是 bug，改用 `dist/` 的 HTML 做靜態驗證。

送出前跑：`pnpm check && pnpm test && pnpm build`。

## 技術棧與版本限制

**Node 24.18.0 LTS + pnpm 11。** `packageManager` 與 `pnpm-lock.yaml` 是唯一套件管理來源；不要新增 `package-lock.json`。

- Astro 7 + MDX + Content Collections
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
  lib/resample.ts 日線 → 週線／月線
  lib/backtest.ts 均線交叉回測 ＋ 參數掃描（只給教材用，不是交易系統）
  lib/course.ts   課程結構，首頁／側欄／導覽都讀它
  components/bears/  《熊熊遇見你》透明 WebP 角色元件
  components/charts/ 圖表元件
  components/learn/  Callout / FormulaBlock / Quiz / PatternDrill / RiskCalculator / KeyTakeaways
```

## 不能違反的約定

### 指標計算

**暖機期一律回傳 `null`，不准填 0 或首值。** MA20 必須從第 20 根才開始畫。教學網站上畫錯線等於教錯。`Point.value: number | null`，繪圖層轉成 whitespace 資料點。

三個已知容易寫錯、且有測試鎖住的地方：

- **KD**：K/D 初始值是 **50**（台股慣例）；`H9 === L9` 時 RSV 沿用前值，給 0 會捏造出不存在的超賣訊號
- **RSI**：Wilder 平滑 α=1/N，**不是** EMA 的 α=2/(N+1)
- **EMA**：種子是前 N 根的 SMA，**不是**第一根收盤價

改指標必先跑 `pnpm test`。`registry.test.ts` 會拿三檔真實資料把每個登錄的指標掃過參數全範圍。

### 新增指標

只改 `src/lib/indicators/`：

1. 寫純函式（吃 `Bar[]`，吐 `Point[]`）＋ 測試
2. 在 `index.ts` 的 `INDICATORS` 加一筆 `IndicatorSpec`

UI 不用動。`IndicatorLab` 與 `/lab` 的控制項、圖例、公式說明全部由登錄表自動生成。

### 顏色

- **紅漲綠跌**（台股慣例）。紅綠在這個網站上**專屬於漲跌**——UI 元件、品牌色、圖表指標線一律避開紅綠系，否則會稀釋學員的顏色直覺。品牌色是天藍 `#5BA8D4` ＋ 奶油黃 `#F5C86B`。
- 圖表指標線的色碼同時存在兩個地方：`lib/chart/theme.ts`（canvas 用）與 `global.css` 的 `--chart-1..5`（圖例用）。**改色要兩邊一起改。**
- 描邊用深棕 `#3D3230` 不用純黑；陰影用實心位移 `4px 4px 0` 不用模糊——這是卡通風的關鍵。
- 連 `ParamSweep` 的報酬熱圖也不准用紅綠：正報酬走品牌藍的深淺、負報酬走灰棕。報酬跟漲跌太接近，套紅綠會把顏色直覺稀釋掉。

### 圖表

- 課文裡的圖用 `interaction: 'article'`（預設）：**關掉滾輪縮放與垂直觸控拖曳**，否則讀者捲到圖表就會卡住。只有 `/lab` 用 `'tool'`。
- 窗格高度用 `setStretchFactor` **不要用 `setHeight`**。`setHeight` 會讀「窗格當下已渲染的高度」換算，那個值要等下一次繪製才更新，同一 tick 連續呼叫會讀到過期數值，結果不收斂（實測：成交量窗格被擠成 38px、KD 膨脹到 162px）。
- 卸載時要 `destroy()`。
- **斜線標註（`trendLines`）用「只有兩個點的 LineSeries」實作**——lightweight-charts 沒有畫線工具。它們掛 `autoscaleInfoProvider: () => null`，否則延伸出去的線會把主圖的價格軸撐開。
- `timeframe="week" | "month"` 會先把日線疊成週／月線再切片，所以 `from`／`to`／`warmup` 都是以**疊完之後的根數**計算——`warmup={20}` 是 20 根週線不是 20 天。

### 字型

粉圓是**依全站實際用字子集化**的單一檔案（26 課寫完後是 1567 字、290KB），不是 unicode-range 分片。

一開始用 cn-font-split 切成 104 片，實測單一課程頁要抓 50 幾片、約 1.4MB —— 長文的用字會散落在大半分片裡，分片對這種內容根本省不到。改成單一子集後整站共用一個檔案，第一次載入後全部命中快取。

代價是**新增課程若用到全新的字，要重跑 `pnpm build:font`**。它掛在 `prebuild`，正式建置一定是最新的；`pnpm dev` 期間漏掉的字會退回系統字型，不影響閱讀。

### 內容

- **真實資料與合成資料絕不混淆。** 合成的一律加 `synthetic` prop，圖上會出現「示意圖」徽章。
- TWSE 日線是**未還原權值**，除權息當日有跳空缺口。這不是 bug，是教材（見「缺口」與「台股遊戲規則」章節）。
- **課文引用的數字都要能從 `src/data/ohlcv/` 驗證。** 不確定就寫腳本算，不要憑印象。做法是在 `src/lib/` 開一個暫時的 `*.test.ts`，用真正的指標函式跑完印出來，抄完數字再刪掉——這樣課文的數字跟網站畫出來的圖必定同源。
- **統計數字一律要附對照組。** 「這個訊號後 20 天平均 +4.2%」單獨看毫無意義，因為台積電那段期間隨便挑一天都是 +2.84%。沒有對照組的勝率是話術，這件事課文裡講了很多次，寫課文的時候自己更不能犯。
- 引用長榮（2603）的統計時，**2022-09 減資與 2023-06 除息前後的視窗要排除**。一次減資就能讓某個型態的平均報酬憑空多出好幾個百分點。
- 每一課的固定骨架：大大丟情境 → 直覺圖解 → 公式與白話（阿極）→ 互動實驗 → 有效案例 → **失效案例（胖達）** → 常見誤用 → 重點回顧 → 小測驗。
- `Quiz` 的每個選項都要寫 `why`，包含錯的選項。只回一個紅叉是在浪費那次犯錯的價值。

### 三熊

角色 id 是 `duo` / `kong` / `jun`（早期命名，別改——四階段課程的 MDX 全部靠它）。

| id | 名字 | 造型 | 負責 |
|---|---|---|---|
| `duo` | 大大 | 棕熊 grizzly | 訊號出現了、型態成形了、可以進場 |
| `kong` | 胖達 | 貓熊 panda | 訊號什麼時候會騙人、停損、風險 |
| `jun` | 阿極 | 白熊 ice-bear | 公式、計算、「你們兩個都對，因為……」 |

造型是 `public/images/bears/<folder>/<mood>.webp` 的透明去背圖，八種 mood（`neutral` `happy` `excited` `worried` `thinking` `shocked` `proud` `sleepy`）各一張，共 24 張。對應表在 `parts/bodies.ts`，型別在 `parts/geometry.ts`。

換圖之後跑 `pnpm preview:bears` 產出 3×8 接觸表一次檢視全部組合（用 sharp 合成，不需要跑 dev server）。

## MDX 可用元件

不用 import，由 `src/components/mdx.ts` 注入：

| 元件 | 用途 |
|---|---|
| `BearTalk` `BearAvatar` `BearScene` | 三熊對話與同框 |
| `PriceChart` | 唯讀 K 線圖，可疊指標、掛 `markers` / `priceLines` / `trendLines` |
| `IndicatorLab` | 可拉參數即時重算的互動圖 |
| `CandleAnatomy` | 單根 K 線解剖（`variant="anatomy" \| "compare"`） |
| `CandlePattern` | 2~3 根 K 線組合示意（純 SVG，價格會各自正規化） |
| `ChartFrame` | 圖表外框，一般不直接用 |
| `ParamSweep` | 建置期跑均線交叉參數網格，畫成熱圖 |
| `Callout` `FormulaBlock` `KeyTakeaways` `Quiz` | 課文區塊 |
| `PatternDrill` | 看圖辨識型態的連續測驗（含計分） |
| `RiskCalculator` | 部位大小與盈虧比計算器 |

`Callout` 的 `kind`：`key` 重點／`trap` 常見誤用／`note` 補充／`tw` 台股特有／`try` 動手試試。

`PriceChart` 與 `IndicatorLab` 記得給 `warmup`——想讓 MA60 從畫面第一根就有值，`warmup` 至少要 60，圖表會用 `visibleRange` 把顯示範圍收回你指定的區間。

YAML frontmatter 的 `keywords` 裡如果有 `%` 開頭的字串（例如 `%b`）**一定要加引號**，否則 js-yaml 會當成指令解析而整個檔案炸掉。

## 課程進度

**26 課全部完成**（基礎 6／型態 6／指標 10／進階 4）。四階段結構定義在 `src/lib/course.ts`。

新增課程只要在 `src/content/lessons/<stage>/` 放 MDX，frontmatter 由 zod 驗證，首頁地圖／側欄／上下課導覽全部自動同步。

`src/data/synthetic/patterns.ts` 目前有 8 組合成型態（頭肩頂、雙重底、上升三角、多頭旗形、上升楔形、矩形、島狀反轉、頂背離）。**它們的性質被 `patterns.test.ts` 鎖住**——課文寫「第二個高點更高但 RSI 更低」，那句話就是一條斷言。改控制點或種子之前先看那份測試。
