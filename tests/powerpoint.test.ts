// Testy warstwy PowerPoint na atrapie modelu obiektowego Office.js.
import { newSpec } from "../src/core/data";
import { getSelectedChart, insertChart, updateChart } from "../src/office/powerpoint";

let nextId = 1;

class FakeShape {
  id = String(nextId++);
  name = "";
  rotation = 0;
  level = 0;
  parentGroup: FakeShape | null = null;
  children: FakeShape[] = [];
  deleted = false;
  fillColor: string | null = null;
  adjust: number[] = [];
  tagMap = new Map<string, string>();
  fill = { setSolidColor: (c: string) => (this.fillColor = c) };
  lineFormat: Record<string, unknown> = {};
  textFrame = { textRange: { text: "", font: {} as Record<string, unknown>, paragraphFormat: {} as Record<string, unknown> } } as Record<string, unknown> & {
    textRange: { text: string; font: Record<string, unknown>; paragraphFormat: Record<string, unknown> };
  };
  adjustments = { set: (i: number, v: number) => (this.adjust[i] = v) };
  tags = {
    items: [] as { key: string; value: string }[],
    add: (k: string, v: string) => this.tagMap.set(k.toUpperCase(), v),
    load: () => {
      this.tags.items = [...this.tagMap].map(([key, value]) => ({ key, value }));
    },
  };
  isNullObject = false;
  constructor(
    public type: string,
    public left: number,
    public top: number,
    public width: number,
    public height: number,
  ) {}
  load() {
    return this;
  }
  delete() {
    this.deleted = true;
    this.children.forEach((c) => (c.deleted = true));
  }
}

class FakeSlide {
  shapes: FakeShape[] = [];
  selected: string[] = [];
  shapesApi = {
    addGeometricShape: (type: string, o: { left: number; top: number; width: number; height: number }) => this.push(new FakeShape(type, o.left, o.top, o.width, o.height)),
    addLine: (_t: string, o: { left: number; top: number; width: number; height: number }) => this.push(new FakeShape("Line", o.left, o.top, o.width, o.height)),
    addTextBox: (text: string, o: { left: number; top: number; width: number; height: number }) => {
      const s = this.push(new FakeShape("TextBox", o.left, o.top, o.width, o.height));
      s.textFrame.textRange.text = text;
      return s;
    },
    addGroup: (ids: string[]) => {
      const kids = this.shapes.filter((s) => ids.includes(s.id));
      const l = Math.min(...kids.map((k) => k.left));
      const t = Math.min(...kids.map((k) => k.top));
      const r = Math.max(...kids.map((k) => k.left + k.width));
      const b = Math.max(...kids.map((k) => k.top + k.height));
      const g = this.push(new FakeShape("Group", l, t, r - l, b - t));
      g.children = kids;
      kids.forEach((k) => {
        k.level = 1;
        k.parentGroup = g;
      });
      return g;
    },
    getItemOrNullObject: (id: string) => this.shapes.find((s) => s.id === id && !s.deleted) ?? Object.assign(new FakeShape("x", 0, 0, 0, 0), { isNullObject: true }),
  };
  push(s: FakeShape) {
    this.shapes.push(s);
    return s;
  }
  setSelectedShapes(ids: string[]) {
    this.selected = ids;
  }
  get live() {
    return this.shapes.filter((s) => !s.deleted);
  }
}

let slide: FakeSlide;
let api = 10; // najwyższa obsługiwana wersja PowerPointApi 1.x
let svgInserted: string | null = null;

