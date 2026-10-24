import { newSpec } from "../src/core/data";
import { cagr, layoutChart, niceStep, wrapText } from "../src/core/layout";
import { primsToSvg } from "../src/core/svg";
import type { ChartType, MarkerPrim, Prim, TextPrim } from "../src/core/types";

const size = { width: 480, height: 300 };
const types: ChartType[] = ["column-clustered", "column-stacked", "column-100", "bar-clustered", "bar-stacked", "line", "pie", "doughnut", "waterfall", "scatter"];

const texts = (prims: Prim[], role: string) => prims.filter((p): p is TextPrim => p.kind === "text" && p.role === role).map((p) => p.text);

describe("layoutChart", () => {
  it.each(types)("%s mieści się w obszarze wykresu", (type) => {
    const prims = layoutChart(newSpec(type), size);
    expect(prims.length).toBeGreaterThan(5);
    for (const p of prims) {
      if (p.kind === "rect" || p.kind === "text") {
        expect(p.x).toBeGreaterThanOrEqual(-12);
        expect(p.y).toBeGreaterThanOrEqual(-1);
        expect(p.x + p.w).toBeLessThanOrEqual(size.width + 12);
        expect(p.y + p.h).toBeLessThanOrEqual(size.height + 1);
      }
      for (const v of Object.values(p)) if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
    }
    expect(primsToSvg(prims, size)).toContain("<svg");
  });

  it("skumulowany pokazuje sumy kategorii", () => {
    const prims = layoutChart(newSpec("column-stacked"), size);
    expect(texts(prims, "total-label")).toEqual(["87", "104", "121", "140"]);
  });

  it("kaskadowy liczy sumę 'e'", () => {
    const prims = layoutChart(newSpec("waterfall"), size);
    const labels = texts(prims, "value-label");
    expect(labels[0]).toBe("120");
    expect(labels[3]).toBe("−14");
    expect(labels[4]).toBe("149");
  });

  it("strzałka różnicy i CAGR", () => {
    const spec = newSpec("column-stacked");
    spec.options.diffArrow = { from: 0, to: 3, mode: "percent" };
    spec.options.cagr = { from: 0, to: 3 };
    const labels = texts(layoutChart(spec, size), "arrow-label");
    expect(labels).toEqual(["+61%", "CAGR: +17,2%"]);
  });

  it("strzałka różnicy bezwzględnej w wykresie liniowym liczy pierwszą serię", () => {
    const spec = newSpec("line");
    spec.options.diffArrow = { from: 0, to: 4, mode: "absolute" };
    expect(texts(layoutChart(spec, size), "arrow-label")).toEqual(["+49"]);
  });

  it("kołowy: wycinki sumują się do 360°", () => {
    const wedges = layoutChart(newSpec("pie"), size).filter((p) => p.kind === "wedge");
    expect(wedges).toHaveLength(5);
    const last = wedges[wedges.length - 1];
    expect(last.kind === "wedge" && last.end).toBeCloseTo(360);
  });

  it("pusty arkusz daje komunikat", () => {
    const spec = newSpec("line");
    spec.grid = [[""]];
    expect(texts(layoutChart(spec, size), "empty")).toHaveLength(1);
  });

  it("oś wartości dodaje etykiety", () => {
    const spec = newSpec("column-clustered");
    spec.options.showValueAxis = true;
    expect(texts(layoutChart(spec, size), "axis-label").length).toBeGreaterThan(2);
  });
});

it("niceStep", () => {
  expect(niceStep(100)).toBe(20);
  expect(niceStep(7)).toBe(2);
  expect(niceStep(0)).toBe(1);
});

it("cagr", () => {
  expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
  expect(cagr(0, 10, 2)).toBeNull();
});

it("wrapText łamie i skraca", () => {
  expect(wrapText("Przychody ze sprzedaży krajowej", 60, 12).length).toBeGreaterThan(1);
  expect(wrapText("a b c d e f g h", 5, 12, 2)).toHaveLength(2);
});

describe("wykres punktowy", () => {
  const points = (prims: Prim[]) => prims.filter((p): p is MarkerPrim => p.kind === "marker" && p.role === "point");

  it("wielkość bąbli rośnie z pierwiastkiem wartości", () => {
    const spec = newSpec("scatter");
    spec.grid = [["", "X", "Y", "W", ""], ["a", "1", "1", "100", ""], ["b", "2", "2", "25", ""]];
    const pts = points(layoutChart(spec, size));
    const big = pts.find((p) => p.r === spec.options.scatter.maxBubbleSize)!;
    const small = pts.find((p) => p !== big)!;
    expect(small.r).toBeCloseTo(spec.options.scatter.maxBubbleSize / 2);
    // Większy rysowany jako pierwszy, żeby nie zasłaniał mniejszego.
    expect(pts[0]).toBe(big);
  });

  it("bez skalowania wszystkie kropki mają tę samą wielkość", () => {
    const spec = newSpec("scatter");
    spec.options.scatter.sizeByValue = false;
    const pts = points(layoutChart(spec, size));
    expect(new Set(pts.map((p) => p.r))).toEqual(new Set([spec.options.scatter.markerSize]));
  });

  it("styl kropek zależy od grupy", () => {
    const spec = newSpec("scatter");
    spec.options.scatter.groupStyles = [{ shape: "triangle", filled: false }, { shape: "cross", filled: true }];
    const prims = layoutChart(spec, size);
    const pts = points(prims);
    expect(pts.filter((p) => p.shape === "triangle" && p.hollow)).toHaveLength(3);
    expect(pts.filter((p) => p.shape === "cross" && !p.hollow)).toHaveLength(2);
    expect(pts.filter((p) => p.shape === "circle")).toHaveLength(2);
    expect(texts(prims, "legend-label")).toEqual(["Premium", "Masowy", "Nisza", "Wielkość: Przychody"]);
    expect(texts(prims, "axis-title")).toEqual(["Wzrost r/r", "Udział w rynku"]);
    const svg = primsToSvg(prims, size);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain("<polygon");
  });

  it("kropki mieszczą się między osiami", () => {
    const prims = layoutChart(newSpec("scatter"), size);
    const axes = prims.filter((p) => p.kind === "line" && p.role === "value-axis");
    const left = Math.min(...axes.map((a) => (a.kind === "line" ? a.x1 : 0)));
    for (const p of points(prims)) {
      expect(p.cx - p.r).toBeGreaterThanOrEqual(left - 0.01);
      expect(p.cx + p.r).toBeLessThanOrEqual(size.width);
    }
  });

  it("pusty arkusz punktów daje komunikat", () => {
    const spec = newSpec("scatter");
    spec.grid = [["Etykieta", "X", "Y"], ["a", "", "1"]];
    expect(texts(layoutChart(spec, size), "empty")).toHaveLength(1);
  });
});
