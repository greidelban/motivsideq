import { describe, expect, it } from "vitest";
import { ageFromBirth, ageGroup } from "./age";

// Le stesse regole di public.age_from_birth() nel database.
describe("ageFromBirth", () => {
  const oct2026 = new Date(2026, 9, 15); // 15 ottobre 2026

  it("conta il compleanno come passato nei mesi successivi a quello di nascita", () => {
    expect(ageFromBirth(2012, 1, oct2026)).toBe(14);
    expect(ageFromBirth(2012, 9, oct2026)).toBe(14);
  });

  it("nel mese del compleanno lo considera non ancora passato (stima prudente)", () => {
    expect(ageFromBirth(2012, 10, oct2026)).toBe(13);
  });

  it("nei mesi precedenti al compleanno conta un anno in meno", () => {
    expect(ageFromBirth(2012, 11, oct2026)).toBe(13);
    expect(ageFromBirth(2008, 12, oct2026)).toBe(17);
  });

  it("gestisce gennaio e dicembre", () => {
    expect(ageFromBirth(2000, 12, new Date(2026, 0, 10))).toBe(25);
    expect(ageFromBirth(2000, 1, new Date(2026, 11, 31))).toBe(26);
  });
});

describe("ageGroup", () => {
  it("separa troppo giovani, minorenni e maggiorenni", () => {
    expect(ageGroup(13)).toBe("too_young");
    expect(ageGroup(14)).toBe("minor");
    expect(ageGroup(17)).toBe("minor");
    expect(ageGroup(18)).toBe("adult");
  });
});
