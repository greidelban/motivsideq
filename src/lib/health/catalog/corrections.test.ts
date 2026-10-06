import { describe, expect, it } from "vitest";
import { EMPTY_CONSENSUS, canCorrect, checkCorrection, needsRefresh, parseConsensusRows, plausibleCorrection, toKcal, withConsensus } from "./corrections";
import { catalogFood } from "./foods";

const now = new Date("2026-10-06T10:00:00Z");

describe("valori della comunità", () => {
  it("si riscaricano una volta al giorno (e se l'orologio è andato indietro)", () => {
    expect(needsRefresh(EMPTY_CONSENSUS, now)).toBe(true);
    expect(needsRefresh({ fetchedAt: "2026-10-06T01:00:00Z", items: [] }, now)).toBe(false);
    expect(needsRefresh({ fetchedAt: "2026-10-05T09:00:00Z", items: [] }, now)).toBe(true);
    expect(needsRefresh({ fetchedAt: "2026-10-07T09:00:00Z", items: [] }, now)).toBe(true);
  });

  it("righe del server: numeri come testo accettati, righe strane scartate", () => {
    const parsed = parseConsensusRows(
      [
        { food_id: "pasta-dry", votes: 6, kcal: "351.5", protein: "12.0", carbs: "74.0", fat: "1.0" },
        { food_id: "egg", votes: 2, kcal: "140", protein: "12", carbs: "1", fat: "9" },
        { food_id: "egg", votes: 7, kcal: "9999", protein: "12", carbs: "1", fat: "9" },
        null,
      ],
      now,
    );
    expect(parsed.items).toEqual([{ foodId: "pasta-dry", votes: 6, kcal: 351.5, protein: 12, carbs: 74, fat: 1 }]);
    expect(parsed.fetchedAt).toBe(now.toISOString());
    expect(parseConsensusRows("non un elenco", now).items).toEqual([]);
  });

  it("sostituiscono i valori della tabella solo per quell'alimento", () => {
    const pasta = catalogFood("pasta-dry")!;
    const items = [{ foodId: "pasta-dry", votes: 6, kcal: 351.5, protein: 12, carbs: 74, fat: 1 }];
    expect(withConsensus(pasta, items)).toEqual({ food: { ...pasta, kcal: 351.5, protein: 12, carbs: 74, fat: 1 }, votes: 6 });
    const egg = catalogFood("egg")!;
    expect(withConsensus(egg, items)).toEqual({ food: egg, votes: null });
  });

  it("pochi account falsi non stravolgono un alimento, e le bevande alcoliche restano quelle della tabella", () => {
    const butter = catalogFood("butter")!; // 717 kcal, 81 g di grassi
    // Burro a 0 kcal: coerente con i macro, ma troppo lontano dalla tabella.
    expect(withConsensus(butter, [{ foodId: "butter", votes: 5, kcal: 0, protein: 0, carbs: 0, fat: 0 }]).votes).toBeNull();
    // Una correzione vera (qualche punto percentuale) passa.
    expect(withConsensus(butter, [{ foodId: "butter", votes: 5, kcal: 745, protein: 0.6, carbs: 0.7, fat: 82 }]).votes).toBe(5);
    // Per i valori piccoli conta lo scarto assoluto (5 g, 30 kcal).
    expect(plausibleCorrection(catalogFood("pasta-dry")!, { kcal: 360, protein: 15, carbs: 72, fat: 4 })).toBe(true);
    const beer = catalogFood("beer")!;
    expect(withConsensus(beer, [{ foodId: "beer", votes: 9, kcal: beer.kcal, protein: beer.protein, carbs: beer.carbs, fat: beer.fat }]).votes).toBeNull();
  });
});

describe("correzione", () => {
  it("kJ in kcal", () => {
    expect(toKcal(1552, "kJ")).toBeCloseTo(370.9, 1);
    expect(toKcal(371, "kcal")).toBe(371);
  });

  it("stesse regole del database", () => {
    expect(checkCorrection({ kcal: 371, protein: 13, carbs: 75, fat: 1.5 })).toBe("ok");
    expect(checkCorrection({ kcal: 900, protein: 1, carbs: 1, fat: 1 })).toBe("inconsistent");
    expect(checkCorrection({ kcal: 371, protein: NaN, carbs: 75, fat: 1.5 })).toBe("invalid");
    expect(checkCorrection({ kcal: 500, protein: 60, carbs: 60, fat: 0 })).toBe("invalid");
    expect(checkCorrection({ kcal: -1, protein: 0, carbs: 0, fat: 0 })).toBe("invalid");
  });

  it("le bevande alcoliche non si correggono", () => {
    expect(canCorrect(catalogFood("beer")!)).toBe(false);
    expect(canCorrect(catalogFood("pasta-dry")!)).toBe(true);
  });
});
