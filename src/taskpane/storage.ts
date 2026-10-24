// Ustawienia domyślne dla nowych wykresów (ostatnio użyta paleta). Tylko wygoda – brak dostępu do localStorage nie przeszkadza.

const KEY = "wykresy.defaults.v1";

export interface Defaults {
  paletteId: string;
  customColors: string[];
}

export function loadDefaults(): Defaults | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Defaults>;
    if (typeof d.paletteId !== "string" || !Array.isArray(d.customColors)) return null;
    return { paletteId: d.paletteId, customColors: d.customColors.map(String) };
  } catch {
    return null;
  }
}

export function saveDefaults(d: Defaults): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Ignorujemy – np. tryb prywatny.
  }
}
