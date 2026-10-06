import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import { kcalConsistent } from "../food";
import { foodName, isValidAmount, nutrientsFor, searchFoods } from "./catalog";
import { FOODS, catalogFood } from "./foods";
import { loadFoodNames } from "./names";
import { en } from "./names/en";
import { it as itNames } from "./names/it";

describe("tabella degli alimenti", () => {
  it("id unici", () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });

  it("kcal coerenti con macro e alcol (stessa tolleranza dell'inserimento a mano)", () => {
    for (const f of FOODS) {
      // L'alcol vale 7 kcal per grammo: si toglie prima del confronto.
      const kcal = f.kcal - 7 * (f.alcohol ?? 0);
      expect(kcalConsistent(kcal, f.protein, f.carbs, f.fat), f.id).toBe(true);
    }
  });

  it("valori e porzioni plausibili", () => {
    for (const f of FOODS) {
      expect(f.protein + f.carbs + f.fat + (f.alcohol ?? 0), f.id).toBeLessThanOrEqual(100);
      expect(f.kcal, f.id).toBeLessThanOrEqual(900);
      for (const [, grams] of f.portions ?? []) expect(isValidAmount(grams), f.id).toBe(true);
    }
  });

  it.each(LOCALES)("%s: un nome per ogni alimento, niente in più", async (locale) => {
    const names = await loadFoodNames(locale);
    expect(Object.keys(names).sort()).toEqual(FOODS.map((f) => f.id).sort());
    for (const [id, value] of Object.entries(names)) {
      expect(value.split("|").every((part) => part.trim().length > 0), `${locale} ${id}`).toBe(true);
    }
  });

  it.each(["ar", "he", "ru", "zh"] as const)("%s: nessuna lettera latina nei nomi", async (locale) => {
    const names = await loadFoodNames(locale);
    for (const [id, value] of Object.entries(names)) expect(/[A-Za-z]/.test(value), `${locale} ${id}`).toBe(false);
  });
});

describe("ricerca", () => {
  const all = { alcohol: true };

  it("il nome che inizia con il testo viene prima, poi il più corto", () => {
    const ids = searchFoods(itNames, "mel", all).map((f) => f.id);
    expect(ids.slice(0, 3)).toEqual(["apple", "melon", "eggplant"]);
  });

  it("senza maiuscole né accenti, anche con i sinonimi", () => {
    expect(searchFoods(itNames, "CAFFE", all).map((f) => f.id)).toContain("coffee");
    expect(searchFoods(itNames, "frollini", all).map((f) => f.id)).toEqual(["butter-cookies"]);
    expect(searchFoods(en, "chicken", all).map((f) => f.id)).toEqual(["chicken-breast-raw", "chicken-breast-cooked"]);
  });

  it("parola in mezzo al nome", () => {
    expect(searchFoods(itNames, "pollo", all).map((f) => f.id)).toContain("chicken-breast-raw");
  });

  it("niente alcol per i minorenni", () => {
    expect(searchFoods(itNames, "birra", all).map((f) => f.id)).toEqual(["beer"]);
    expect(searchFoods(itNames, "birra", { alcohol: false })).toEqual([]);
  });

  it("ricerca vuota e limite", () => {
    expect(searchFoods(itNames, "  ", all)).toEqual([]);
    expect(searchFoods(itNames, "a", { alcohol: true, limit: 5 })).toHaveLength(5);
  });

  it("nome senza sinonimi", () => {
    expect(foodName(itNames, "rusks")).toBe("Fette biscottate");
    expect(foodName(itNames, "pasta-dry")).toBe("Pasta, cruda");
    expect(foodName(itNames, "nope")).toBeUndefined();
  });
});

describe("valori per quantità", () => {
  it("proporzionali ai 100 g, kcal intere e macro con un decimale", () => {
    const pasta = catalogFood("pasta-dry")!;
    expect(nutrientsFor(pasta, 80)).toEqual({ kcal: 297, protein: 10.4, carbs: 60, fat: 1.2 });
    expect(nutrientsFor(catalogFood("egg")!, 50)).toEqual({ kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 });
  });

  it("quantità valide", () => {
    expect(isValidAmount(150)).toBe(true);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(6000)).toBe(false);
  });
});
