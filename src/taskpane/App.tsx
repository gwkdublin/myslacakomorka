import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gridToData, newSpec, sampleGrid } from "../core/data";
import { CHART_TYPE_LABELS, layoutChart } from "../core/layout";
import { primsToSvg } from "../core/svg";
import type { ChartSpec, ChartType } from "../core/types";
import { getSelectedChart, inPowerPoint, insertChart, updateChart } from "../office/powerpoint";
import { DataSheet } from "./DataSheet";
import { ExcelImport } from "./ExcelImport";
import { OptionsPanel } from "./OptionsPanel";
import { PalettePicker } from "./PalettePicker";
import { TypePicker } from "./TypePicker";
import { loadDefaults, saveDefaults } from "./storage";

const PREVIEW = { width: 480, height: 290 };

function initialSpec(): ChartSpec {
  const spec = newSpec("column-stacked");
  const d = loadDefaults();
  if (d) spec.options = { ...spec.options, paletteId: d.paletteId, customColors: d.customColors };
  return spec;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function App() {
  const [spec, setSpec] = useState<ChartSpec>(initialSpec);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const office = inPowerPoint();
  const writing = useRef(false);
  const dirty = useRef(false);
  const specRef = useRef(spec);
  specRef.current = spec;

  // Zaznaczenie wykresu na slajdzie wczytuje jego dane do panelu.
  const syncSelection = useCallback(async () => {
    if (writing.current) return;
    try {
      const sel = await getSelectedChart();
      if (sel) {
        setSelectedId(sel.shapeId);
        if (JSON.stringify(sel.spec) !== JSON.stringify(specRef.current)) {
          dirty.current = false;
          setSpec(sel.spec);
        }
      } else setSelectedId(null);
    } catch {
      setSelectedId(null);
    }
  }, []);

  useEffect(() => {
    if (!office) return;
    syncSelection();
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, syncSelection);
    return () => {
      Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler: syncSelection });
    };
  }, [office, syncSelection]);

  const change = (next: ChartSpec) => {
    dirty.current = true;
    setSpec(next);
  };

  const run = async (action: () => Promise<void>, okText: string) => {
    setBusy(true);
    writing.current = true;
    try {
      await action();
      setStatus({ kind: "ok", text: okText });
      saveDefaults({ paletteId: specRef.current.options.paletteId, customColors: specRef.current.options.customColors });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      writing.current = false;
      setBusy(false);
      await syncSelection();
    }
  };

  const onInsert = () => run(() => insertChart(spec), "Wykres wstawiony. Zaznacz go na slajdzie, aby edytować.");
  const onUpdate = useCallback(
    () => (selectedId ? run(() => updateChart(selectedId, specRef.current), "Wykres zaktualizowany.") : Promise.resolve()),
    [selectedId],
  );

  // Automatyczna aktualizacja zaznaczonego wykresu po chwili bez zmian.
  useEffect(() => {
    if (!office || !selectedId || !autoUpdate || !dirty.current) return;
    const t = window.setTimeout(() => {
      dirty.current = false;
      onUpdate();
    }, 700);
    return () => window.clearTimeout(t);
  }, [spec, selectedId, autoUpdate, office, onUpdate]);

  const categories = useMemo(() => gridToData(spec.grid).categories, [spec.grid]);
  const svg = useMemo(() => primsToSvg(layoutChart(spec, PREVIEW), PREVIEW), [spec]);

  const setType = (type: ChartType) => {
    const next = { ...spec, type };
    // Przy zmianie typu z/na kaskadowy podmień przykładowe dane, jeśli użytkownik ich nie zmieniał.
    const isSample = (["column-stacked", "waterfall", "pie", "line"] as ChartType[]).some((t) => JSON.stringify(sampleGrid(t)) === JSON.stringify(spec.grid));
    if (isSample && JSON.stringify(sampleGrid(type)) !== JSON.stringify(spec.grid)) {
      next.grid = sampleGrid(type);
      next.options = { ...next.options, diffArrow: null, cagr: null };
    }
    if (type === "column-100" && spec.type !== "column-100" && !spec.options.format.suffix) next.options = { ...spec.options, format: { ...spec.options.format, suffix: "%" } };
    if (spec.type === "column-100" && type !== "column-100" && spec.options.format.suffix === "%") next.options = { ...spec.options, format: { ...spec.options.format, suffix: "" } };
    change(next);
  };

  return (
    <div className="app">
      <header>
        <h1>Wykresy</h1>
        <span className={"badge" + (selectedId ? " editing" : "")}>{selectedId ? "Edytujesz zaznaczony wykres" : "Nowy wykres"}</span>
      </header>
      {!office && <p className="notice">Tryb podglądu: otwórz panel w PowerPoincie, aby wstawiać wykresy na slajd.</p>}

      <div className="preview" aria-label={"Podgląd: " + CHART_TYPE_LABELS[spec.type]} dangerouslySetInnerHTML={{ __html: svg }} />

      <Section title="Typ wykresu">
        <TypePicker value={spec.type} onChange={setType} />
      </Section>

      <Section title="Dane">
        <DataSheet grid={spec.grid} type={spec.type} onChange={(grid) => change({ ...spec, grid })} />
        <ExcelImport
          link={spec.excelLink}
          onImport={(grid, excelLink) => change({ ...spec, grid, excelLink })}
          onUnlink={() => change({ ...spec, excelLink: null })}
        />
      </Section>

      <Section title="Paleta kolorów">
        <PalettePicker paletteId={spec.options.paletteId} customColors={spec.options.customColors} onChange={(paletteId, customColors) => change({ ...spec, options: { ...spec.options, paletteId, customColors } })} />
      </Section>

      <Section title="Etykiety i adnotacje">
        <OptionsPanel type={spec.type} options={spec.options} categories={categories} onChange={(options) => change({ ...spec, options })} />
      </Section>

      <footer>
        {status && <p className={status.kind === "error" ? "error" : "ok"}>{status.text}</p>}
        {selectedId ? (
          <div className="footer-row">
            <button type="button" className="primary" onClick={onUpdate} disabled={busy || !office}>
              {busy ? "Aktualizowanie…" : "Aktualizuj wykres"}
            </button>
            <label className="check small">
              <input type="checkbox" checked={autoUpdate} onChange={(e) => setAutoUpdate(e.target.checked)} />
              na bieżąco
            </label>
            <button type="button" onClick={onInsert} disabled={busy || !office} title="Wstaw nowy wykres z tymi samymi ustawieniami">
              Wstaw kopię
            </button>
          </div>
        ) : (
          <button type="button" className="primary wide" onClick={onInsert} disabled={busy || !office}>
            {busy ? "Wstawianie…" : "Wstaw wykres na slajd"}
          </button>
        )}
      </footer>
    </div>
  );
}