function install() {
  slide = new FakeSlide();
  const slideObj = { id: "s1", shapes: slide.shapesApi, setSelectedShapes: (ids: string[]) => slide.setSelectedShapes(ids) };
  const context = {
    sync: async () => undefined,
    presentation: {
      pageSetup: { load: () => undefined, slideWidth: 960, slideHeight: 540 },
      getSelectedSlides: () => ({ load: () => undefined, items: [slideObj] }),
      getSelectedShapes: () => ({ load: () => undefined, items: slide.selected.map((id) => slide.shapes.find((s) => s.id === id)).filter(Boolean) }),
      slides: { getItemAt: () => slideObj },
    },
  };
  Object.assign(globalThis, {
    Office: {
      HostType: { PowerPoint: "PowerPoint" },
      CoercionType: { XmlSvg: "xmlSvg" },
      AsyncResultStatus: { Succeeded: "succeeded" },
      context: {
        host: "PowerPoint",
        requirements: { isSetSupported: (_n: string, v: string) => Number(v.split(".")[1]) <= api },
        document: {
          setSelectedDataAsync: (data: string, o: { imageLeft: number; imageTop: number; imageWidth: number; imageHeight: number }, cb: (r: unknown) => void) => {
            svgInserted = data;
            const img = slide.push(new FakeShape("Image", o.imageLeft, o.imageTop, o.imageWidth, o.imageHeight));
            slide.selected = [img.id];
            cb({ status: "succeeded" });
          },
        },
      },
    },
    PowerPoint: { run: (cb: (c: unknown) => unknown) => cb(context) },
  });
}

beforeEach(() => {
  api = 10;
  svgInserted = null;
  install();
});

describe("PowerPoint", () => {
  it("wstawia wykres jako zgrupowane kształty z definicją w tagach", async () => {
    const spec = newSpec("column-stacked");
    await insertChart(spec);
    const group = slide.live.find((s) => s.type === "Group")!;
    expect(group).toBeDefined();
    expect(group.children.length).toBeGreaterThan(20);
    expect(group.name).toBe("Wykres – Kolumnowy skumulowany");
    expect(slide.selected).toEqual([group.id]);
    expect(group.tagMap.get("MKCHART")).toBe("1");

    const read = await getSelectedChart();
    expect(read?.shapeId).toBe(group.id);
    expect(read?.spec).toEqual(spec);

    // Zaznaczenie pojedynczego elementu w grupie też odnajduje wykres.
    slide.selected = [group.children[0].id];
    expect((await getSelectedChart())?.shapeId).toBe(group.id);
  });

  it("długa definicja dzieli się na kilka tagów", async () => {
    const spec = newSpec("column-clustered");
    spec.grid = [["", ...Array.from({ length: 200 }, (_, i) => `Kategoria numer ${i}`)], ["S", ...Array.from({ length: 200 }, (_, i) => String(i))]];
    await insertChart(spec);
    const group = slide.live.find((s) => s.type === "Group")!;
    expect(Number(group.tagMap.get("MKSPECN"))).toBeGreaterThan(1);
    expect((await getSelectedChart())?.spec).toEqual(spec);
  });

  it("aktualizacja po powiększeniu grupy skaluje układ", async () => {
    const spec = newSpec("column-stacked");
    await insertChart(spec);
    const group = slide.live.find((s) => s.type === "Group")!;
    const before = group.width;
    group.width *= 1.5;
    spec.options.showLegend = false;
    await updateChart(group.id, spec);
    expect(group.deleted).toBe(true);
    const fresh = slide.live.find((s) => s.type === "Group")!;
    expect(fresh.id).not.toBe(group.id);
    expect(fresh.width).toBeGreaterThan(before * 1.4);
    const oldArea = JSON.parse(group.tagMap.get("MKLAYOUT")!);
    const newArea = JSON.parse(fresh.tagMap.get("MKLAYOUT")!);
    expect(newArea.x).toBeCloseTo(oldArea.x, 3);
    expect(newArea.w).toBeCloseTo(oldArea.w * 1.5, 3);
  });

  it("wykres kołowy ustawia kąty wycinków", async () => {
    await insertChart(newSpec("pie"));
    const pies = slide.live.filter((s) => s.type === "Pie");
    expect(pies).toHaveLength(5);
    expect(pies[0].adjust[0]).toBe(270);
  });

  it("starszy PowerPoint dostaje wykres kołowy jako obraz", async () => {
    api = 8;
    await insertChart(newSpec("pie"));
    expect(svgInserted).toContain("<svg");
    const img = slide.live.find((s) => s.type === "Image")!;
    expect(img.tagMap.get("MKCHART")).toBe("1");
  });

  it("ukośne linie wykresu liniowego są obracane", async () => {
    await insertChart(newSpec("line"));
    const lines = slide.live.filter((s) => s.type === "Line" && s.name === "series-line");
    expect(lines).toHaveLength(8);
    expect(lines.every((l) => l.rotation < 0)).toBe(true);
  });
});
