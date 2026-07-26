/**
 * 圖表的 custom elements。
 *
 * 用原生 custom element 而不是拉一個框架進來：lightweight-charts 本身就是命令式 API，
 * 外面包一層 React 只是多下載一份 runtime，換不到任何東西。
 *
 * 設定值走內嵌的 <script type="application/json">，不用 data 屬性 ——
 * 一段 K 棒動輒好幾 KB，塞進屬性裡光是 HTML 跳脫就很痛苦。
 */

import { INDICATOR_BY_ID, defaultParams, type ParamValues } from '@/lib/indicators';
import type { Bar } from '@/lib/indicators/types';
import {
  createPriceChart,
  type IndicatorLayer,
  type PriceChartHandle,
  type TrendLine,
} from './createPriceChart';
import type { ColorDirection } from './theme';

interface LayerConfig {
  id: string;
  params?: ParamValues;
}

interface ChartConfig {
  bars: Bar[];
  overlays?: LayerConfig[];
  panes?: LayerConfig[];
  showVolume?: boolean;
  direction?: ColorDirection;
  height?: number;
  paneHeight?: number;
  minimal?: boolean;
  visibleRange?: { from: string; to: string };
  priceLines?: { price: number; label: string; color?: string; dashed?: boolean }[];
  trendLines?: TrendLine[];
  markers?: {
    time: string;
    position: 'aboveBar' | 'belowBar' | 'inBar';
    shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
    color?: string;
    text?: string;
  }[];
}

function readConfig(host: HTMLElement): ChartConfig | null {
  const tag = host.querySelector<HTMLScriptElement>('script[type="application/json"]');
  if (!tag?.textContent) return null;
  try {
    return JSON.parse(tag.textContent) as ChartConfig;
  } catch {
    console.error('[chart] 設定 JSON 解析失敗', host);
    return null;
  }
}

function toLayers(list: LayerConfig[] | undefined): IndicatorLayer[] {
  return (list ?? []).flatMap((entry) => {
    const spec = INDICATOR_BY_ID[entry.id];
    if (!spec) {
      console.warn(`[chart] 找不到指標「${entry.id}」`);
      return [];
    }
    return [{ spec, params: { ...defaultParams(spec), ...entry.params } }];
  });
}

/** 圖表滑進畫面才初始化。一堂課可能有五六張圖，全部一開始就畫會拖慢首屏。 */
function whenVisible(el: HTMLElement, fn: () => void): () => void {
  if (!('IntersectionObserver' in window)) {
    fn();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(el);
  return () => io.disconnect();
}

// ---------------------------------------------------------------------------
// <price-chart> —— 唯讀展示圖
// ---------------------------------------------------------------------------
class PriceChartElement extends HTMLElement {
  #handle: PriceChartHandle | null = null;
  #cancel: (() => void) | null = null;

  connectedCallback(): void {
    const mount = this.querySelector<HTMLElement>('[data-chart-canvas]');
    const config = readConfig(this);
    if (!mount || !config) return;

    this.#cancel = whenVisible(this, () => {
      this.#handle = createPriceChart(mount, {
        bars: config.bars,
        overlays: toLayers(config.overlays),
        panes: toLayers(config.panes),
        showVolume: config.showVolume ?? true,
        direction: config.direction ?? 'tw',
        height: config.height ?? 360,
        paneHeight: config.paneHeight ?? 130,
        minimal: config.minimal ?? false,
        visibleRange: config.visibleRange,
        priceLines: config.priceLines,
        trendLines: config.trendLines,
        markers: config.markers?.map((m) => ({
          time: m.time,
          position: m.position,
          shape: m.shape,
          color: m.color ?? '#5ba8d4',
          text: m.text,
        })) as never,
      });
      mount.dataset.ready = 'true';
    });
  }

  disconnectedCallback(): void {
    this.#cancel?.();
    this.#handle?.destroy();
    this.#handle = null;
  }
}

// ---------------------------------------------------------------------------
// <indicator-lab> —— 可調參數的互動圖
// ---------------------------------------------------------------------------
class IndicatorLabElement extends HTMLElement {
  #handle: PriceChartHandle | null = null;
  #cancel: (() => void) | null = null;
  #params = new Map<string, ParamValues>();
  #frame = 0;

