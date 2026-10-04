import { describe, expect, it } from "vitest";
import { BACKGROUNDS } from "./backgrounds";
import { PALETTE_IDS, hexToRgb, paletteHex, paletteUniform } from "./palettes";

describe("palette", () => {
  it("ogni sfondo ha 10 colori, ognuno con 4 ruoli validi", () => {
    expect(PALETTE_IDS).toHaveLength(10);
    for (const bg of BACKGROUNDS) {
      for (const p of PALETTE_IDS) {
        const hex = paletteHex(bg, p);
        expect(hex).toHaveLength(4);
        for (const c of hex) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("'original' è diverso per ogni sfondo, gli altri temi sono condivisi", () => {
    expect(paletteHex("smoke", "original")).not.toEqual(paletteHex("galaxy", "original"));
    expect(paletteHex("smoke", "ocean")).toEqual(paletteHex("galaxy", "ocean"));
  });

  it("converte i colori per lo shader", () => {
    expect(hexToRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
    const u = paletteUniform("prism", "mono");
    expect(u).toHaveLength(12);
    expect(Array.from(u.slice(0, 3))).toEqual([1, 1, 1]);
  });
});
