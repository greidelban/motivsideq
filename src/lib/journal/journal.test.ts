import * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import {
  JOURNAL_TEXT_MAX,
  PROMPTS,
  checkInSchema,
  excerpt,
  journalPageSchema,
  nearestLevel,
  promptFor,
  searchPages,
  setCheckIn,
  setPageText,
  stepSleep,
  summarize,
  weekDays,
} from "./journal";

describe("check-in", () => {
  it("crea, aggiorna e toglie i valori di un giorno", () => {
    let list = setCheckIn([], "2026-10-05", { mood: 4 });
    expect(list).toEqual([{ day: "2026-10-05", mood: 4 }]);
    list = setCheckIn(list, "2026-10-05", { energy: 2, sleepHours: 7 });
    expect(list).toEqual([{ day: "2026-10-05", mood: 4, energy: 2, sleepHours: 7 }]);
    list = setCheckIn(list, "2026-10-05", { mood: undefined });
    expect(list).toEqual([{ day: "2026-10-05", energy: 2, sleepHours: 7 }]);
  });

  it("un giorno senza valori non si salva", () => {
    const list = setCheckIn([{ day: "2026-10-05", hunger: 3 }], "2026-10-05", { hunger: undefined });
    expect(list).toEqual([]);
  });

  it("non tocca gli altri giorni", () => {
    const list = setCheckIn([{ day: "2026-10-04", mood: 1 }], "2026-10-05", { mood: 5 });
    expect(list).toHaveLength(2);
    expect(list.find((c) => c.day === "2026-10-04")?.mood).toBe(1);
  });

  it("lo schema accetta solo livelli da 1 a 5 e sonno da 0 a 24 ore", () => {
    expect(z.safeParse(checkInSchema, { day: "2026-10-05", mood: 5, sleepHours: 7.5 }).success).toBe(true);
    expect(z.safeParse(checkInSchema, { day: "2026-10-05", mood: 6 }).success).toBe(false);
    expect(z.safeParse(checkInSchema, { day: "2026-10-05", energy: 2.5 }).success).toBe(false);
    expect(z.safeParse(checkInSchema, { day: "2026-10-05", sleepHours: 25 }).success).toBe(false);
  });

  it("sonno: si parte da 7,5 ore, passi di mezz'ora, mai fuori dai limiti", () => {
    expect(stepSleep(undefined, 1)).toBe(7.5);
    expect(stepSleep(undefined, -1)).toBe(7.5);
    expect(stepSleep(7.5, 1)).toBe(8);
    expect(stepSleep(0, -1)).toBe(0);
    expect(stepSleep(16, 1)).toBe(16);
  });
});

describe("pagine", () => {
  it("scrive, riscrive e toglie la pagina vuota", () => {
    let list = setPageText([], "2026-10-05", "Ciao", "learned");
    expect(list).toEqual([{ day: "2026-10-05", text: "Ciao", promptKey: "learned" }]);
    list = setPageText(list, "2026-10-05", "Ciao di nuovo");
    expect(list).toEqual([{ day: "2026-10-05", text: "Ciao di nuovo" }]);
    expect(setPageText(list, "2026-10-05", "  \n ")).toEqual([]);
  });

  it("taglia i testi troppo lunghi e lo schema li rifiuta", () => {
    const [page] = setPageText([], "2026-10-05", "a".repeat(JOURNAL_TEXT_MAX + 10));
    expect(page.text).toHaveLength(JOURNAL_TEXT_MAX);
    expect(z.safeParse(journalPageSchema, { day: "2026-10-05", text: "a".repeat(JOURNAL_TEXT_MAX + 1) }).success).toBe(false);
  });

  it("uno spunto che non esiste più non rende la pagina invalida", () => {
    expect(z.safeParse(journalPageSchema, { day: "2026-10-05", text: "x", promptKey: "removedOne" }).success).toBe(true);
  });
});

