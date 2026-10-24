import { CUSTOM_PALETTE_ID, PALETTES, isHexColor } from "../core/palettes";

interface Props {
  paletteId: string;
  customColors: string[];
  onChange: (paletteId: string, customColors: string[]) => void;
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="swatches" aria-hidden="true">
      {colors.slice(0, 8).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export function PalettePicker({ paletteId, customColors, onChange }: Props) {
  const setColor = (i: number, value: string) => {
    const next = [...customColors];
    next[i] = value.toUpperCase();
    onChange(CUSTOM_PALETTE_ID, next);
  };

  return (
    <div className="palettes" role="radiogroup" aria-label="Paleta kolorów">
      {PALETTES.map((p) => (
        <label key={p.id} className={"palette" + (p.id === paletteId ? " active" : "")}>
          <input type="radio" name="palette" checked={p.id === paletteId} onChange={() => onChange(p.id, customColors)} />
          <span className="palette-name">{p.name}</span>
          <Swatches colors={p.colors} />
        </label>
      ))}
      <label className={"palette" + (paletteId === CUSTOM_PALETTE_ID ? " active" : "")}>
        <input type="radio" name="palette" checked={paletteId === CUSTOM_PALETTE_ID} onChange={() => onChange(CUSTOM_PALETTE_ID, customColors)} />
        <span className="palette-name">Własna</span>
        <Swatches colors={customColors} />
      </label>
      {paletteId === CUSTOM_PALETTE_ID && (
        <div className="custom-colors">
          {customColors.map((c, i) => (
            <span key={i} className="custom-color">
              <input type="color" value={isHexColor(c) ? c : "#000000"} onChange={(e) => setColor(i, e.target.value)} aria-label={`Kolor ${i + 1}`} />
              <input
                type="text"
                value={c}
                maxLength={7}
                className={isHexColor(c) ? "" : "invalid"}
                onChange={(e) => setColor(i, e.target.value)}
                aria-label={`Kod koloru ${i + 1}`}
              />
              <button type="button" className="icon" onClick={() => onChange(CUSTOM_PALETTE_ID, customColors.filter((_, j) => j !== i))} disabled={customColors.length <= 1} aria-label="Usuń kolor">
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange(CUSTOM_PALETTE_ID, [...customColors, "#7F7F7F"])} disabled={customColors.length >= 12}>
            + Kolor
          </button>
          <p className="hint">Własna paleta zapisuje się w wykresie i jako domyślna dla nowych wykresów.</p>
        </div>
      )}
    </div>
  );
}
