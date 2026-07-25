/**
 * lightweight-charts v5 的統一封裝。
 *
 * v5 是破壞性改版，網路上絕大多數範例還停在 v4：
 *   v4  chart.addCandlestickSeries({...})
 *   v5  chart.addSeries(CandlestickSeries, {...}, paneIndex)
 * 標記也從 series.setMarkers() 改成獨立的 createSeriesMarkers()。
 * 全站只有這一支檔案碰得到圖表 API，之後升版只要改這裡。
 *
 * 這層負責四件事：
 *   1. 依登錄表把指標鋪成主圖疊圖 + 副圖窗格
 *   2. 暖機期的 null 轉成 whitespace 資料點（讓線真的斷在該斷的地方）
 *   3. 主題切換時整批換色
 *   4. 卸載時確實清乾淨，避免課程頁反覆切換造成洩漏
 */

import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type SeriesType,
  type Time,
} from 'lightweight-charts';

import type { Bar, Point } from '@/lib/indicators/types';
import type { IndicatorSpec, ParamValues } from '@/lib/indicators';
import {
  currentTheme,
  directional,
  onThemeChange,
  palette,
  type ChartPalette,
  type ColorDirection,
  type ThemeName,
} from './theme';

export interface IndicatorLayer {
  spec: IndicatorSpec;
  params: ParamValues;
}

export interface PriceChartOptions {
  bars: readonly Bar[];
  /** 疊在 K 線上的指標（均線、布林通道…） */
  overlays?: IndicatorLayer[];
  /** 各自佔一個副圖窗格的指標（MACD、KD…） */
  panes?: IndicatorLayer[];
  showVolume?: boolean;
  direction?: ColorDirection;
  /** 主圖高度，副圖會另外加上去 */
  height?: number;
  paneHeight?: number;
  markers?: SeriesMarker<Time>[];
  /** 只顯示這段區間，用來把課文講的那一段擺到畫面正中央 */
  visibleRange?: { from: string; to: string };
  /** 水平參考線，例如頸線、支撐壓力 */
  priceLines?: { price: number; label: string; color?: string; dashed?: boolean }[];
  /** 關掉時間軸與十字線，用在只想秀形狀的小圖 */
  minimal?: boolean;
  /**
   * 'article'（預設）課文中的圖：關掉滾輪縮放與垂直觸控拖曳。
   *   一張全寬圖表擺在文章中間，如果吃掉滾輪事件，讀者捲到這裡就會變成在縮放圖表、
   *   頁面卡住不動 —— 這是嵌入式圖表最惱人的一種壞法。
   * 'tool' 專用工具頁（/lab）：所有互動全開，使用者本來就是為了操作圖表而來。
   */
  interaction?: 'article' | 'tool';
}

export interface PriceChartHandle {
  /** 換指標或參數。會盡量沿用既有 series，滑桿拖曳時才不會閃爍。 */
  setIndicators(next: { overlays?: IndicatorLayer[]; panes?: IndicatorLayer[] }): void;
  setMarkers(markers: SeriesMarker<Time>[]): void;
  destroy(): void;
  readonly chart: IChartApi;
}

/** 暖機期的 null 要變成 whitespace 資料點，線才會真的從第 N 根才開始畫。 */
function toLineData(points: readonly Point[]) {
  return points.map((p) =>
    p.value === null ? { time: p.time as Time } : { time: p.time as Time, value: p.value },
  );
}

function resolveColor(
  color: IndicatorSpec['series'][number]['color'],
  p: ChartPalette,
  dir: { up: string; down: string },
): string {
  if (color === 'up') return dir.up;
  if (color === 'down') return dir.down;
  return p.series[color];
}

