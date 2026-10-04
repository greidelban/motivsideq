import { describe, expect, it } from "vitest";
import { isLocale, matchLocale } from "./config";
import { en } from "./dictionaries/en";
import { it as itDict } from "./dictionaries/it";
import { formatBytes, formatDuration, formatNumber, interpolate, plural } from "./format";

describe("matchLocale", () => {
  it("usa la prima lingua supportata in ordine di preferenza", () => {
    expect(matchLocale("it-IT,it;q=0.9,en;q=0.8")).toBe("it");
    expect(matchLocale("fr-FR,fr;q=0.9,it;q=0.8,en;q=0.7")).toBe("it");
    expect(matchLocale("de-DE,en-US;q=0.5")).toBe("en");
  });

  it("rispetta i pesi q anche se l'ordine è diverso", () => {
    expect(matchLocale("en;q=0.3,it;q=0.9")).toBe("it");
  });

  it("torna all'inglese se non c'è nulla di supportato", () => {
    expect(matchLocale("ja,zh;q=0.5")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("")).toBe("en");
    expect(matchLocale("it;q=0")).toBe("en");
  });

  it("isLocale", () => {
    expect(isLocale("it")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("format", () => {
  it("interpolate", () => {
    expect(interpolate("{a} di {b}", { a: 2, b: 5 })).toBe("2 di 5");
    expect(interpolate("{missing}", {})).toBe("{missing}");
  });

  it("plural sceglie la forma giusta", () => {
    const forms = { one: "{n} day", other: "{n} days" };
    expect(plural("en", 1, forms)).toBe("1 day");
    expect(plural("en", 3, forms)).toBe("3 days");
  });

  it("numeri e durate seguono la lingua", () => {
    expect(formatNumber("en", 1.5, 1)).toBe("1.5");
    expect(formatNumber("it", 1.5, 1)).toBe("1,5");
    expect(formatDuration("en", 850.4)).toBe("850 ms");
    expect(formatDuration("en", 1430)).toBe("1.4 s");
    expect(formatDuration("it", 1430)).toBe("1,4 s");
  });

  it("spazio in kB, MB e GB", () => {
    expect(formatBytes("en", 850_000)).toBe("850 kB");
    expect(formatBytes("en", 2_345_678)).toBe("2.3 MB");
    expect(formatBytes("it", 2_345_678)).toBe("2,3 MB");
    expect(formatBytes("en", 1e9)).toBe("1 GB");
  });
});

describe("dizionari", () => {
  // Ricorsivo: stesse chiavi e nessun testo vuoto in ogni lingua.
  function keys(obj: object, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  }
  function values(obj: object): unknown[] {
    return Object.values(obj).flatMap((v) => (typeof v === "object" && v !== null ? values(v) : [v]));
  }

  it("l'italiano ha esattamente le chiavi dell'inglese", () => {
    expect(keys(itDict).sort()).toEqual(keys(en).sort());
  });

  it("nessuna traduzione vuota", () => {
    for (const dict of [en, itDict]) {
      for (const v of values(dict)) expect(typeof v === "string" && v.trim().length > 0).toBe(true);
    }
  });

  it("gli stessi segnaposto {x} in ogni traduzione", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const flat = (obj: object, prefix = ""): [string, string][] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === "object" && v !== null ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
      );
    const itMap = new Map(flat(itDict));
    for (const [key, value] of flat(en)) {
      // Nelle forme plurali la forma "one" può omettere {n} ("un giorno").
      if (key.endsWith(".one")) continue;
      expect(`${key}: ${placeholders(itMap.get(key) ?? "")}`).toBe(`${key}: ${placeholders(value)}`);
    }
  });
});
