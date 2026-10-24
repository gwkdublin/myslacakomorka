import { useRef, useState } from "react";
import { extractRange, formatRange, parseRange, readWorkbook, transpose, usedRange, type WorkbookSheet } from "../office/excel";
import type { ExcelLink } from "../core/types";

interface Props {
  link: ExcelLink | null;
  onImport: (grid: string[][], link: ExcelLink) => void;
  onUnlink: () => void;
}

interface Pending {
  fileName: string;
  sheets: WorkbookSheet[];
  sheet: string;
  range: string;
  transposed: boolean;
}

function gridFrom(sheets: WorkbookSheet[], sheetName: string, rangeText: string, transposed: boolean): string[][] {
  const sheet = sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`W pliku nie ma arkusza „${sheetName}”.`);
  const range = rangeText.trim() ? parseRange(rangeText) : usedRange(sheet.rows);
  if (!range) throw new Error(rangeText.trim() ? `Niepoprawny zakres „${rangeText}”. Użyj zapisu np. B2:F6.` : "Arkusz jest pusty.");
  const grid = extractRange(sheet.rows, range);
  return transposed ? transpose(grid) : grid;
}

export function ExcelImport({ link, onImport, onUnlink }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const purpose = useRef<"import" | "refresh">("import");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (p: "import" | "refresh") => {
    purpose.current = p;
    setError(null);
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const sheets = await readWorkbook(file);
      if (purpose.current === "refresh" && link) {
        const grid = gridFrom(sheets, link.sheet, link.range, !!link.transposed);
        onImport(grid, { ...link, fileName: file.name, linkedAt: new Date().toISOString() });
        if (file.name !== link.fileName) setError(`Uwaga: wybrano plik „${file.name}”, a wykres był połączony z „${link.fileName}”. Dane wczytano z nowego pliku.`);
      } else {
        const first = sheets[0];
        const used = first ? usedRange(first.rows) : null;
        setPending({ fileName: file.name, sheets, sheet: first?.name ?? "", range: used ? formatRange(used) : "", transposed: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się odczytać pliku. Obsługiwany jest format .xlsx.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirm = () => {
    if (!pending) return;
    try {
      const grid = gridFrom(pending.sheets, pending.sheet, pending.range, pending.transposed);
      const newLink: ExcelLink = {
        fileName: pending.fileName,
        sheet: pending.sheet,
        range: pending.range,
        linkedAt: new Date().toISOString(),
        transposed: pending.transposed,
      };
      onImport(grid, newLink);
      setPending(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const selectSheet = (name: string) => {
    if (!pending) return;
    const s = pending.sheets.find((x) => x.name === name);
    const used = s ? usedRange(s.rows) : null;
    setPending({ ...pending, sheet: name, range: used ? formatRange(used) : "" });
  };

  return (
    <div className="excel">
      <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {link && !pending && (
        <div className="link-box">
          <div>
            <strong>Połączono z Excelem</strong>
            <div className="muted">
              {link.fileName} · {link.sheet} · {link.range || "cały arkusz"}
            </div>
            <div className="muted">Ostatnio wczytano: {new Date(link.linkedAt).toLocaleString("pl-PL")}</div>
          </div>
          <div className="row-actions">
            <button type="button" className="primary-outline" onClick={() => pick("refresh")} disabled={busy}>
              ⟳ Odśwież z Excela
            </button>
            <button type="button" onClick={onUnlink}>Odłącz</button>
          </div>
        </div>
      )}
      {!pending && (
        <button type="button" onClick={() => pick("import")} disabled={busy}>
          {busy ? "Wczytywanie…" : link ? "Połącz z innym zakresem…" : "Importuj z pliku Excel (.xlsx)…"}
        </button>
      )}
      {pending && (
        <div className="link-box">
          <strong>{pending.fileName}</strong>
          <div className="field-row">
            <label>
              Arkusz
              <select value={pending.sheet} onChange={(e) => selectSheet(e.target.value)}>
                {pending.sheets.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>
              Zakres
              <input type="text" value={pending.range} placeholder="np. B2:F6" onChange={(e) => setPending({ ...pending, range: e.target.value })} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={pending.transposed} onChange={(e) => setPending({ ...pending, transposed: e.target.checked })} />
            Serie są w kolumnach (zamień wiersze z kolumnami)
          </label>
          <div className="row-actions">
            <button type="button" className="primary" onClick={confirm}>
              Wczytaj dane
            </button>
            <button type="button" onClick={() => setPending(null)}>Anuluj</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
