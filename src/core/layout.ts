import { colorAt, contrastText, getPaletteColors, getWaterfallColors } from "./palettes";
import { formatNumber, formatSigned, gridToData } from "./data";
import type { ChartData, ChartSpec, LinePrim, Prim, Size, TextPrim } from "./types";

const TEXT = "#262626";
const AXIS = "#7F7F7F";
const GRID = "#D9D9D9";
const BRACKET = "#404040";
const PAD = 4;

export function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += /[MWmw@%]/.test(ch) ? 0.82 : /[il.,:;'|!\s]/.test(ch) ? 0.3 : /[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(ch) ? 0.62 : 0.52;
  return w * size;
}

export function lineHeight(size: number): number {
  return size * 1.3;
}

/** Łamie tekst na wiersze mieszczące się w podanej szerokości (maksymalnie maxLines). */
export function wrapText(text: string, maxWidth: number, size: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (current && textWidth(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1] + "…";
    return kept;
  }
  return lines;
}

/** „Ładny” krok osi: 1, 2, 2.5 lub 5 razy potęga dziesięciu. */
export function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const raw = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * pow;
}

export function cagr(first: number, last: number, periods: number): number | null {
  if (first <= 0 || last <= 0 || periods <= 0) return null;
  return Math.pow(last / first, 1 / periods) - 1;
}

interface Ctx {
  spec: ChartSpec;
  data: ChartData;
  colors: string[];
  fs: number;
  lh: number;
  out: Prim[];
}

function text(ctx: Ctx, role: string, x: number, y: number, w: number, h: number, value: string, extra: Partial<TextPrim> = {}): void {
  ctx.out.push({ kind: "text", role, x, y, w, h, text: value, size: ctx.fs, color: TEXT, align: "center", valign: "middle", ...extra });
}

function line(ctx: Ctx, role: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<LinePrim> = {}): void {
  ctx.out.push({ kind: "line", role, x1, y1, x2, y2, color: AXIS, width: 0.75, ...extra });
}

/** Legenda w poziomie u góry wykresu. Zwraca zajętą wysokość. */
function legend(ctx: Ctx, items: { label: string; color: string }[], width: number): number {
  if (!ctx.spec.options.showLegend || items.length === 0) return 0;
  const sw = ctx.fs * 0.8;
  let x = 0;
  let row = 0;
  const placed: { label: string; color: string; x: number; row: number; w: number }[] = [];
  for (const item of items) {
    const w = sw + 4 + textWidth(item.label, ctx.fs) + 4;
    if (x > 0 && x + w > width) {
      x = 0;
      row++;
    }
    placed.push({ ...item, x, row, w });
    x += w + 10;
  }
  for (const p of placed) {
    const y = p.row * ctx.lh;
    ctx.out.push({ kind: "rect", role: "legend-swatch", x: p.x, y: y + (ctx.lh - sw) / 2, w: sw, h: sw, fill: p.color });
    text(ctx, "legend-label", p.x + sw + 4, y, p.w - sw - 4, ctx.lh, p.label, { align: "left" });
  }
  return (row + 1) * ctx.lh + PAD;
}

function seriesLegendItems(ctx: Ctx) {
  return ctx.data.series.length > 1 ? ctx.data.series.map((s, i) => ({ label: s.name, color: colorAt(ctx.colors, i) })) : [];
}

export function layoutChart(spec: ChartSpec, size: Size): Prim[] {
  const data = gridToData(spec.grid);
  const fs = spec.options.fontSize;
  const ctx: Ctx = { spec, data, colors: getPaletteColors(spec.options.paletteId, spec.options.customColors), fs, lh: lineHeight(fs), out: [] };
  if (data.categories.length === 0 || data.series.length === 0) {
    text(ctx, "empty", 0, 0, size.width, size.height, "Brak danych – uzupełnij arkusz danych", { color: AXIS });
    return ctx.out;
  }
  switch (spec.type) {
    case "column-clustered":
    case "column-stacked":
    case "column-100":
      layoutColumns(ctx, size);
      break;
    case "bar-clustered":
    case "bar-stacked":
      layoutBars(ctx, size);
      break;
    case "line":
      layoutLine(ctx, size);
      break;
    case "pie":
    case "doughnut":
      layoutPie(ctx, size);
      break;
    case "waterfall":
      layoutWaterfall(ctx, size);
      break;
  }
  return ctx.out;
}

