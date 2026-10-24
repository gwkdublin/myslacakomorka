/* Rysowanie wykresu na slajdzie z prymitywów silnika układu oraz odczyt/zapis definicji wykresu w tagach. */
import { layoutChart } from "../core/layout";
import { normalizeSpec } from "../core/data";
import { primsToSvg } from "../core/svg";
import type { ChartSpec, Prim, Size } from "../core/types";
import { CHART_TYPE_LABELS } from "../core/layout";

const TAG_MARK = "MKCHART";
const TAG_SPEC = "MKSPEC";
const TAG_LAYOUT = "MKLAYOUT";
const CHUNK = 2000;

/** Położenie obszaru układu i (po narysowaniu) faktycznej ramki grupy – pozwala wykryć zmianę rozmiaru przez użytkownika. */
interface StoredLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
}

export interface SelectedChart {
  shapeId: string;
  spec: ChartSpec;
}

export function inPowerPoint(): boolean {
  return typeof Office !== "undefined" && Office.context?.host === Office.HostType.PowerPoint;
}

function supports(version: string): boolean {
  return Office.context.requirements.isSetSupported("PowerPointApi", version);
}

/** Natywne kształty wymagają grup (1.8); ukośne linie i wycinki koła również obrotu i uchwytów (1.10). */
export function renderMode(prims: Prim[]): "shapes" | "image" {
  if (!supports("1.8")) return "image";
  const advanced = prims.some((p) => p.kind === "wedge" || (p.kind === "line" && p.x1 !== p.x2 && p.y1 !== p.y2));
  return advanced && !supports("1.10") ? "image" : "shapes";
}

function noLine(shape: PowerPoint.Shape): void {
  shape.lineFormat.visible = false;
}

function styleText(shape: PowerPoint.Shape, p: Extract<Prim, { kind: "text" }>, fontFamily: string): void {
  const tf = shape.textFrame;
  tf.autoSizeSetting = "AutoSizeNone";
  tf.wordWrap = false;
  tf.leftMargin = 0;
  tf.rightMargin = 0;
  tf.topMargin = 0;
  tf.bottomMargin = 0;
  tf.verticalAlignment = p.valign === "top" ? "Top" : p.valign === "bottom" ? "Bottom" : "Middle";
  const range = tf.textRange;
  range.font.size = p.size;
  range.font.color = p.color;
  range.font.bold = !!p.bold;
  if (fontFamily) range.font.name = fontFamily;
  range.paragraphFormat.horizontalAlignment = p.align === "left" ? "Left" : p.align === "right" ? "Right" : "Center";
}

/** Kąt silnika (0 = godz. 12) na kąt PowerPointa (0 = godz. 3), oba zgodnie z ruchem wskazówek. */
function pptAngle(deg: number): number {
  return (((deg - 90) % 360) + 360) % 360;
}

