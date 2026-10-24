import { useRef } from "react";
import { parseClipboardTable } from "../core/data";
import { transpose } from "../office/excel";
import type { ChartType } from "../core/types";

interface Props {
  grid: string[][];
  type: ChartType;
  onChange: (grid: string[][]) => void;
}

function padColumns(grid: string[][], width: number): string[][] {
  return grid.map((r) => (r.length >= width ? r : [...r, ...Array(width - r.length).fill("")]));
}

const SCATTER_COLUMNS = ["Etykieta", "X", "Y", "Wielkość", "Grupa"];

function normalize(grid: string[][]): string[][] {
  const width = Math.max(2, ...grid.map((r) => r.length));
  const rows = grid.length < 2 ? [...grid, ...Array(2 - grid.length).fill([])] : grid;
  return rows.map((r) => [...r, ...Array(width - r.length).fill("")]);
}

export function DataSheet({ grid, type, onChange }: Props) {
  const g = type === "scatter" ? padColumns(normalize(grid), 5) : normalize(grid);
  const tableRef = useRef<HTMLTableElement>(null);
  const singleSeries = type === "pie" || type === "doughnut" || type === "waterfall";
  const scatter = type === "scatter";

  const setCell = (r: number, c: number, value: string) => {
    const next = g.map((row) => [...row]);
    next[r][c] = value;
    onChange(next);
  };

  const onPaste = (r: number, c: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const block = parseClipboardTable(text);
    const next = g.map((row) => [...row]);
    block.forEach((row, i) =>
      row.forEach((value, j) => {
        while (next.length <= r + i) next.push(Array(next[0].length).fill(""));
        for (const nr of next) while (nr.length <= c + j) nr.push("");
        next[r + i][c + j] = value;
      }),
    );
    onChange(next);
  };

  const focusCell = (r: number, c: number) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`);
    el?.focus();
    el?.select();
  };

  const onKeyDown = (r: number, c: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusCell(e.shiftKey ? r - 1 : r + 1, c);
    } else if (e.key === "ArrowDown") focusCell(r + 1, c);
    else if (e.key === "ArrowUp") focusCell(r - 1, c);
  };

  const addRow = () => onChange([...g, Array(g[0].length).fill("")]);
  const addCol = () => onChange(g.map((row) => [...row, ""]));
  const removeRow = () => g.length > 2 && onChange(g.slice(0, -1));
  const removeCol = () => g[0].length > 2 && onChange(g.map((row) => row.slice(0, -1)));

  return (
    <div>
      <div className="sheet-wrap">
        <table className="sheet" ref={tableRef}>
          <tbody>
            {g.map((row, r) => (
              <tr key={r} className={r === 0 ? "head" : singleSeries && r > 1 ? "unused" : ""}>
                {row.map((cell, c) => (
                  <td key={c} className={c === 0 ? "first" : ""}>
                    <input
                      data-r={r}
                      data-c={c}
                      value={cell}
                      aria-label={scatter ? (r === 0 ? `Nagłówek ${SCATTER_COLUMNS[c] ?? c + 1}` : `${SCATTER_COLUMNS[c] ?? "Kolumna"}, punkt ${r}`) : r === 0 ? `Kategoria ${c}` : c === 0 ? `Seria ${r}` : `Wartość ${r},${c}`}
                      placeholder={scatter ? (r === 0 ? SCATTER_COLUMNS[c] ?? "" : "") : r === 0 && c === 0 ? "" : r === 0 ? "Kategoria" : c === 0 ? "Seria" : ""}
                      disabled={!scatter && r === 0 && c === 0}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onPaste={(e) => onPaste(r, c, e)}
                      onKeyDown={(e) => onKeyDown(r, c, e)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-actions">
        <button type="button" onClick={addRow}>{scatter ? "+ Punkt" : "+ Seria"}</button>
        {!scatter && <button type="button" onClick={addCol}>+ Kategoria</button>}
        <button type="button" onClick={removeRow} disabled={g.length <= 2}>{scatter ? "− Punkt" : "− Seria"}</button>
        {!scatter && (
          <>
            <button type="button" onClick={removeCol} disabled={g[0].length <= 2}>− Kategoria</button>
            <button type="button" onClick={() => onChange(transpose(g))} title="Zamień wiersze z kolumnami">⇄ Transponuj</button>
          </>
        )}
      </div>
      <p className="hint">
        Skopiuj zakres w Excelu i wklej go (Ctrl+V) w dowolną komórkę.
        {scatter && " Kolumny: etykieta, X, Y, wielkość (opcjonalnie), grupa (opcjonalnie). W pierwszym wierszu wpisz nazwy – staną się tytułami osi."}
        {singleSeries && " Ten typ używa tylko pierwszej serii."}
        {type === "waterfall" && " Wpisz „e” tam, gdzie ma być suma (obliczy się sama)."}
      </p>
    </div>
  );
}
