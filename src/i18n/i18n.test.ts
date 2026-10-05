import { describe, expect, it } from "vitest";
import { LOCALES, isLocale, matchLocale } from "./config";
import { DICTIONARIES } from "./dictionaries";
import { en } from "./dictionaries/en";
import { formatBytes, formatDuration, formatNumber, interpolate, plural } from "./format";

describe("matchLocale", () => {
  it("usa la prima lingua supportata in ordine di preferenza", () => {
    expect(matchLocale("it-IT,it;q=0.9,en;q=0.8")).toBe("it");
    expect(matchLocale("nl-NL,nl;q=0.9,it;q=0.8,en;q=0.7")).toBe("it");
    expect(matchLocale("fr-FR,fr;q=0.9,it;q=0.8")).toBe("fr");
    expect(matchLocale("pt-BR,pt;q=0.9")).toBe("pt");
    expect(matchLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(matchLocale("ar-EG")).toBe("ar");
    expect(matchLocale("he-IL,he;q=0.9")).toBe("he");
    expect(matchLocale("sv-SE,en-US;q=0.5")).toBe("en");
  });

  it("rispetta i pesi q anche se l'ordine è diverso", () => {
    expect(matchLocale("en;q=0.3,it;q=0.9")).toBe("it");
  });

  it("torna all'inglese se non c'è nulla di supportato", () => {
    expect(matchLocale("ja,ko;q=0.5")).toBe("en");
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
  const PLURAL_KEYS = new Set(["zero", "one", "two", "few", "many", "other"]);
  const isPlural = (v: object) => "other" in v && Object.keys(v).every((k) => PLURAL_KEYS.has(k));

  // Testi "piatti": chiave → valore; i plurali restano oggetti.
  function flat(obj: object, prefix = ""): [string, unknown][] {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "object" && v !== null && !isPlural(v) ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]],
    );
  }
  const placeholders = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(",");
  const others = LOCALES.filter((l) => l !== "en");
  const enFlat = new Map(flat(en));

  it.each(others)("%s ha esattamente le chiavi dell'inglese", (locale) => {
    expect(flat(DICTIONARIES[locale]).map(([k]) => k).sort()).toEqual([...enFlat.keys()].sort());
  });

  it.each(LOCALES)("%s: nessun testo vuoto", (locale) => {
    for (const [key, v] of flat(DICTIONARIES[locale])) {
      const texts = typeof v === "string" ? [v] : Object.values(v as object);
      for (const t of texts) expect(typeof t === "string" && t.trim().length > 0, `${locale} ${key}`).toBe(true);
    }
  });

  it.each(LOCALES)("%s: i plurali hanno le forme che la lingua usa", (locale) => {
    const rules = new Intl.PluralRules(locale);
    for (const [key, v] of flat(DICTIONARIES[locale])) {
      if (typeof v === "string") continue;
      for (let n = 0; n <= 120; n++) {
        const rule = rules.select(n);
        expect(rule in (v as object), `${locale} ${key}: manca "${rule}" (n = ${n})`).toBe(true);
      }
    }
  });

  it.each(others)("%s usa gli stessi segnaposto {x} dell'inglese", (locale) => {
    for (const [key, v] of flat(DICTIONARIES[locale])) {
      const base = enFlat.get(key);
      if (typeof v === "string") {
        expect(`${key}: ${placeholders(v)}`).toBe(`${key}: ${placeholders(base as string)}`);
      } else {
        // Nei plurali le forme possono omettere {n} ("un giorno"), ma non inventarne altri.
        const allowed = new Set([...(placeholders((base as { other: string }).other).split(",")), "{n}"]);
        for (const form of Object.values(v as object) as string[]) {
          for (const p of form.match(/\{\w+\}/g) ?? []) expect(allowed.has(p), `${locale} ${key}: ${p}`).toBe(true);
        }
        expect(placeholders((v as { other: string }).other), `${locale} ${key}.other`).toBe(placeholders((base as { other: string }).other));
      }
    }
  });
});