describe("spunti", () => {
  it("cambia ogni giorno e gira su tutto l'elenco", () => {
    const days = Array.from({ length: PROMPTS.length }, (_, i) => promptFor(`2026-01-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(days).size).toBe(PROMPTS.length);
    expect(promptFor("2026-10-05")).toBe(promptFor("2026-10-05"));
  });

  it("'un altro' passa al successivo, anche prima del 2026", () => {
    expect(promptFor("2026-10-05", 1)).not.toBe(promptFor("2026-10-05"));
    expect(PROMPTS).toContain(promptFor("2020-02-29"));
  });
});

describe("settimana", () => {
  it("da lunedì o da domenica, secondo la lingua", () => {
    // 5 ottobre 2026 è lunedì.
    expect(weekDays("2026-10-07", 1)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(weekDays("2026-10-07", 7)[0]).toBe("2026-10-04");
    expect(weekDays("2026-10-04", 1)[0]).toBe("2026-09-28");
    expect(weekDays("2026-10-10", 6)[0]).toBe("2026-10-10");
  });
});

describe("riepilogo", () => {
  const list = [
    { day: "2026-09-20", mood: 1 },
    { day: "2026-09-30", mood: 2, sleepHours: 6 },
    { day: "2026-10-03", mood: 4, energy: 3, sleepHours: 8 },
    { day: "2026-10-05", mood: 5, energy: 4 },
    { day: "2026-10-06", mood: 1 },
  ];

  it("media degli ultimi 7 giorni, oggi compreso, senza il futuro", () => {
    const s = summarize(list, "2026-10-05");
    expect(s.checkIns).toBe(3);
    expect(s.mood).toBeCloseTo(11 / 3);
    expect(s.energy).toBe(3.5);
    expect(s.sleepHours).toBe(7);
  });

  it("senza dati le medie sono vuote", () => {
    expect(summarize([], "2026-10-05")).toEqual({ days: 7, checkIns: 0, mood: null, energy: null, sleepHours: null });
  });

  it("livello più vicino alla media", () => {
    expect(nearestLevel(3.67)).toBe(4);
    expect(nearestLevel(1.2)).toBe(1);
    expect(nearestLevel(9)).toBe(5);
  });
});

describe("ricerca", () => {
  const pages = [
    { day: "2026-10-01", text: "Allenamento duro, perché ero stanco." },
    { day: "2026-10-03", text: "Giornata tranquilla al lago." },
    { day: "2026-10-02", text: "Привет, мир. 今天很好。" },
  ];

  it("ricerca vuota: tutte, dalla più recente", () => {
    expect(searchPages(pages, " ").map((p) => p.day)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
  });

  it("senza maiuscole né accenti, anche in altri alfabeti", () => {
    expect(searchPages(pages, "PERCHE").map((p) => p.day)).toEqual(["2026-10-01"]);
    expect(searchPages(pages, "мир").map((p) => p.day)).toEqual(["2026-10-02"]);
    expect(searchPages(pages, "很好").map((p) => p.day)).toEqual(["2026-10-02"]);
    expect(searchPages(pages, "montagna")).toEqual([]);
  });

  it("estratto: l'inizio, oppure attorno a ciò che si cerca", () => {
    const text = `${"parola ".repeat(40)}trovato qui ${"altro ".repeat(40)}`;
    expect(excerpt("Breve.", "")).toEqual({ text: "Breve.", before: false, after: false });
    const start = excerpt(text, "", 50);
    expect(start.before).toBe(false);
    expect(start.after).toBe(true);
    const found = excerpt(text, "TROVATO", 50);
    expect(found.before).toBe(true);
    expect(found.text).toContain("trovato");
    // Se ciò che si cerca è già visibile dall'inizio, l'estratto parte dall'inizio.
    expect(excerpt("Una passeggiata al lago, perché no?", "perche", 50).before).toBe(false);
  });

  it("estratto senza spezzare le emoji", () => {
    expect(excerpt("😀😀😀😀", "", 2).text).toBe("😀😀");
  });
});