  connectedCallback(): void {
    const mount = this.querySelector<HTMLElement>('[data-chart-canvas]');
    const config = readConfig(this);
    if (!mount || !config) return;

    for (const entry of [...(config.overlays ?? []), ...(config.panes ?? [])]) {
      const spec = INDICATOR_BY_ID[entry.id];
      if (spec) this.#params.set(entry.id, { ...defaultParams(spec), ...entry.params });
    }

    this.#cancel = whenVisible(this, () => {
      this.#handle = createPriceChart(mount, {
        bars: config.bars,
        overlays: this.#layers(config.overlays),
        panes: this.#layers(config.panes),
        showVolume: config.showVolume ?? false,
        height: config.height ?? 380,
        paneHeight: config.paneHeight ?? 140,
        visibleRange: config.visibleRange,
      });
      mount.dataset.ready = 'true';
    });

    this.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | null;
      const indicatorId = target?.dataset.indicator;
      const paramKey = target?.dataset.param;
      if (!target || !indicatorId || !paramKey) return;

      const current = this.#params.get(indicatorId);
      if (!current) return;

      const raw = target.value;
      current[paramKey] = target instanceof HTMLInputElement && target.type === 'range'
        ? Number(raw)
        : /^-?\d+(\.\d+)?$/.test(raw)
          ? Number(raw)
          : raw;

      // 顯示目前值（滑桿旁邊那個數字）
      const readout = this.querySelector<HTMLElement>(
        `[data-readout="${indicatorId}:${paramKey}"]`,
      );
      if (readout) readout.textContent = raw;

      // 拖曳滑桿一秒可以觸發幾十次 input，用 rAF 合併成每幀最多一次重算
      cancelAnimationFrame(this.#frame);
      this.#frame = requestAnimationFrame(() => {
        this.#handle?.setIndicators({
          overlays: this.#layers(config.overlays),
          panes: this.#layers(config.panes),
        });
      });
    });

    this.querySelector<HTMLButtonElement>('[data-lab-reset]')?.addEventListener('click', () => {
      for (const entry of [...(config.overlays ?? []), ...(config.panes ?? [])]) {
        const spec = INDICATOR_BY_ID[entry.id];
        if (!spec) continue;
        const defaults = { ...defaultParams(spec), ...entry.params };
        this.#params.set(entry.id, defaults);

        for (const [key, value] of Object.entries(defaults)) {
          const input = this.querySelector<HTMLInputElement>(
            `[data-indicator="${entry.id}"][data-param="${key}"]`,
          );
          if (input) input.value = String(value);
          const readout = this.querySelector<HTMLElement>(`[data-readout="${entry.id}:${key}"]`);
          if (readout) readout.textContent = String(value);
        }
      }
      this.#handle?.setIndicators({
        overlays: this.#layers(config.overlays),
        panes: this.#layers(config.panes),
      });
    });
  }

  #layers(list: LayerConfig[] | undefined): IndicatorLayer[] {
    return (list ?? []).flatMap((entry) => {
      const spec = INDICATOR_BY_ID[entry.id];
      if (!spec) return [];
      return [{ spec, params: this.#params.get(entry.id) ?? defaultParams(spec) }];
    });
  }

  disconnectedCallback(): void {
    this.#cancel?.();
    cancelAnimationFrame(this.#frame);
    this.#handle?.destroy();
    this.#handle = null;
  }
}

// ---------------------------------------------------------------------------
// <indicator-workbench> —— /lab 的綜合實驗室：可換標的、自由開關指標
// ---------------------------------------------------------------------------
interface WorkbenchConfig {
  defaultSymbol: string;
  defaultActive: string[];
  ranges: { key: string; label: string; bars: number | null }[];
}

class IndicatorWorkbenchElement extends HTMLElement {
  #handle: PriceChartHandle | null = null;
  #bars: Bar[] = [];
  #symbol = '';
  #rangeBars: number | null = null;
  #active = new Set<string>();
  #params = new Map<string, ParamValues>();
  #frame = 0;
  #mount: HTMLElement | null = null;
  #config: WorkbenchConfig | null = null;

  connectedCallback(): void {
    const config = readConfig(this) as unknown as WorkbenchConfig | null;
    this.#mount = this.querySelector<HTMLElement>('[data-chart-canvas]');
    if (!config || !this.#mount) return;

    this.#config = config;
    this.#symbol = config.defaultSymbol;
    this.#rangeBars = config.ranges[0]?.bars ?? null;
    for (const id of config.defaultActive) this.#active.add(id);

    for (const spec of Object.values(INDICATOR_BY_ID)) {
      this.#params.set(spec.id, defaultParams(spec));
    }

    this.#wireControls();
    this.#syncControlVisibility();
    void this.#loadSymbol(this.#symbol);
  }

  disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    this.#handle?.destroy();
    this.#handle = null;
  }

  #wireControls(): void {
    // 標的與區間
    this.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-symbol]');
      if (btn?.dataset.symbol && btn.dataset.symbol !== this.#symbol) {
        this.#symbol = btn.dataset.symbol;
        this.#markPressed('[data-symbol]', 'symbol', this.#symbol);
        void this.#loadSymbol(this.#symbol);
        return;
      }

      const range = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-range]');
      if (range?.dataset.range) {
        const found = this.#config?.ranges.find((r) => r.key === range.dataset.range);
        this.#rangeBars = found?.bars ?? null;
        this.#markPressed('[data-range]', 'range', range.dataset.range);
        this.#rebuild();
      }
    });

    // 指標開關
    this.addEventListener('change', (event) => {
      const box = event.target as HTMLInputElement;
      if (box?.dataset.toggle === undefined) return;
      const id = box.dataset.toggle;
      if (box.checked) this.#active.add(id);
      else this.#active.delete(id);
      this.#syncControlVisibility();
      this.#rebuild();
    });

    // 參數滑桿
    this.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | null;
      const id = target?.dataset.indicator;
      const key = target?.dataset.param;
      if (!target || !id || !key) return;

      const params = this.#params.get(id);
      if (!params) return;

      const raw = target.value;
      params[key] =
        target instanceof HTMLInputElement && target.type === 'range'
          ? Number(raw)
          : /^-?\d+(\.\d+)?$/.test(raw)
            ? Number(raw)
            : raw;

      const readout = this.querySelector<HTMLElement>(`[data-readout="${id}:${key}"]`);
      if (readout) readout.textContent = raw;

      cancelAnimationFrame(this.#frame);
      this.#frame = requestAnimationFrame(() => this.#applyLayers());
    });
  }

  #markPressed(selector: string, attr: string, value: string): void {
    for (const el of this.querySelectorAll<HTMLElement>(selector)) {
      el.setAttribute('aria-pressed', String(el.dataset[attr] === value));
    }
  }

  /** 只顯示已啟用指標的參數控制項。全部先渲染在 HTML 裡，這裡只切顯示。 */
  #syncControlVisibility(): void {
    for (const group of this.querySelectorAll<HTMLElement>('[data-param-group]')) {
      group.hidden = !this.#active.has(group.dataset.paramGroup ?? '');
    }
    const panel = this.querySelector<HTMLElement>('[data-params-panel]');
    if (panel) panel.hidden = this.#active.size === 0;
  }

  async #loadSymbol(symbol: string): Promise<void> {
    this.#mount?.setAttribute('data-loading', 'true');
    try {
      const baseUrl = import.meta.env.BASE_URL.endsWith('/')
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      const res = await fetch(`${baseUrl}data/${symbol}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { bars: Bar[] };
      this.#bars = data.bars;
      this.#rebuild();
    } catch (err) {
      console.error('[workbench] 讀取行情失敗', err);
      const note = this.querySelector<HTMLElement>('[data-load-error]');
      if (note) note.hidden = false;
    } finally {
      this.#mount?.removeAttribute('data-loading');
    }
  }

  #visibleBars(): Bar[] {
    if (this.#rangeBars === null) return this.#bars;
    // 多留 250 根暖機，這樣即使開了 240 日均線，畫面第一根也已經有值
    const start = Math.max(0, this.#bars.length - this.#rangeBars - 250);
    return this.#bars.slice(start);
  }

  #split(): { overlays: IndicatorLayer[]; panes: IndicatorLayer[] } {
    const overlays: IndicatorLayer[] = [];
    const panes: IndicatorLayer[] = [];
    for (const id of this.#active) {
      const spec = INDICATOR_BY_ID[id];
      if (!spec) continue;
      const layer = { spec, params: this.#params.get(id) ?? defaultParams(spec) };
      (spec.placement === 'overlay' ? overlays : panes).push(layer);
    }
    return { overlays, panes };
  }

  #applyLayers(): void {
    const { overlays, panes } = this.#split();
    this.#handle?.setIndicators({ overlays, panes });
  }

  /**
   * 換標的、換區間、增減指標都會改變窗格數量，這種結構性變動直接重建整張圖。
   * 只有拖曳參數滑桿走 setIndicators 的快速路徑。
   */
  #rebuild(): void {
    if (!this.#mount || this.#bars.length === 0) return;

    this.#handle?.destroy();

    const bars = this.#visibleBars();
    const { overlays, panes } = this.#split();
    const paneHeight = 130;
    const height = 420;
    const hasVolume = bars.some((b) => b.volume > 0);
    this.#mount.style.height = `${height + panes.length * paneHeight + (hasVolume ? 91 : 0)}px`;

    const visibleFrom =
      this.#rangeBars === null
        ? undefined
        : bars[Math.max(0, bars.length - this.#rangeBars)]?.time;
    const visibleTo = bars.at(-1)?.time;

    this.#handle = createPriceChart(this.#mount, {
      bars,
      overlays,
      panes,
      showVolume: true,
      height,
      paneHeight,
      visibleRange: visibleFrom && visibleTo ? { from: visibleFrom, to: visibleTo } : undefined,
      // 這裡是專用工具頁，滾輪縮放是功能不是干擾
      interaction: 'tool',
    });
    this.#mount.dataset.ready = 'true';
  }
}

if (!customElements.get('price-chart')) {
  customElements.define('price-chart', PriceChartElement);
}
if (!customElements.get('indicator-lab')) {
  customElements.define('indicator-lab', IndicatorLabElement);
}
if (!customElements.get('indicator-workbench')) {
  customElements.define('indicator-workbench', IndicatorWorkbenchElement);
}