// ---------------------------------------------------------------------------
// Wspólne elementy osi pionowej (wykresy kolumnowe, liniowe, kaskadowe)

interface VPlot {
  left: number;
  right: number;
  top: number;
  bottom: number;
  vmin: number;
  vmax: number;
  y: (v: number) => number;
  cw: number;
  cx: (i: number) => number;
}

function arrowCount(ctx: Ctx): number {
  const n = ctx.data.categories.length;
  const valid = (a: { from: number; to: number } | null) => !!a && a.from !== a.to && a.from >= 0 && a.to >= 0 && a.from < n && a.to < n;
  return (valid(ctx.spec.options.diffArrow) ? 1 : 0) + (valid(ctx.spec.options.cagr) ? 1 : 0);
}

function buildVPlot(ctx: Ctx, size: Size, vmin: number, vmax: number, legendH: number, percentAxis = false): VPlot {
  const { options } = ctx.spec;
  const n = ctx.data.categories.length;
  if (vmax === vmin) vmax = vmin + 1;
  const step = niceStep(vmax - vmin);
  if (options.showValueAxis) {
    vmin = Math.floor(vmin / step - 1e-9) * step;
    vmax = Math.ceil(vmax / step - 1e-9) * step;
  }
  const axisW = options.showValueAxis
    ? Math.max(textWidth(formatNumber(vmax, options.format), ctx.fs), textWidth(formatNumber(vmin, options.format), ctx.fs)) + 8
    : 0;
  const left = axisW + PAD;
  const right = size.width - PAD;
  const cw = (right - left) / n;
  const catLines = Math.max(...ctx.data.categories.map((c) => wrapText(c, cw - 4, ctx.fs).length));
  const bottom = size.height - catLines * ctx.lh - PAD;
  const top = legendH + ctx.lh + arrowCount(ctx) * (ctx.lh * 1.6) + PAD;
  const y = (v: number) => bottom - ((v - vmin) / (vmax - vmin)) * (bottom - top);
  const plot: VPlot = { left, right, top, bottom, vmin, vmax, y, cw, cx: (i) => left + cw * (i + 0.5) };

  if (options.showValueAxis) {
    for (let v = vmin; v <= vmax + step * 1e-6; v += step) {
      const yy = y(v);
      if (Math.abs(v) > step * 1e-6) line(ctx, "gridline", left, yy, right, yy, { color: GRID, width: 0.5, dash: true });
      const label = percentAxis ? formatNumber(v, { ...options.format, suffix: "%" }) : formatNumber(v, options.format);
      text(ctx, "axis-label", 0, yy - ctx.lh / 2, axisW - 4, ctx.lh, label, { align: "right", color: AXIS });
    }
    line(ctx, "value-axis", left, top, left, bottom);
  }

  ctx.data.categories.forEach((c, i) => {
    const lines = wrapText(c, cw - 4, ctx.fs);
    text(ctx, "category-label", left + cw * i, bottom + PAD, cw, lines.length * ctx.lh, lines.join("\n"), { valign: "top" });
  });
  return plot;
}

function baseline(ctx: Ctx, p: VPlot): void {
  const y0 = p.y(Math.max(p.vmin, Math.min(p.vmax, 0)));
  line(ctx, "baseline", p.left, y0, p.right, y0, { color: "#595959", width: 1 });
}

/**
 * Strzałka-klamra nad wykresem: od kategorii `from` do `to`, z etykietą na środku.
 * `anchor` zwraca współrzędną y szczytu kategorii; klamra kończy się nad jej etykietą.
 */