export function createPriceChart(
  container: HTMLElement,
  options: PriceChartOptions,
): PriceChartHandle {
  const {
    bars,
    showVolume = true,
    direction = 'tw',
    height = 360,
    paneHeight = 130,
    minimal = false,
    interaction = 'article',
  } = options;

  const isTool = interaction === 'tool';

  let theme: ThemeName = currentTheme();
  let colors = palette(theme);
  let dir = directional(colors, direction);

  const chart = createChart(container, {
    autoSize: true,
    height,
    layout: {
      background: { color: colors.background },
      textColor: colors.text,
      fontFamily: getComputedStyle(document.body).fontFamily,
      attributionLogo: false,
      panes: { separatorColor: colors.border, separatorHoverColor: colors.grid },
    },
    grid: {
      vertLines: { color: colors.grid },
      horzLines: { color: colors.grid },
    },
    rightPriceScale: { borderColor: colors.border },
    timeScale: {
      borderColor: colors.border,
      visible: !minimal,
      rightOffset: 4,
      barSpacing: 6,
    },
    crosshair: {
      mode: minimal ? 2 : 1,
      vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
    },
    handleScroll: minimal
      ? false
      : {
          mouseWheel: isTool,
          pressedMouseMove: true,
          horzTouchDrag: true,
          // 手機上關掉垂直觸控拖曳，直向滑動才會捲頁面而不是被圖表吃掉
          vertTouchDrag: false,
        },
    handleScale: minimal
      ? false
      : {
          mouseWheel: isTool,
          pinch: true,
          axisPressedMouseMove: true,
          axisDoubleClickReset: true,
        },
    localization: { locale: 'zh-TW' },
  });

  // ---- 主圖：K 線 ------------------------------------------------------
  const candles = chart.addSeries(
    CandlestickSeries,
    {
      upColor: dir.up,
      downColor: dir.down,
      borderUpColor: dir.up,
      borderDownColor: dir.down,
      wickUpColor: dir.up,
      wickDownColor: dir.down,
      priceLineVisible: false,
      lastValueVisible: !minimal,
    },
    0,
  );
  candles.setData(
    bars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    })),
  );

  let markerPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  if (options.markers?.length) {
    markerPlugin = createSeriesMarkers(candles, options.markers);
  }

  const priceLines: IPriceLine[] = [];
  for (const line of options.priceLines ?? []) {
    priceLines.push(
      candles.createPriceLine({
        price: line.price,
        color: line.color ?? colors.guideStrong,
        lineWidth: 2,
        lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: line.label,
      }),
    );
  }

  // ---- 成交量副圖 -------------------------------------------------------
  // 指數沒有量，硬畫一排 0 只會浪費一整個窗格
  const hasVolume = showVolume && bars.some((b) => b.volume > 0);
  let volumeSeries: ISeriesApi<'Histogram', Time> | null = null;

  if (hasVolume) {
    chart.addPane();
    volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );
    volumeSeries.setData(
      bars.map((b, i) => ({
        time: b.time as Time,
        value: b.volume,
        // 量的顏色跟著當根 K 棒的漲跌，而不是跟著量本身的大小
        color: i > 0 && b.close < bars[i - 1]!.close ? dir.downWash : dir.upWash,
      })),
    );
  }

  const basePaneCount = hasVolume ? 2 : 1;

  // ---- 指標圖層 ---------------------------------------------------------
  /** key = `${paneIndex}:${specId}:${seriesKey}`，用來在更新時比對能不能沿用 */
  interface Layer {
    api: ISeriesApi<SeriesType, Time>;
    paneIndex: number;
    color: IndicatorSpec['series'][number]['color'];
    guides: IPriceLine[];
  }
  const layers = new Map<string, Layer>();

  function ensurePanes(count: number): void {
    while (chart.panes().length < count) chart.addPane();
  }

  function applyLayers(overlays: IndicatorLayer[], panes: IndicatorLayer[]): void {
    const wanted = new Map<string, { layer: IndicatorLayer; paneIndex: number }>();

    for (const layer of overlays) {
      for (const s of layer.spec.series) {
        wanted.set(`0:${layer.spec.id}:${s.key}`, { layer, paneIndex: 0 });
      }
    }
    panes.forEach((layer, i) => {
      const paneIndex = basePaneCount + i;
      for (const s of layer.spec.series) {
        wanted.set(`${paneIndex}:${layer.spec.id}:${s.key}`, { layer, paneIndex });
      }
    });

    ensurePanes(basePaneCount + panes.length);

    // 先移除不再需要的
    for (const [key, layer] of layers) {
      if (wanted.has(key)) continue;
      for (const g of layer.guides) layer.api.removePriceLine(g);
      chart.removeSeries(layer.api);
      layers.delete(key);
    }

    // 再建立／更新
    for (const [key, { layer, paneIndex }] of wanted) {
      const seriesKey = key.split(':')[2]!;
      const spec = layer.spec.series.find((s) => s.key === seriesKey)!;
      const data = layer.spec.compute(bars, layer.params)[seriesKey];
      if (!data) continue;

      let existing = layers.get(key);
      if (!existing) {
        const color = resolveColor(spec.color, colors, dir);
        const api =
          spec.type === 'histogram'
            ? chart.addSeries(
                HistogramSeries,
                { color, priceLineVisible: false, lastValueVisible: false },
                paneIndex,
              )
            : chart.addSeries(
                LineSeries,
                {
                  color,
                  lineWidth: spec.lineWidth ?? 2,
                  lineStyle: spec.dashed ? LineStyle.Dashed : LineStyle.Solid,
                  priceLineVisible: false,
                  lastValueVisible: false,
                  // 固定刻度的副圖（KD、RSI 的 0~100）交給 autoscaleInfoProvider，
                  // 否則資料擠在 40~60 時圖會被自動放大到看不出超買超賣的意義
                  ...(layer.spec.range
                    ? {
                        autoscaleInfoProvider: () => ({
                          priceRange: {
                            minValue: layer.spec.range!.min,
                            maxValue: layer.spec.range!.max,
                          },
                        }),
                      }
                    : {}),
                },
                paneIndex,
              );

        // 固定刻度的副圖要壓縮上下留白，否則 0~100 的 KD 會被撐成 0~120，
        // 讓「80 是超買」這條參考線看起來不在該在的位置
        if (layer.spec.range) {
          api.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.06 } });
        }

        existing = { api, paneIndex, color: spec.color, guides: [] };
        layers.set(key, existing);

        // 參考線只掛在該指標的第一條線上，不然 KD 會畫出兩組重疊的 80/20
        const isFirst = layer.spec.series[0]?.key === seriesKey;
        if (isFirst) {
          for (const g of layer.spec.guides ?? []) {
            existing.guides.push(
              api.createPriceLine({
                price: g.value,
                color: g.emphasis ? colors.guideStrong : colors.guide,
                lineWidth: 1,
                lineStyle: g.emphasis ? LineStyle.Dashed : LineStyle.Dotted,
                axisLabelVisible: false,
                title: g.label,
              }),
            );
          }
        }
      }

      if (spec.type === 'histogram') {
        // 柱狀圖依正負換色（MACD 柱、量比都適用）
        existing.api.setData(
          data.map((p) =>
            p.value === null
              ? { time: p.time as Time }
              : {
                  time: p.time as Time,
                  value: p.value,
                  color: spec.color === 'up' ? (p.value >= 0 ? dir.up : dir.down) : undefined,
                },
          ),
        );
      } else {
        existing.api.setData(toLineData(data));
      }
    }

    applyPaneSizing();
  }

  /**
   * 主圖／成交量／指標副圖的高度比例。
   *
   * 用 setStretchFactor 而不是 setHeight，理由是實測踩到的坑：
   * setHeight 內部會拿「窗格當下已渲染的高度」換算伸縮係數，但那個高度要等
   * 下一次繪製才更新。同一個 tick 裡連續呼叫，第二個窗格讀到的是過期數值，
   * 結果就是成交量窗格被擠成 38px、KD 反而膨脹到 162px，而且怎麼重試都不收斂。
   *
   * 伸縮係數是相對權重，直接餵設計稿上的像素數就好 —— 函式庫會自己正規化，
   * 比例永遠正確，而且視窗縮放時不需要重算。
   */
  function applyPaneSizing(): void {
    const all = chart.panes();
    for (let i = 0; i < all.length; i += 1) {
      const weight = i === 0 ? height : i === 1 && hasVolume ? paneHeight * 0.7 : paneHeight;
      all[i]!.setStretchFactor(weight);
    }
  }

  applyLayers(options.overlays ?? [], options.panes ?? []);

  if (options.visibleRange) {
    chart.timeScale().setVisibleRange({
      from: options.visibleRange.from as Time,
      to: options.visibleRange.to as Time,
    });
  } else {
    chart.timeScale().fitContent();
  }

  // ---- 主題切換 ---------------------------------------------------------
  const stopThemeWatch = onThemeChange((next) => {
    if (next === theme) return;
    theme = next;
    colors = palette(theme);
    dir = directional(colors, direction);

    chart.applyOptions({
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
        panes: { separatorColor: colors.border, separatorHoverColor: colors.grid },
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
      crosshair: {
        vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
        horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair },
      },
    });

    candles.applyOptions({
      upColor: dir.up,
      downColor: dir.down,
      borderUpColor: dir.up,
      borderDownColor: dir.down,
      wickUpColor: dir.up,
      wickDownColor: dir.down,
    });

    volumeSeries?.setData(
      bars.map((b, i) => ({
        time: b.time as Time,
        value: b.volume,
        color: i > 0 && b.close < bars[i - 1]!.close ? dir.downWash : dir.upWash,
      })),
    );

    for (const layer of layers.values()) {
      layer.api.applyOptions({ color: resolveColor(layer.color, colors, dir) });
    }
  });

  let destroyed = false;

  return {
    chart,
    setIndicators({ overlays, panes }) {
      if (destroyed) return;
      applyLayers(overlays ?? [], panes ?? []);
    },
    setMarkers(markers) {
      if (destroyed) return;
      if (markerPlugin) markerPlugin.setMarkers(markers);
      else markerPlugin = createSeriesMarkers(candles, markers);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopThemeWatch();
      layers.clear();
      // chart.remove() 會一併帶走所有 series、pane 與 plugin，
      // 所以上面不需要逐一 removeSeries —— 但 layers 這個 Map 得自己清掉。
      chart.remove();
    },
  };
}
