export interface Palette {
  id: string;
  name: string;
  colors: string[];
  /** Kolor spadku w wykresie kaskadowym (wyraźnie inny niż kolory wzrostu i sumy). */
  negative: string;
}

export const PALETTES: Palette[] = [
  {
    id: "business",
    name: "Biznesowa",
    colors: ["#1F3B73", "#2E6FB7", "#6FA8DC", "#A9C9EA", "#5B6770", "#9AA5AE", "#D0D6DB", "#F2A93B"],
    negative: "#C8553D",
  },
  {
    id: "muted",
    name: "Stonowana",
    colors: ["#3D4E5C", "#6B7F8E", "#98A8B4", "#C5D0D8", "#B0805A", "#D4B49A", "#7C8C6E", "#B5C2A8"],
    negative: "#B0805A",
  },
  {
    id: "contrast",
    name: "Kontrastowa",
    colors: ["#0B5FFF", "#FF6B00", "#00A878", "#D7263D", "#7D3AC1", "#FFC300", "#1B998B", "#3F3F3F"],
    negative: "#D7263D",
  },
  {
    id: "colorblind",
    name: "Przyjazna daltonistom",
    // Paleta Okabe–Ito.
    colors: ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#F0E442", "#000000"],
    negative: "#D55E00",
  },
  {
    id: "warm",
    name: "Ciepła",
    colors: ["#7F1D1D", "#B91C1C", "#EA580C", "#F59E0B", "#FCD34D", "#A16207", "#78716C", "#D6D3D1"],
    negative: "#78716C",
  },
  {
    id: "cool",
    name: "Chłodna",
    colors: ["#134E4A", "#0F766E", "#14B8A6", "#5EEAD4", "#1E3A8A", "#3B82F6", "#93C5FD", "#64748B"],
    negative: "#B45309",
  },
  {
    id: "mono",
    name: "Monochromatyczna",
    colors: ["#0B2545", "#13315C", "#1D4E89", "#3E7CB1", "#6A9FCB", "#9CC1E0", "#C9DDF0", "#E6EFF8"],
    negative: "#C2410C",
  },
  {
    id: "grayscale",
    name: "Odcienie szarości",
    colors: ["#1A1A1A", "#4D4D4D", "#7A7A7A", "#A3A3A3", "#C7C7C7", "#E0E0E0", "#5C5C5C", "#8F8F8F"],
    negative: "#B3261E",
  },
];

export const CUSTOM_PALETTE_ID = "custom";

export function getPaletteColors(paletteId: string, customColors: string[]): string[] {
  if (paletteId === CUSTOM_PALETTE_ID && customColors.length > 0) return customColors;
  return (PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]).colors;
}

export function getWaterfallColors(paletteId: string, customColors: string[]): { total: string; increase: string; decrease: string } {
  const colors = getPaletteColors(paletteId, customColors);
  const palette = PALETTES.find((p) => p.id === paletteId);
  const decrease = palette ? palette.negative : colorAt(colors, 2);
  return { total: colorAt(colors, 0), increase: colorAt(colors, 1), decrease };
}

export function colorAt(colors: string[], index: number): string {
  return colors[((index % colors.length) + colors.length) % colors.length];
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Czarny lub biały tekst, zależnie od jasności tła (WCAG relative luminance). */
export function contrastText(background: string): string {
  if (!isHexColor(background)) return "#000000";
  const channel = (i: number) => {
    const c = parseInt(background.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return lum > 0.4 ? "#000000" : "#FFFFFF";
}
