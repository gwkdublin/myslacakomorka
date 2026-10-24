import { MARKER_SHAPES, markerStyleFor } from "../core/markers";
import { colorAt } from "../core/palettes";
import { primsToSvg } from "../core/svg";
import type { ChartOptions, ChartType, MarkerStyle } from "../core/types";

interface Props {
  type: ChartType;
  options: ChartOptions;
  categories: string[];
  /** Grupy punktów (tylko wykres punktowy). */
  groups: string[];
  colors: string[];
  onChange: (options: ChartOptions) => void;
}

function MarkerIcon({ style, color }: { style: MarkerStyle; color: string }) {
  const svg = primsToSvg([{ kind: "marker", role: "icon", cx: 9, cy: 9, r: 6, fill: color, shape: style.shape, hollow: !style.filled }], { width: 18, height: 18 });
  return <span className="marker-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ScatterOptions({ options, groups, colors, onChange }: { options: ChartOptions; groups: string[]; colors: string[]; onChange: (o: ChartOptions) => void }) {
  const sc = options.scatter;
  const setSc = (patch: Partial<ChartOptions["scatter"]>) => onChange({ ...options, scatter: { ...sc, ...patch } });
  const setStyle = (gi: number, patch: Partial<MarkerStyle>) => {
    const styles = [...sc.groupStyles];
    for (let i = 0; i <= gi; i++) styles[i] = styles[i] ?? markerStyleFor(sc, i);
    styles[gi] = { ...styles[gi], ...patch };
    setSc({ groupStyles: styles });
  };
  const rows = groups.length > 0 ? groups : [""];
  return (
    <fieldset>
      <legend>Kropki</legend>
      <label className="check">
        <input type="checkbox" checked={sc.sizeByValue} onChange={(e) => setSc({ sizeByValue: e.target.checked })} />
        Wielkość kropek wg kolumny „Wielkość” (bąbelki)
      </label>
      {sc.sizeByValue ? (
        <label className="slider">
          Największy bąbel: {sc.maxBubbleSize} pt
          <input type="range" min={8} max={50} step={1} value={sc.maxBubbleSize} onChange={(e) => setSc({ maxBubbleSize: Number(e.target.value) })} />
        </label>
      ) : (
        <label className="slider">
          Wielkość kropki: {sc.markerSize} pt
          <input type="range" min={2} max={16} step={0.5} value={sc.markerSize} onChange={(e) => setSc({ markerSize: Number(e.target.value) })} />
        </label>
      )}
      {rows.map((g, gi) => {
        const st = markerStyleFor(sc, gi);
        const color = colorAt(colors, gi);
        return (
          <div key={gi} className="marker-row">
            <div className="marker-group">{groups.length > 1 ? g || "(bez grupy)" : "Wszystkie punkty"}</div>
            <div className="marker-shapes" role="radiogroup" aria-label={`Kształt kropek: ${g || "wszystkie"}`}>
              {MARKER_SHAPES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={st.shape === m.id}
                  className={"marker-btn" + (st.shape === m.id ? " active" : "")}
                  title={m.name}
                  onClick={() => setStyle(gi, { shape: m.id })}
                >
                  <MarkerIcon style={{ shape: m.id, filled: st.filled }} color={color} />
                </button>
              ))}
              <span className="seg">
                <button type="button" className={st.filled ? "active" : ""} onClick={() => setStyle(gi, { filled: true })} title="Pełne (solid)">
                  Pełne
                </button>
                <button type="button" className={!st.filled ? "active" : ""} onClick={() => setStyle(gi, { filled: false })} title="Puste (hollow)">
                  Puste
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

function CategorySelect({ value, categories, onChange, label }: { value: number; categories: string[]; onChange: (v: number) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {categories.map((c, i) => (
        <option key={i} value={i}>
          {c || `Kategoria ${i + 1}`}
        </option>
      ))}
    </select>
  );
}

export function OptionsPanel({ type, options, categories, groups, colors, onChange }: Props) {
  const set = <K extends keyof ChartOptions>(key: K, value: ChartOptions[K]) => onChange({ ...options, [key]: value });
  const setFormat = (patch: Partial<ChartOptions["format"]>) => onChange({ ...options, format: { ...options.format, ...patch } });
  const last = Math.max(0, categories.length - 1);
  const scatter = type === "scatter";
  const arrowsAllowed = !scatter && type !== "pie" && type !== "doughnut" && !type.startsWith("bar") && categories.length >= 2;
  const totalsAllowed = type === "column-stacked" || type === "column-100" || type === "bar-stacked" || type === "doughnut";

  return (
    <div className="options">
      <label className="check">
        <input type="checkbox" checked={options.showValueLabels} onChange={(e) => set("showValueLabels", e.target.checked)} />
        {scatter ? "Etykiety punktów" : "Etykiety wartości"}
      </label>
      {totalsAllowed && (
        <label className="check">
          <input type="checkbox" checked={options.showTotals} onChange={(e) => set("showTotals", e.target.checked)} />
          {type === "doughnut" ? "Suma w środku" : "Sumy kategorii"}
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={options.showLegend} onChange={(e) => set("showLegend", e.target.checked)} />
        Legenda
      </label>
      {type !== "pie" && type !== "doughnut" && !type.startsWith("bar") && (
        <label className="check">
          <input type="checkbox" checked={options.showValueAxis} onChange={(e) => set("showValueAxis", e.target.checked)} />
          {scatter ? "Linie siatki" : "Oś wartości z liniami siatki"}
        </label>
      )}

      <div className="field-row">
        <label>
          Miejsca po przecinku
          <select value={options.format.decimals} onChange={(e) => setFormat({ decimals: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jednostka
          <input type="text" value={options.format.suffix} placeholder="np. % lub mln" onChange={(e) => setFormat({ suffix: e.target.value })} />
        </label>
      </div>
      <div className="field-row">
        <label>
          Separator dziesiętny
          <select value={options.format.decimalSeparator} onChange={(e) => setFormat({ decimalSeparator: e.target.value as "," | "." })}>
            <option value=",">przecinek (1 234,5)</option>
            <option value=".">kropka (1,234.5)</option>
          </select>
        </label>
        <label>
          Wielkość czcionki
          <input type="number" min={7} max={28} value={options.fontSize} onChange={(e) => set("fontSize", Math.max(7, Math.min(28, Number(e.target.value) || 12)))} />
        </label>
      </div>
      {scatter && <ScatterOptions options={options} groups={groups} colors={colors} onChange={onChange} />}
      {type !== "pie" && type !== "doughnut" && type !== "line" && !scatter && (
        <label className="slider">
          Odstęp między kolumnami: {Math.round(options.gap * 100)}%
          <input type="range" min={0} max={0.8} step={0.05} value={options.gap} onChange={(e) => set("gap", Number(e.target.value))} />
        </label>
      )}

      {arrowsAllowed && (
        <fieldset>
          <legend>Adnotacje</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={!!options.diffArrow}
              onChange={(e) => set("diffArrow", e.target.checked ? { from: 0, to: last, mode: "percent" } : null)}
            />
            Strzałka różnicy
          </label>
          {options.diffArrow && (
            <div className="field-row indent">
              <CategorySelect label="Od kategorii" value={options.diffArrow.from} categories={categories} onChange={(v) => set("diffArrow", { ...options.diffArrow!, from: v })} />
              <span>→</span>
              <CategorySelect label="Do kategorii" value={options.diffArrow.to} categories={categories} onChange={(v) => set("diffArrow", { ...options.diffArrow!, to: v })} />
              <select value={options.diffArrow.mode} onChange={(e) => set("diffArrow", { ...options.diffArrow!, mode: e.target.value as "absolute" | "percent" })} aria-label="Rodzaj różnicy">
                <option value="percent">%</option>
                <option value="absolute">wartość</option>
              </select>
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={!!options.cagr} onChange={(e) => set("cagr", e.target.checked ? { from: 0, to: last } : null)} />
            Strzałka CAGR (średnioroczny wzrost)
          </label>
          {options.cagr && (
            <div className="field-row indent">
              <CategorySelect label="CAGR od" value={options.cagr.from} categories={categories} onChange={(v) => set("cagr", { ...options.cagr!, from: v })} />
              <span>→</span>
              <CategorySelect label="CAGR do" value={options.cagr.to} categories={categories} onChange={(v) => set("cagr", { ...options.cagr!, to: v })} />
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
