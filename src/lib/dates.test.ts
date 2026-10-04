import { describe, expect, it } from "vitest";
import { addDays, localDateKey, partOfDay, streak } from "./dates";

describe("localDateKey / addDays", () => {
  it("formatta la data locale", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("attraversa mesi e anni", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("streak", () => {
  it("conta i giorni consecutivi fino a oggi", () => {
    expect(streak(["2026-10-01", "2026-10-02", "2026-10-03"], "2026-10-03")).toBe(3);
  });

  it("se oggi non c'è ancora nulla, la serie vale fino a ieri", () => {
    expect(streak(["2026-10-01", "2026-10-02"], "2026-10-03")).toBe(2);
  });

  it("un buco interrompe la serie", () => {
    expect(streak(["2026-09-29", "2026-10-01", "2026-10-02", "2026-10-03"], "2026-10-03")).toBe(3);
    expect(streak(["2026-10-01"], "2026-10-03")).toBe(0);
  });

  it("ignora i duplicati", () => {
    expect(streak(["2026-10-03", "2026-10-03", "2026-10-02"], "2026-10-03")).toBe(2);
  });
});

describe("partOfDay", () => {
  it("dipende dall'ora; la notte conta come sera", () => {
    expect(partOfDay(new Date(2026, 0, 1, 7))).toBe("morning");
    expect(partOfDay(new Date(2026, 0, 1, 15))).toBe("afternoon");
    expect(partOfDay(new Date(2026, 0, 1, 21))).toBe("evening");
    expect(partOfDay(new Date(2026, 0, 1, 2))).toBe("evening");
  });
});
