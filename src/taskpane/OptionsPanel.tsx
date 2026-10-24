import type { ChartOptions, ChartType } from "../core/types";

interface Props {
  type: ChartType;
  options: ChartOptions;
  categories: string[];
  onChange: (options: ChartOptions) => void;
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

export function OptionsPanel({ type, options, categories, onChange }: Props) {
  const set = <K extends keyof ChartOptions>(key: K, value: ChartOptions[K]) => onChange({ ...options, [key]: value });
  const setFormat = (patch: Partial<ChartOptions["format"]>) => onChange({ ...options, format: { ...options.format, ...patch } });
  const last = Math.max(0, categories.length - 1);
  const arrowsAllowed = type !== "pie" && type !== "doughnut" && !type.startsWith("bar") && categories.length >= 2;
  const totalsAllowed = type === "column-stacked" || type === "column-100" || type === "bar-stacked" || type === "doughnut";

  return (
    <div className="options">
      <label className="check">
        <input type="checkbox" checked={options.showValueLabels} onChange={(e) => set("showValueLabels", e.target.checked)} />
        Etykiety wartości
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
          Oś wartości z liniami siatki
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
      {type !== "pie" && type !== "doughnut" && type !== "line" && (
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