function drawPrims(shapes: PowerPoint.ShapeCollection, prims: Prim[], ox: number, oy: number, fontFamily: string): PowerPoint.Shape[] {
  const created: PowerPoint.Shape[] = [];
  for (const p of prims) {
    switch (p.kind) {
      case "rect": {
        const s = shapes.addGeometricShape("Rectangle", { left: ox + p.x, top: oy + p.y, width: Math.max(p.w, 0.1), height: Math.max(p.h, 0.1) });
        s.fill.setSolidColor(p.fill);
        if (p.stroke) s.lineFormat.color = p.stroke;
        else noLine(s);
        s.name = p.role;
        created.push(s);
        break;
      }
      case "line": {
        const dx = p.x2 - p.x1;
        const dy = p.y2 - p.y1;
        let s: PowerPoint.Shape;
        if (dx !== 0 && dy !== 0) {
          // Ukośna linia: pozioma o tej samej długości, obrócona wokół środka.
          const len = Math.hypot(dx, dy);
          const cx = ox + (p.x1 + p.x2) / 2;
          const cy = oy + (p.y1 + p.y2) / 2;
          s = shapes.addLine("Straight", { left: cx - len / 2, top: cy, width: len, height: 0 });
          s.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
        } else {
          s = shapes.addLine("Straight", { left: ox + Math.min(p.x1, p.x2), top: oy + Math.min(p.y1, p.y2), width: Math.abs(dx), height: Math.abs(dy) });
        }
        s.lineFormat.color = p.color;
        s.lineFormat.weight = p.width;
        if (p.dash) s.lineFormat.dashStyle = "Dash";
        s.name = p.role;
        created.push(s);
        break;
      }
      case "marker": {
        const s = shapes.addGeometricShape("Ellipse", { left: ox + p.cx - p.r, top: oy + p.cy - p.r, width: p.r * 2, height: p.r * 2 });
        s.fill.setSolidColor(p.fill);
        s.lineFormat.color = "#FFFFFF";
        s.lineFormat.weight = 1;
        s.name = p.role;
        created.push(s);
        break;
      }
      case "triangle": {
        const s = shapes.addGeometricShape(p.direction === "down" ? "FlowChartMerge" : "Triangle", { left: ox + p.x, top: oy + p.y, width: p.w, height: p.h });
        s.fill.setSolidColor(p.fill);
        noLine(s);
        s.name = p.role;
        created.push(s);
        break;
      }
      case "wedge": {
        const box = { left: ox + p.cx - p.r, top: oy + p.cy - p.r, width: p.r * 2, height: p.r * 2 };
        const full = p.end - p.start >= 359.99;
        let s: PowerPoint.Shape;
        if (p.innerR > 0) {
          s = shapes.addGeometricShape(full ? "Donut" : "BlockArc", box);
          if (full) s.adjustments.set(0, (p.r - p.innerR) / (2 * p.r));
          else {
            s.adjustments.set(0, pptAngle(p.start));
            s.adjustments.set(1, pptAngle(p.end));
            s.adjustments.set(2, (p.r - p.innerR) / (2 * p.r));
          }
        } else if (full) {
          s = shapes.addGeometricShape("Ellipse", box);
        } else {
          s = shapes.addGeometricShape("Pie", box);
          s.adjustments.set(0, pptAngle(p.start));
          s.adjustments.set(1, pptAngle(p.end));
        }
        s.fill.setSolidColor(p.fill);
        s.lineFormat.color = "#FFFFFF";
        s.lineFormat.weight = 1;
        s.name = p.role;
        created.push(s);
        break;
      }
      case "text": {
        const box = { left: ox + p.x, top: oy + p.y, width: Math.max(p.w, 1), height: Math.max(p.h, 1) };
        let s: PowerPoint.Shape;
        if (p.background) {
          s = shapes.addGeometricShape(p.shape === "ellipse" ? "Ellipse" : "Rectangle", box);
          s.fill.setSolidColor(p.background);
          if (p.shape === "ellipse") {
            s.lineFormat.color = "#404040";
            s.lineFormat.weight = 0.75;
          } else noLine(s);
          s.textFrame.textRange.text = p.text;
        } else {
          s = shapes.addTextBox(p.text, box);
        }
        styleText(s, p, fontFamily);
        s.name = p.role;
        created.push(s);
        break;
      }
    }
  }
  return created;
}

function writeTags(shape: PowerPoint.Shape, spec: ChartSpec, layout: StoredLayout): void {
  const json = JSON.stringify(spec);
  const chunks = Math.ceil(json.length / CHUNK);
  shape.tags.add(TAG_MARK, "1");
  shape.tags.add(TAG_SPEC + "N", String(chunks));
  for (let i = 0; i < chunks; i++) shape.tags.add(TAG_SPEC + i, json.slice(i * CHUNK, (i + 1) * CHUNK));
  shape.tags.add(TAG_LAYOUT, JSON.stringify(layout));
}

async function readTags(context: PowerPoint.RequestContext, shape: PowerPoint.Shape): Promise<{ spec: ChartSpec; layout: StoredLayout | null } | null> {
  shape.tags.load("items/key,items/value");
  await context.sync();
  const map = new Map(shape.tags.items.map((t) => [t.key.toUpperCase(), t.value]));
  if (map.get(TAG_MARK) !== "1") return null;
  const n = Number(map.get(TAG_SPEC + "N") ?? 0);
  let json = "";
  for (let i = 0; i < n; i++) json += map.get(TAG_SPEC + i) ?? "";
  try {
    const spec = normalizeSpec(JSON.parse(json));
    if (!spec) return null;
    const layoutRaw = map.get(TAG_LAYOUT);
    return { spec, layout: layoutRaw ? (JSON.parse(layoutRaw) as StoredLayout) : null };
  } catch {
    return null;
  }
}

/** Zwraca zaznaczony wykres (także gdy zaznaczono pojedynczy element wewnątrz grupy). */
export async function getSelectedChart(): Promise<SelectedChart | null> {
  if (!inPowerPoint() || !supports("1.5")) return null;
  return PowerPoint.run(async (context) => {
    const selected = context.presentation.getSelectedShapes();
    selected.load("items/id,items/type");
    await context.sync();
    if (selected.items.length === 0) return null;
    let shape = selected.items[0];
    if (supports("1.8")) {
      shape.load("level");
      await context.sync();
      if (shape.level > 0) {
        shape = shape.parentGroup;
        shape.load("id");
        await context.sync();
      }
    }
    const read = await readTags(context, shape);
    return read ? { shapeId: shape.id, spec: read.spec } : null;
  });
}

function defaultPlacement(slideW: number, slideH: number): { x: number; y: number; w: number; h: number } {
  const w = Math.round(slideW * 0.62);
  const h = Math.round(slideH * 0.62);
  return { x: Math.round((slideW - w) / 2), y: Math.round(slideH * 0.22), w, h };
}

async function slideSize(context: PowerPoint.RequestContext): Promise<Size> {
  if (supports("1.10")) {
    const ps = context.presentation.pageSetup;
    ps.load("slideWidth,slideHeight");
    await context.sync();
    return { width: ps.slideWidth, height: ps.slideHeight };
  }
  return { width: 960, height: 540 };
}

