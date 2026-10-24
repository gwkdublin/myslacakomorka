import type { MarkerShape, MarkerStyle, ScatterOptions } from "./types";

export const MARKER_SHAPES: { id: MarkerShape; name: string }[] = [
  { id: "circle", name: "Okrąg" },
  { id: "triangle", name: "Trójkąt" },
  { id: "square", name: "Kwadrat" },
  { id: "cross", name: "Krzyżyk" },
  { id: "diamond", name: "Romb" },
  { id: "hexagon", name: "Sześciokąt" },
];

export function markerStyleFor(scatter: ScatterOptions, group: number): MarkerStyle {
  return scatter.groupStyles[group] ?? { shape: "circle", filled: true };
}

/** Rozmiar ramki kształtu o „promieniu” r – dobrany tak, by różne kształty miały podobną wagę wizualną. */
export function markerBox(shape: MarkerShape, r: number): { w: number; h: number } {
  switch (shape) {
    case "circle":
      return { w: 2 * r, h: 2 * r };
    case "square":
      return { w: 1.8 * r, h: 1.8 * r };
    case "triangle":
      return { w: 2.2 * r, h: 2 * r };
    case "diamond":
      return { w: 2.3 * r, h: 2.3 * r };
    case "hexagon":
      return { w: 2.2 * r, h: 1.95 * r };
    case "cross":
      return { w: 2.2 * r, h: 2.2 * r };
  }
}

/** Wierzchołki wielokąta w układzie ramki 0–1 (jak odpowiednie kształty PowerPointa). */
export function markerPolygon(shape: Exclude<MarkerShape, "circle">): [number, number][] {
  switch (shape) {
    case "square":
      return [[0, 0], [1, 0], [1, 1], [0, 1]];
    case "triangle":
      return [[0.5, 0], [1, 1], [0, 1]];
    case "diamond":
      return [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
    case "hexagon":
      return [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]];
    case "cross": {
      // Znak „×”: krzyż „+” o ramionach szerokości 0.3 obrócony o 45°.
      const a = 0.15;
      const plus: [number, number][] = [[-a, -0.5], [a, -0.5], [a, -a], [0.5, -a], [0.5, a], [a, a], [a, 0.5], [-a, 0.5], [-a, a], [-0.5, a], [-0.5, -a], [-a, -a]];
      const c = Math.SQRT1_2;
      return plus.map(([x, y]) => [0.5 + (x - y) * c, 0.5 + (x + y) * c]);
    }
  }
}
