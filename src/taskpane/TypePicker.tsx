import { CHART_TYPE_LABELS } from "../core/layout";
import type { ChartType } from "../core/types";

const TYPES: ChartType[] = ["column-clustered", "column-stacked", "column-100", "bar-clustered", "bar-stacked", "line", "pie", "doughnut", "waterfall"];

function Icon({ type }: { type: ChartType }) {
  const c1 = "var(--accent)";
  const c2 = "var(--accent-2)";
  const c3 = "var(--accent-3)";
  switch (type) {
    case "column-clustered":
      return (
        <>
          <rect x="3" y="12" width="4" height="9" fill={c1} />
          <rect x="7" y="8" width="4" height="13" fill={c2} />
          <rect x="13" y="9" width="4" height="12" fill={c1} />
          <rect x="17" y="4" width="4" height="17" fill={c2} />
        </>
      );
    case "column-stacked":
      return (
        <>
          <rect x="4" y="13" width="6" height="8" fill={c1} />
          <rect x="4" y="8" width="6" height="5" fill={c2} />
          <rect x="14" y="10" width="6" height="11" fill={c1} />
          <rect x="14" y="3" width="6" height="7" fill={c2} />
        </>
      );
    case "column-100":
      return (
        <>
          <rect x="4" y="11" width="6" height="10" fill={c1} />
          <rect x="4" y="3" width="6" height="8" fill={c2} />
          <rect x="14" y="8" width="6" height="13" fill={c1} />
          <rect x="14" y="3" width="6" height="5" fill={c2} />
        </>
      );
    case "bar-clustered":
      return (
        <>
          <rect x="3" y="3" width="10" height="4" fill={c1} />
          <rect x="3" y="7" width="15" height="4" fill={c2} />
          <rect x="3" y="13" width="13" height="4" fill={c1} />
          <rect x="3" y="17" width="18" height="4" fill={c2} />
        </>
      );
    case "bar-stacked":
      return (
        <>
          <rect x="3" y="4" width="9" height="6" fill={c1} />
          <rect x="12" y="4" width="6" height="6" fill={c2} />
          <rect x="3" y="14" width="12" height="6" fill={c1} />
          <rect x="15" y="14" width="6" height="6" fill={c2} />
        </>
      );
    case "line":
      return (
        <>
          <polyline points="3,17 9,12 15,13 21,5" fill="none" stroke={c1} strokeWidth="2" />
          <polyline points="3,20 9,18 15,16 21,14" fill="none" stroke={c2} strokeWidth="2" />
        </>
      );
    case "pie":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={c2} />
          <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" fill={c1} />
        </>
      );
    case "doughnut":
      return (
        <>
          <circle cx="12" cy="12" r="7" fill="none" stroke={c2} strokeWidth="4" />
          <path d="M12 5 A7 7 0 0 1 18.7 14" fill="none" stroke={c1} strokeWidth="4" />
        </>
      );
    case "waterfall":
      return (
        <>
          <rect x="2" y="8" width="4" height="13" fill={c1} />
          <rect x="7" y="4" width="4" height="4" fill={c2} />
          <rect x="12" y="4" width="4" height="5" fill={c3} />
          <rect x="17" y="9" width="4" height="12" fill={c1} />
        </>
      );
  }
}

export function TypePicker({ value, onChange }: { value: ChartType; onChange: (t: ChartType) => void }) {
  return (
    <div className="type-grid" role="radiogroup" aria-label="Typ wykresu">
      {TYPES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={t === value} className={"type-btn" + (t === value ? " active" : "")} onClick={() => onChange(t)} title={CHART_TYPE_LABELS[t]}>
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <Icon type={t} />
          </svg>
          <span>{CHART_TYPE_LABELS[t]}</span>
        </button>
      ))}
    </div>
  );
}