function bracketArrow(ctx: Ctx, p: VPlot, from: number, to: number, anchor: (i: number) => number, slot: number, label: string, ellipse: boolean): void {
  const yBracket = p.top - ctx.lh - (slot + 0.5) * ctx.lh * 1.6;
  // Kolejne klamry odsuwamy na zewnątrz, żeby ich pionowe ramiona się nie nakładały.
  const dir = to > from ? 1 : -1;
  const x1 = p.cx(from) - dir * slot * 8;
  const x2 = p.cx(to) + dir * slot * 8;
  const end1 = anchor(from) - ctx.lh - 2;
  const end2 = anchor(to) - ctx.lh - 2;
  const tri = ctx.fs * 0.5;
  line(ctx, "arrow", x1, yBracket, x1, Math.max(yBracket, end1), { color: BRACKET });
  line(ctx, "arrow", x1, yBracket, x2, yBracket, { color: BRACKET });
  line(ctx, "arrow", x2, yBracket, x2, Math.max(yBracket, end2 - tri), { color: BRACKET });
  ctx.out.push({ kind: "triangle", role: "arrow-head", x: x2 - tri / 2, y: Math.max(yBracket, end2 - tri), w: tri, h: tri, direction: "down", fill: BRACKET });
  const w = textWidth(label, ctx.fs) + (ellipse ? 18 : 8);
  const h = ctx.lh + (ellipse ? 4 : 0);
  text(ctx, "arrow-label", (x1 + x2) / 2 - w / 2, yBracket - h / 2, w, h, label, {
    background: "#FFFFFF",
    shape: ellipse ? "ellipse" : "rect",
    bold: ellipse,
  });
}

/**
 * Strzałka różnicy i CAGR. `anchor` daje położenie y szczytu kategorii,
 * `level` wartość, z której liczymy różnicę.
 */
function decorations(ctx: Ctx, p: VPlot, anchor: (i: number) => number, level: (i: number) => number): void {
  const { diffArrow, cagr: cagrSpec, format } = ctx.spec.options;
  const n = ctx.data.categories.length;
  const ok = <T extends { from: number; to: number }>(a: T | null): a is T =>
    !!a && a.from !== a.to && a.from >= 0 && a.to >= 0 && a.from < n && a.to < n;
  let slot = 0;
  if (ok(diffArrow)) {
    const a = level(diffArrow.from);
    const b = level(diffArrow.to);
    let label: string;
    if (diffArrow.mode === "percent") {
      label = a === 0 ? "n/d" : formatSigned(((b - a) / Math.abs(a)) * 100, { ...format, suffix: "%", decimals: Math.max(format.decimals, 0) });
    } else {
      label = formatSigned(b - a, format);
    }
    bracketArrow(ctx, p, diffArrow.from, diffArrow.to, anchor, slot++, label, false);
  }
  if (ok(cagrSpec)) {
    const r = cagr(level(cagrSpec.from), level(cagrSpec.to), Math.abs(cagrSpec.to - cagrSpec.from));
    const label = r === null ? "CAGR: n/d" : "CAGR: " + formatSigned(r * 100, { ...format, suffix: "%", decimals: 1 });
    bracketArrow(ctx, p, cagrSpec.from, cagrSpec.to, anchor, slot++, label, true);
  }
}

// ---------------------------------------------------------------------------

