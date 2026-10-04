import type { BackgroundId } from "./backgrounds";

// Colori degli sfondi. Gli stessi 10 temi valgono per ogni sfondo; ogni tema ha
// 4 colori con un ruolo fisso, che ogni shader usa a modo suo:
//   light  = la luce principale (nucleo, vertice, fumo chiaro)
//   mid    = il colore dominante (bracci, raggi, fumo)
//   deep   = il colore profondo (zone scure colorate, nebulose)
//   accent = i riflessi (bordi, fasci, scintille)
// "original" è il colore con cui ogni sfondo è stato disegnato.

export const PALETTE_IDS = [
  "original",
  "ember",
  "gold",
  "rose",
  "violet",
  "ocean",
  "aurora",
  "forest",
  "mono",
  "sunset",
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type PaletteHex = readonly [light: string, mid: string, deep: string, accent: string];

const THEMES: Record<Exclude<PaletteId, "original">, PaletteHex> = {
  ember: ["#ffd7b0", "#ff8a4c", "#c2361b", "#ffc861"],
  gold: ["#fff1c9", "#f2c14e", "#b9792a", "#fff8e6"],
  rose: ["#ffd6e3", "#ff7aa8", "#c2185b", "#ffb3c7"],
  violet: ["#e6d9ff", "#a77bff", "#6a2bd9", "#ff9be8"],
  ocean: ["#d6f1ff", "#4fb3ff", "#1d4fd8", "#7ef0ff"],
  aurora: ["#d9fff0", "#3ddc97", "#0f8f8a", "#b388ff"],
  forest: ["#e8f5d0", "#8bc34a", "#2e7d32", "#ffe082"],
  mono: ["#ffffff", "#c9ccd6", "#6b7080", "#e8ecf5"],
  sunset: ["#ffe3c4", "#ff7e5f", "#8e3bb5", "#feb47b"],
};

// I colori originali di ciascuno sfondo (gli stessi che usavano gli shader).
const ORIGINAL: Record<BackgroundId, PaletteHex> = {
  smoke: ["#ffbd94", "#ff8cad", "#eb61d9", "#73e6f2"],
  galaxy: ["#ffdeb3", "#b8ccff", "#ff739e", "#5a7fd6"],
  crystal: ["#cce0ff", "#8cebff", "#5a8fd6", "#ffcc94"],
  sparkle: ["#ebebfa", "#fff2e6", "#d9e0f2", "#fff7f0"],
  prism: ["#f2f2ff", "#b8d6ff", "#d1a8ff", "#ffb3db"],
  classic: ["#e9d8ff", "#b026ff", "#b026ff", "#00c8e0"],
};

export function paletteHex(background: BackgroundId, palette: PaletteId): PaletteHex {
  return palette === "original" ? ORIGINAL[background] : THEMES[palette];
}

/** "#ff8a4c" → [1, 0.541, 0.298] */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** I 4 colori come 12 numeri, pronti per uniform3fv(uPal[4]). */
export function paletteUniform(background: BackgroundId, palette: PaletteId): Float32Array {
  return new Float32Array(paletteHex(background, palette).flatMap(hexToRgb));
}

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}
