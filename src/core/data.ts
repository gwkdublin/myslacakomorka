import type { ChartData, ChartOptions, ChartSpec, ChartType, NumberFormat } from "./types";

/** Zamienia tekst komórki na liczbę. Akceptuje przecinek i kropkę dziesiętną, spacje, %, nawiasy księgowe. */
export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/[\s  ]/g, "");
  if (s === "" || s === "-") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/%$/, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Separator dziesiętny to ten, który występuje jako ostatni.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function isTotalMarker(raw: string): boolean {
  return raw.trim().toLowerCase() === "e";
}

export function gridToData(grid: string[][]): ChartData {
  const header = grid[0] ?? [];
  const categories = header.slice(1).map((c) => c.trim());
  const rows = grid.slice(1).filter((row) => row.some((cell, i) => i > 0 && cell.trim() !== "") || (row[0] ?? "").trim() !== "");
  const totals = categories.map((_, ci) => rows.length > 0 && isTotalMarker(rows[0][ci + 1] ?? ""));
  const series = rows.map((row, ri) => ({
    name: (row[0] ?? "").trim() || `Seria ${ri + 1}`,
    values: categories.map((_, ci) => parseNumber(row[ci + 1] ?? "")),
  }));
  // Usuń puste kategorie z końca (np. po wklejeniu z Excela z dodatkową kolumną).
  let n = categories.length;
  while (n > 0 && categories[n - 1] === "" && series.every((s) => s.values[n - 1] === null) && !totals[n - 1]) n--;
  return {
    categories: categories.slice(0, n),
    series: series.map((s) => ({ ...s, values: s.values.slice(0, n) })),
    totals: totals.slice(0, n),
  };
}

/** Parsuje tekst skopiowany z Excela (wartości rozdzielone tabulatorami, wiersze nowymi liniami). */
export function parseClipboardTable(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const rows = lines.map((line) => line.split("\t"));
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
}

export function formatNumber(value: number, fmt: NumberFormat): string {
  const fixed = Math.abs(value).toFixed(Math.max(0, Math.min(6, fmt.decimals)));
  const [intPart, fracPart] = fixed.split(".");
  const grouped = fmt.thousandsSeparator
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandsSeparator)
    : intPart;
  const sign = value < 0 && Number(fixed) !== 0 ? "−" : "";
  return sign + grouped + (fracPart ? fmt.decimalSeparator + fracPart : "") + fmt.suffix;
}

export function formatSigned(value: number, fmt: NumberFormat): string {
  const body = formatNumber(value, fmt);
  return value > 0 ? "+" + body : body;
}

export function defaultOptions(): ChartOptions {
  return {
    paletteId: "business",
    customColors: ["#1F3B73", "#2E6FB7", "#6FA8DC", "#F2A93B", "#5B6770"],
    showValueLabels: true,
    showTotals: true,
    showLegend: true,
    showValueAxis: false,
    gap: 0.35,
    fontSize: 12,
    fontFamily: "",
    format: { decimals: 0, suffix: "", decimalSeparator: ",", thousandsSeparator: " " },
    diffArrow: null,
    cagr: null,
  };
}

export function sampleGrid(type: ChartType): string[][] {
  switch (type) {
    case "waterfall":
      return [
        ["", "Przychody 2025", "Cena", "Wolumen", "Koszty", "Przychody 2026"],
        ["Zmiana", "120", "18", "25", "-14", "e"],
      ];
    case "pie":
    case "doughnut":
      return [
        ["", "Polska", "Niemcy", "Czechy", "Słowacja", "Inne"],
        ["Udział", "42", "27", "14", "9", "8"],
      ];
    case "line":
      return [
        ["", "2021", "2022", "2023", "2024", "2025"],
        ["Rynek", "100", "112", "121", "135", "149"],
        ["Firma", "40", "48", "57", "64", "78"],
      ];
    default:
      return [
        ["", "2022", "2023", "2024", "2025"],
        ["Produkt A", "45", "52", "61", "70"],
        ["Produkt B", "30", "34", "36", "41"],
        ["Produkt C", "12", "18", "24", "29"],
      ];
  }
}

export function newSpec(type: ChartType): ChartSpec {
  const options = defaultOptions();
  if (type === "column-100") options.format.suffix = "%";
  return { version: 1, type, grid: sampleGrid(type), options, excelLink: null };
}

/** Uzupełnia spec odczytany z prezentacji o pola dodane w nowszych wersjach. */
export function normalizeSpec(raw: unknown): ChartSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ChartSpec>;
  if (!Array.isArray(r.grid) || typeof r.type !== "string") return null;
  const defaults = defaultOptions();
  return {
    version: 1,
    type: r.type as ChartType,
    grid: r.grid.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : [])),
    options: { ...defaults, ...(r.options ?? {}), format: { ...defaults.format, ...(r.options?.format ?? {}) } },
    excelLink: r.excelLink ?? null,
  };
}
