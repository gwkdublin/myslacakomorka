/* Import danych z pliku Excel (.xlsx) do arkusza danych wykresu. */
import readXlsxFile from "read-excel-file/browser";

export interface WorkbookSheet {
  name: string;
  rows: string[][];
}

export interface CellRange {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e9) / 1e9);
  if (typeof v === "boolean") return v ? "PRAWDA" : "FAŁSZ";
  return String(v);
}

export async function readWorkbook(file: File | Blob): Promise<WorkbookSheet[]> {
  const sheets = await readXlsxFile(file);
  return sheets.map((s) => ({ name: s.sheet, rows: s.data.map((row) => row.map(cellToString)) }));
}

function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function columnName(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Parsuje zakres w notacji A1 ("B2:F6", "$B$2:$F$6" lub pojedyncza komórka). Zwraca null dla błędnego zapisu. */
export function parseRange(text: string): CellRange | null {
  const m = text.trim().replace(/\$/g, "").match(/^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/);
  if (!m) return null;
  const a = { c: columnIndex(m[1]), r: Number(m[2]) - 1 };
  const b = m[3] ? { c: columnIndex(m[3]), r: Number(m[4]) - 1 } : a;
  if (a.r < 0 || b.r < 0) return null;
  return { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
}

export function formatRange(r: CellRange): string {
  return `${columnName(r.c0)}${r.r0 + 1}:${columnName(r.c1)}${r.r1 + 1}`;
}

/** Najmniejszy prostokąt obejmujący niepuste komórki. */
export function usedRange(rows: string[][]): CellRange | null {
  let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
  rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.trim() === "") return;
      r0 = Math.min(r0, r);
      c0 = Math.min(c0, c);
      r1 = Math.max(r1, r);
      c1 = Math.max(c1, c);
    }),
  );
  return r1 < 0 ? null : { r0, c0, r1, c1 };
}

export function extractRange(rows: string[][], range: CellRange): string[][] {
  const out: string[][] = [];
  for (let r = range.r0; r <= range.r1; r++) {
    const row: string[] = [];
    for (let c = range.c0; c <= range.c1; c++) row.push(rows[r]?.[c] ?? "");
    out.push(row);
  }
  return out;
}

/** Zamienia wiersze z kolumnami (gdy w Excelu kategorie są w wierszach, a serie w kolumnach). */
export function transpose(grid: string[][]): string[][] {
  const width = Math.max(0, ...grid.map((r) => r.length));
  return Array.from({ length: width }, (_, c) => grid.map((row) => row[c] ?? ""));
}
