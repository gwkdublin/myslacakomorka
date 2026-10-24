import { newSpec } from "../src/core/data";
import { cagr, layoutChart, niceStep, wrapText } from "../src/core/layout";
import { primsToSvg } from "../src/core/svg";
import type { ChartType, Prim, TextPrim } from "../src/core/types";

const size = { width: 480, height: 300 };
const types: ChartType[] = ["column-clustered", "column-stacked", "column-100", "bar-clustered", "bar-stacked", "line", "pie", "doughnut", "waterfall"];

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