function layoutColumns(ctx: Ctx, size: Size): void {
  const { type, options } = ctx.spec;
  const { series, categories } = ctx.data;
  const n = categories.length;
  const stacked = type !== "column-clustered";
  const percent = type === "column-100";
  const legendH = legend(ctx, seriesLegendItems(ctx), size.width);

  const val = (s: number, c: number) => series[s].values[c] ?? 0;
  const posSum = (c: number) => series.reduce((acc, _, s) => acc + Math.max(0, val(s, c)), 0);
  const negSum = (c: number) => series.reduce((acc, _, s) => acc + Math.min(0, val(s, c)), 0);
  const shown = (s: number, c: number) => (percent ? (posSum(c) > 0 ? (Math.max(0, val(s, c)) / posSum(c)) * 100 : 0) : val(s, c));

  let vmin = 0;
  let vmax = 0;
  for (let c = 0; c < n; c++) {
    if (percent) vmax = 100;
    else if (stacked) {
      vmax = Math.max(vmax, posSum(c));
      vmin = Math.min(vmin, negSum(c));
    } else
      for (let s = 0; s < series.length; s++) {
        vmax = Math.max(vmax, val(s, c));
        vmin = Math.min(vmin, val(s, c));
      }
  }
  const p = buildVPlot(ctx, size, vmin, vmax, legendH, percent);
  const groupW = p.cw * (1 - options.gap);

  for (let c = 0; c < n; c++) {
    const gx = p.cx(c) - groupW / 2;
    let up = 0;
    let down = 0;
    for (let s = 0; s < series.length; s++) {
      if (series[s].values[c] === null) continue;
      const v = shown(s, c);
      const fill = colorAt(ctx.colors, s);
      let x: number, w: number, y0: number, y1: number;
      if (stacked) {
        x = gx;
        w = groupW;
        const base = v >= 0 ? up : down;
        y0 = p.y(base);
        y1 = p.y(base + v);
        if (v >= 0) up += v;
        else down += v;
      } else {
        w = groupW / series.length;
        x = gx + w * s;
        y0 = p.y(0);
        y1 = p.y(v);
      }
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      ctx.out.push({ kind: "rect", role: "segment", x, y: top, w, h, fill });
      if (!options.showValueLabels) continue;
      const label = formatNumber(percent ? v : val(s, c), percent ? { ...options.format, suffix: "%" } : options.format);
      if (stacked) {
        if (h >= ctx.lh && textWidth(label, ctx.fs) <= w + 2) text(ctx, "value-label", x, top, w, h, label, { color: contrastText(fill) });
      } else {
        const ly = v >= 0 ? top - ctx.lh : top + h;
        text(ctx, "value-label", x - 6, ly, w + 12, ctx.lh, label);
      }
    }
    if (stacked && options.showTotals) {
      const total = series.reduce((acc, _, s) => acc + val(s, c), 0);
      const yTop = p.y(percent ? 100 : up);
      text(ctx, "total-label", gx - 10, yTop - ctx.lh, groupW + 20, ctx.lh, formatNumber(total, { ...options.format, suffix: percent ? "" : options.format.suffix }), { bold: true });
    }
  }
  baseline(ctx, p);
  const total = (c: number) => series.reduce((acc, _, s) => acc + val(s, c), 0);
  if (percent) decorations(ctx, p, () => p.y(100), total);
  else if (stacked) decorations(ctx, p, (c) => p.y(posSum(c)), total);
  else decorations(ctx, p, (c) => p.y(Math.max(0, ...series.map((_, s) => val(s, c)))), (c) => val(0, c));
}

function layoutBars(ctx: Ctx, size: Size): void {
  const { type, options } = ctx.spec;
  const { series, categories } = ctx.data;
  const n = categories.length;
  const stacked = type === "bar-stacked";
  const legendH = legend(ctx, seriesLegendItems(ctx), size.width);
  const val = (s: number, c: number) => series[s].values[c] ?? 0;

  let vmin = 0;
  let vmax = 0;
  for (let c = 0; c < n; c++) {
    if (stacked) {
      vmax = Math.max(vmax, series.reduce((a, _, s) => a + Math.max(0, val(s, c)), 0));
      vmin = Math.min(vmin, series.reduce((a, _, s) => a + Math.min(0, val(s, c)), 0));
    } else
      for (let s = 0; s < series.length; s++) {
        vmax = Math.max(vmax, val(s, c));
        vmin = Math.min(vmin, val(s, c));
      }
  }
  if (vmax === vmin) vmax = vmin + 1;
  const catW = Math.min(size.width * 0.35, Math.max(...categories.map((c) => textWidth(c, ctx.fs))) + 8);
  const labelRoom = textWidth(formatNumber(vmax, options.format), ctx.fs) + 8;
  const negRoom = vmin < 0 ? textWidth(formatNumber(vmin, options.format), ctx.fs) + 8 : 0;
  const left = catW + PAD + negRoom;
  const right = size.width - PAD - labelRoom;
  const top = legendH + PAD;
  const bottom = size.height - PAD;
  const ch = (bottom - top) / n;
  const x = (v: number) => left + ((v - vmin) / (vmax - vmin)) * (right - left);
  const groupH = ch * (1 - options.gap);

  for (let c = 0; c < n; c++) {
    const gy = top + ch * c + (ch - groupH) / 2;
    const lines = wrapText(categories[c], catW - 4, ctx.fs, 2);
    text(ctx, "category-label", 0, top + ch * c, catW, ch, lines.join("\n"), { align: "right" });
    let pos = 0;
    let neg = 0;
    for (let s = 0; s < series.length; s++) {
      if (series[s].values[c] === null) continue;
      const v = val(s, c);
      const fill = colorAt(ctx.colors, s);
      let y: number, h: number, x0: number, x1: number;
      if (stacked) {
        y = gy;
        h = groupH;
        const base = v >= 0 ? pos : neg;
        x0 = x(base);
        x1 = x(base + v);
        if (v >= 0) pos += v;
        else neg += v;
      } else {
        h = groupH / series.length;
        y = gy + h * s;
        x0 = x(0);
        x1 = x(v);
      }
      const lx = Math.min(x0, x1);
      const w = Math.abs(x1 - x0);
      ctx.out.push({ kind: "rect", role: "segment", x: lx, y, w, h, fill });
      if (!options.showValueLabels) continue;
      const label = formatNumber(v, options.format);
      if (stacked) {
        if (w >= textWidth(label, ctx.fs) + 4 && h >= ctx.fs) text(ctx, "value-label", lx, y, w, h, label, { color: contrastText(fill) });
      } else if (v >= 0) text(ctx, "value-label", lx + w + 3, y, labelRoom, h, label, { align: "left" });
      else text(ctx, "value-label", lx - negRoom - 3, y, negRoom, h, label, { align: "right" });
    }
    if (stacked && options.showTotals) {
      const total = series.reduce((a, _, s) => a + val(s, c), 0);
      text(ctx, "total-label", x(pos) + 3, gy, labelRoom, groupH, formatNumber(total, options.format), { align: "left", bold: true });
    }
  }
  line(ctx, "baseline", x(0), top, x(0), bottom, { color: "#595959", width: 1 });
}

