// Model danych wykresu. Wszystkie wymiary w punktach (1 pt = 1/72 cala), tak jak w PowerPoincie.

export type ChartType =
  | "column-clustered"
  | "column-stacked"
  | "column-100"
  | "bar-clustered"
  | "bar-stacked"
  | "line"
  | "pie"
  | "doughnut"
  | "waterfall"
  | "scatter";

export interface NumberFormat {
  decimals: number;
  /** Tekst doklejany do liczby, np. "%", " mln". */
  suffix: string;
  decimalSeparator: "," | ".";
  /** Separator tysięcy; pusty ciąg wyłącza grupowanie. */
  thousandsSeparator: string;
}

export interface ArrowSpec {
  /** Indeks kategorii początkowej (0 = pierwsza kolumna danych). */
  from: number;
  /** Indeks kategorii końcowej. */
  to: number;
}

export interface DiffArrowSpec extends ArrowSpec {
  mode: "absolute" | "percent";
}

export interface ExcelLink {
  fileName: string;
  sheet: string;
  /** Zakres w notacji A1, np. "B2:F6". Pusty = cały użyty obszar arkusza. */
  range: string;
  /** Serie w kolumnach arkusza – dane są transponowane przy wczytywaniu. */
  transposed?: boolean;
  linkedAt: string;
}

export type MarkerShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "cross";

export interface MarkerStyle {
  shape: MarkerShape;
  /** true = kształt pełny (solid), false = tylko obrys (hollow). */
  filled: boolean;
}

export interface ScatterOptions {
  /** Wielkość kropek proporcjonalna do kolumny „Wielkość” (wykres bąbelkowy). */
  sizeByValue: boolean;
  /** Promień kropki bez skalowania (pt). */
  markerSize: number;
  /** Promień największego bąbla (pt). */
  maxBubbleSize: number;
  /** Styl kropek dla kolejnych grup (wg kolejności pojawienia się w danych). */
  groupStyles: MarkerStyle[];
}

export interface ChartOptions {
  paletteId: string;
  /** Kolory własnej palety (hex), zapisywane razem z wykresem. */
  customColors: string[];
  showValueLabels: boolean;
  showTotals: boolean;
  showLegend: boolean;
  showValueAxis: boolean;
  /** Odstęp między kategoriami jako ułamek szerokości kategorii (0–0.9). */
  gap: number;
  fontSize: number;
  fontFamily: string;
  format: NumberFormat;
  diffArrow: DiffArrowSpec | null;
  cagr: ArrowSpec | null;
  scatter: ScatterOptions;
}

export interface ChartSpec {
  version: 1;
  type: ChartType;
  /**
   * Arkusz danych jak w think-cell: wiersz 0 to nazwy kategorii (od kolumny 1),
   * kolumna 0 to nazwy serii (od wiersza 1), reszta to wartości jako tekst.
   * W wykresie kaskadowym wartość "e" oznacza sumę (obliczaną automatycznie).
   * Wykres punktowy ma inny układ: wiersz 0 to nagłówki, a każdy kolejny wiersz to punkt
   * (etykieta, X, Y, wielkość, grupa).
   */
  grid: string[][];
  options: ChartOptions;
  excelLink: ExcelLink | null;
}

export interface Size {
  width: number;
  height: number;
}

// Prymitywy graficzne zwracane przez silnik układu. Renderery (PowerPoint, SVG) tylko je rysują.

export type TextAlign = "left" | "center" | "right";
export type TextVAlign = "top" | "middle" | "bottom";

export interface RectPrim {
  kind: "rect";
  role: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke?: string;
}

export interface LinePrim {
  kind: "line";
  role: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  dash?: boolean;
}

export interface TextPrim {
  kind: "text";
  role: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  size: number;
  color: string;
  align: TextAlign;
  valign: TextVAlign;
  bold?: boolean;
  /** Tło etykiety (np. owal strzałki CAGR). */
  background?: string;
  shape?: "rect" | "ellipse";
}

export interface WedgePrim {
  kind: "wedge";
  role: string;
  cx: number;
  cy: number;
  r: number;
  /** Promień wewnętrzny; 0 dla wykresu kołowego. */
  innerR: number;
  /** Kąty w stopniach, zgodnie z ruchem wskazówek zegara, 0 = godzina 12. */
  start: number;
  end: number;
  fill: string;
}

export interface TrianglePrim {
  kind: "triangle";
  role: string;
  x: number;
  y: number;
  w: number;
  h: number;
  direction: "up" | "down";
  fill: string;
}

export interface MarkerPrim {
  kind: "marker";
  role: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  shape?: MarkerShape;
  /** Pusty środek: kolor `fill` służy wtedy jako kolor obrysu. */
  hollow?: boolean;
}

export type Prim = RectPrim | LinePrim | TextPrim | WedgePrim | TrianglePrim | MarkerPrim;

export interface ChartData {
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
  /** Tylko wykres kaskadowy: kategorie oznaczone "e" (suma). */
  totals: boolean[];
}