async function targetSlide(context: PowerPoint.RequestContext): Promise<PowerPoint.Slide> {
  const sel = context.presentation.getSelectedSlides();
  sel.load("items/id");
  await context.sync();
  if (sel.items.length > 0) return sel.items[0];
  const first = context.presentation.slides.getItemAt(0);
  return first;
}

async function drawAndGroup(
  context: PowerPoint.RequestContext,
  slide: PowerPoint.Slide,
  spec: ChartSpec,
  area: { x: number; y: number; w: number; h: number },
): Promise<string> {
  const prims = layoutChart(spec, { width: area.w, height: area.h });
  const created = drawPrims(slide.shapes, prims, area.x, area.y, spec.options.fontFamily);
  created.forEach((s) => s.load("id"));
  await context.sync();
  const group = slide.shapes.addGroup(created.map((s) => s.id));
  group.name = "Wykres – " + CHART_TYPE_LABELS[spec.type];
  group.load("id,left,top,width,height");
  await context.sync();
  writeTags(group, spec, { ...area, gx: group.left, gy: group.top, gw: group.width, gh: group.height });
  if (supports("1.5")) slide.setSelectedShapes([group.id]);
  await context.sync();
  return group.id;
}

/** Wstawia wykres jako obraz SVG (gdy wersja PowerPointa nie obsługuje potrzebnych funkcji kształtów). */
async function insertAsImage(spec: ChartSpec, area: { x: number; y: number; w: number; h: number }): Promise<void> {
  const svg = primsToSvg(layoutChart(spec, { width: area.w, height: area.h }), { width: area.w, height: area.h });
  await new Promise<void>((resolve, reject) =>
    Office.context.document.setSelectedDataAsync(
      svg,
      { coercionType: Office.CoercionType.XmlSvg, imageLeft: area.x, imageTop: area.y, imageWidth: area.w, imageHeight: area.h },
      (r) => (r.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(new Error(r.error.message))),
    ),
  );
  if (!supports("1.5")) return;
  await PowerPoint.run(async (context) => {
    const sel = context.presentation.getSelectedShapes();
    sel.load("items/id");
    await context.sync();
    if (sel.items.length === 0) return;
    const img = sel.items[0];
    img.load("left,top,width,height");
    await context.sync();
    writeTags(img, spec, { ...area, gx: img.left, gy: img.top, gw: img.width, gh: img.height });
    await context.sync();
  });
}

export async function insertChart(spec: ChartSpec): Promise<void> {
  const area = await PowerPoint.run(async (context) => {
    const size = await slideSize(context);
    return defaultPlacement(size.width, size.height);
  });
  const prims = layoutChart(spec, { width: area.w, height: area.h });
  if (renderMode(prims) === "image") return insertAsImage(spec, area);
  await PowerPoint.run(async (context) => {
    const slide = await targetSlide(context);
    await drawAndGroup(context, slide, spec, area);
  });
}

/**
 * Przerysowuje istniejący wykres. Jeśli użytkownik zmienił rozmiar lub położenie grupy,
 * obszar układu skaluje się proporcjonalnie – jak przy przeciąganiu ramki w think-cell.
 */
export async function updateChart(shapeId: string, spec: ChartSpec): Promise<void> {
  let imageArea: { x: number; y: number; w: number; h: number } | null = null;
  await PowerPoint.run(async (context) => {
    const sel = context.presentation.getSelectedSlides();
    sel.load("items/id");
    await context.sync();
    const slides = sel.items.length > 0 ? sel.items : [];
    let shape: PowerPoint.Shape | null = null;
    let slide: PowerPoint.Slide | null = null;
    for (const s of slides) {
      const candidate = s.shapes.getItemOrNullObject(shapeId);
      candidate.load("id,left,top,width,height,type");
      await context.sync();
      if (!candidate.isNullObject) {
        shape = candidate;
        slide = s;
        break;
      }
    }
    if (!shape || !slide) throw new Error("Nie znaleziono wykresu na bieżącym slajdzie. Zaznacz go ponownie.");
    const stored = (await readTags(context, shape))?.layout;
    let area = { x: shape.left, y: shape.top, w: shape.width, h: shape.height };
    if (stored && stored.gw > 0 && stored.gh > 0) {
      const sx = shape.width / stored.gw;
      const sy = shape.height / stored.gh;
      area = {
        x: shape.left - (stored.gx - stored.x) * sx,
        y: shape.top - (stored.gy - stored.y) * sy,
        w: stored.w * sx,
        h: stored.h * sy,
      };
    }
    const prims = layoutChart(spec, { width: area.w, height: area.h });
    shape.delete();
    await context.sync();
    if (renderMode(prims) === "image") {
      imageArea = area;
      return;
    }
    await drawAndGroup(context, slide, spec, area);
  });
  if (imageArea) await insertAsImage(spec, imageArea);
}