function layoutLine(ctx: Ctx, size: Size): void {
  const { options } = ctx.spec;
  const { series } = ctx.data;
  const legendH = legend(ctx, seriesLegendItems(ctx), size.width);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const vmin = Math.min(0, ...all);
  const vmax = Math.max(0, ...all);
  const p = buildVPlot(ctx, size, vmin, vmax, legendH);
  baseline(ctx, p);
  series.forEach((s, si) => {
    const color = colorAt(ctx.colors, si);
    let prev: { x: number; y: number } | null = null;
    s.values.forEach((v, c) => {
      if (v === null) {
        prev = null;
        return;
      }
      const pt = { x: p.cx(c), y: p.y(v) };
      if (prev) line(ctx, "series-line", prev.x, prev.y, pt.x, pt.y, { color, width: 2.25 });
      prev = pt;
    });
    s.values.forEach((v, c) => {
      if (v === null) return;
      const pt = { x: p.cx(c), y: p.y(v) };
      ctx.out.push({ kind: "marker", role: "marker", cx: pt.x, cy: pt.y, r: 3.5, fill: color });
      if (options.showValueLabels) text(ctx, "value-label", pt.x - p.cw / 2, pt.y - ctx.lh - 4, p.cw, ctx.lh, formatNumber(v, options.format), { color });
    });
  });
  // Klamra nad najwyższym punktem kategorii, wartości z pierwszej serii.
  decorations(ctx, p, (c) => p.y(Math.max(...series.map((s) => s.values[c] ?? 0))) - 4, (c) => series[0].values[c] ?? 0);
}

function layoutPie(ctx: Ctx, size: Size): void {
  const { options, type } = ctx.spec;
  const { categories } = ctx.data;
  const values = ctx.data.series[0].values.map((v) => Math.max(0, v ?? 0));
  const total = values.reduce((a, b) => a + b, 0);
  const legendW = options.showLegend ? Math.min(size.width * 0.4, Math.max(...categories.map((c) => textWidth(c, ctx.fs))) + ctx.fs + 16) : 0;
  const areaW = size.width - legendW;
  const r = Math.max(10, Math.min(areaW, size.height) / 2 - ctx.lh - PAD);
  const cx = areaW / 2;
  const cy = size.height / 2;
  const innerR = type === "doughnut" ? r * 0.55 : 0;
  let angle = 0;
  values.forEach((v, i) => {
    if (total <= 0 || v <= 0) return;
    const sweep = (v / total) * 360;
    const fill = colorAt(ctx.colors, i);
    ctx.out.push({ kind: "wedge", role: "segment", cx, cy, r, innerR, start: angle, end: angle + sweep, fill });
    if (options.showValueLabels) {
      const mid = ((angle + sweep / 2) * Math.PI) / 180;
      const inside = sweep >= 18;
      const lr = inside ? (innerR > 0 ? (r + innerR) / 2 : r * 0.62) : r + ctx.lh * 0.9;
      const lx = cx + Math.sin(mid) * lr;
      const ly = cy - Math.cos(mid) * lr;
      const label = formatNumber(v, options.format);
      const w = textWidth(label, ctx.fs) + 8;
      text(ctx, "value-label", lx - w / 2, ly - ctx.lh / 2, w, ctx.lh, label, { color: inside ? contrastText(fill) : TEXT });
    }
    angle += sweep;
  });
  if (type === "doughnut" && options.showTotals && total > 0) {
    text(ctx, "total-label", cx - innerR, cy - ctx.lh, innerR * 2, ctx.lh * 2, formatNumber(total, options.format), { bold: true, size: ctx.fs * 1.3 });
  }
  if (options.showLegend) {
    const sw = ctx.fs * 0.8;
    const x0 = areaW + 8;
    const startY = cy - (categories.length * ctx.lh) / 2;
    categories.forEach((c, i) => {
      const y = startY + i * ctx.lh;
      ctx.out.push({ kind: "rect", role: "legend-swatch", x: x0, y: y + (ctx.lh - sw) / 2, w: sw, h: sw, fill: colorAt(ctx.colors, i) });
      text(ctx, "legend-label", x0 + sw + 4, y, legendW - sw - 12, ctx.lh, c, { align: "left" });
    });
  }
}

function layoutWaterfall(ctx: Ctx, size: Size): void {
  const { options } = ctx.spec;
  const { categories, totals } = ctx.data;
  const values = ctx.data.series[0].values;
  const n = categories.length;

  // Poziomy: start i koniec każdego słupka.
  const bars: { from: number; to: number; total: boolean }[] = [];
  let running = 0;
  for (let c = 0; c < n; c++) {
    if (totals[c]) {
      bars.push({ from: 0, to: running, total: true });
    } else {
      const v = values[c] ?? 0;
      bars.push({ from: running, to: running + v, total: c === 0 });
      running += v;
    }
  }
  const levels = bars.flatMap((b) => [b.from, b.to]);
  const wf = getWaterfallColors(options.paletteId, options.customColors);
  const legendItems = options.showLegend
    ? [
        { label: "Wzrost", color: wf.increase },
        { label: "Spadek", color: wf.decrease },
      ]
    : [];
  const legendH = legend(ctx, legendItems, size.width);
  const p = buildVPlot(ctx, size, Math.min(0, ...levels), Math.max(0, ...levels), legendH);
  const w = p.cw * (1 - options.gap);
  bars.forEach((b, c) => {
    const delta = b.to - b.from;
    const fill = b.total ? wf.total : delta >= 0 ? wf.increase : wf.decrease;
    const x = p.cx(c) - w / 2;
    const top = p.y(Math.max(b.from, b.to));
    const h = Math.max(0.5, Math.abs(p.y(b.from) - p.y(b.to)));
    ctx.out.push({ kind: "rect", role: "segment", x, y: top, w, h, fill });
    if (c < n - 1) {
      const nx = p.cx(c + 1) - w / 2;
      line(ctx, "connector", x + w, p.y(b.to), nx, p.y(b.to), { color: AXIS, width: 0.5, dash: true });
    }
    if (options.showValueLabels) {
      const label = b.total ? formatNumber(b.to, options.format) : formatSigned(delta, options.format);
      if (delta >= 0 || b.total) text(ctx, "value-label", x - 8, top - ctx.lh, w + 16, ctx.lh, label, { bold: b.total });
      else text(ctx, "value-label", x - 8, top + h, w + 16, ctx.lh, label);
    }
  });
  baseline(ctx, p);
  decorations(ctx, p, (c) => p.y(Math.max(bars[c].from, bars[c].to)), (c) => bars[c].to);
}

export const CHART_TYPE_LABELS: Record<ChartSpec["type"], string> = {
  "column-clustered": "Kolumnowy grupowany",
  "column-stacked": "Kolumnowy skumulowany",
  "column-100": "Kolumnowy 100%",
  "bar-clustered": "Słupkowy grupowany",
  "bar-stacked": "Słupkowy skumulowany",
  line: "Liniowy",
  pie: "Kołowy",
  doughnut: "Pierścieniowy",
  waterfall: "Kaskadowy",
};
