import { describe, expect, it } from "vitest";
import { type Period, cycleStatus, togglePeriodDay } from "./cycle";
import { cycleCalendar, monthGrid } from "./cycle-calendar";
import { DEFAULT_CYCLE_PREFS, planCycleReminders } from "./cycle-reminders";

const p = (start: string, end?: string): Period => (end ? { id: start, start, end } : { id: start, start });
const TODAY = "2026-10-20";
const toggle = (periods: Period[], day: string) => togglePeriodDay(periods, day, TODAY, "new");

describe("segnare i giorni di ciclo dal calendario", () => {
  it("un giorno isolato crea una mestruazione con la durata media", () => {
    expect(toggle([], "2026-10-01")).toEqual([{ id: "new", start: "2026-10-01", end: "2026-10-05" }]);
  });

  it("toccando oggi senza nulla in corso, la mestruazione resta aperta", () => {
    expect(toggle([], TODAY)).toEqual([{ id: "new", start: TODAY }]);
  });

  it("vicino a oggi non va oltre oggi e resta in corso", () => {
    expect(toggle([], "2026-10-18")).toEqual([{ id: "new", start: "2026-10-18" }]);
  });

  it("una nuova non si sovrappone alla mestruazione successiva", () => {
    // 30/9 non tocca il 3/10: nuova dal 30/9 al 2/10 (si ferma prima del 3).
    expect(toggle([p("2026-10-03", "2026-10-07")], "2026-09-30")).toEqual([
      { id: "new", start: "2026-09-30", end: "2026-10-02" },
      { id: "2026-10-03", start: "2026-10-03", end: "2026-10-07" },
    ]);
  });

  it("un giorno accanto allunga la mestruazione, prima o dopo", () => {
    expect(toggle([p("2026-10-01", "2026-10-04")], "2026-10-05")).toEqual([{ id: "2026-10-01", start: "2026-10-01", end: "2026-10-05" }]);
    expect(toggle([p("2026-10-02", "2026-10-04")], "2026-10-01")).toEqual([{ id: "2026-10-02", start: "2026-10-01", end: "2026-10-04" }]);
  });

  it("un giorno che tocca due mestruazioni le unisce", () => {
    expect(toggle([p("2026-10-01", "2026-10-03"), p("2026-10-05", "2026-10-06")], "2026-10-04")).toEqual([
      { id: "2026-10-01", start: "2026-10-01", end: "2026-10-06" },
    ]);
  });

  it("togliere il primo giorno sposta l'inizio; un altro giorno accorcia la fine", () => {
    const periods = [p("2026-10-01", "2026-10-05")];
    expect(toggle(periods, "2026-10-01")).toEqual([{ id: "2026-10-01", start: "2026-10-02", end: "2026-10-05" }]);
    expect(toggle(periods, "2026-10-05")).toEqual([{ id: "2026-10-01", start: "2026-10-01", end: "2026-10-04" }]);
    expect(toggle(periods, "2026-10-03")).toEqual([{ id: "2026-10-01", start: "2026-10-01", end: "2026-10-02" }]);
  });

  it("togliere l'unico giorno cancella la mestruazione", () => {
    expect(toggle([p("2026-10-01", "2026-10-01")], "2026-10-01")).toEqual([]);
  });

  it("una mestruazione in corso si chiude togliendo un giorno", () => {
    // Iniziata il 18, oggi 20: i giorni 18-20 sono segnati; togliendo il 20 finisce il 19.
    expect(toggle([p("2026-10-18")], TODAY)).toEqual([{ id: "2026-10-18", start: "2026-10-18", end: "2026-10-19" }]);
  });

  it("i giorni futuri non si toccano", () => {
    expect(toggle([], "2026-10-21")).toBeNull();
  });
});

describe("calendario", () => {
  const periods = [p("2026-08-25", "2026-08-29"), p("2026-09-22", "2026-09-26")];
  const status = cycleStatus(periods, TODAY)!;
  const marks = cycleCalendar(periods, [{ day: "2026-09-23", flow: "medium", symptoms: [] }], status, TODAY);

  it("segna i giorni registrati e quelli con flusso o sintomi", () => {
    expect(marks.get("2026-09-22")?.period).toBe("logged");
    expect(marks.get("2026-09-26")?.period).toBe("logged");
    expect(marks.get("2026-09-27")?.period ?? null).toBeNull();
    expect(marks.get("2026-09-23")?.hasLog).toBe(true);
  });

  it("prevede le prossime mestruazioni solo da oggi in avanti", () => {
    // Ciclo di 28 giorni: prossimo inizio il 20/10, poi il 17/11.
    expect(status.nextStart).toBe("2026-10-20");
    expect(marks.get("2026-10-20")?.period).toBe("predicted");
    expect(marks.get("2026-10-24")?.period).toBe("predicted");
    expect(marks.get("2026-11-17")?.period).toBe("predicted");
    expect([...marks].some(([day, m]) => m.period === "predicted" && day < TODAY)).toBe(false);
  });

  it("mostra ovulazione e finestra fertile dei cicli previsti", () => {
    // Ciclo dal 20/10: ovulazione 14 giorni prima del 17/11 = 3/11.
    expect(marks.get("2026-11-03")?.ovulation).toBe(true);
    expect(marks.get("2026-10-29")?.fertile).toBe(true);
    expect(marks.get("2026-11-04")?.fertile).toBe(true);
    expect(marks.get("2026-11-05")?.fertile ?? false).toBe(false);
  });

  it("senza dati non prevede nulla", () => {
    expect(cycleCalendar([], [], null, TODAY).size).toBe(0);
  });
});

describe("griglia del mese", () => {
  it("ottobre 2026 parte di giovedì: 3 caselle vuote se la settimana inizia di lunedì", () => {
    const grid = monthGrid(2026, 10, 1);
    expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(grid.filter(Boolean)).toHaveLength(31);
    expect(grid.length % 7).toBe(0);
  });

  it("con la settimana che inizia di domenica le caselle vuote sono 4", () => {
    expect(monthGrid(2026, 10, 7).indexOf("2026-10-01")).toBe(4);
  });

  it("febbraio e dicembre", () => {
    expect(monthGrid(2028, 2, 1).filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2026, 12, 1).filter(Boolean).at(-1)).toBe("2026-12-31");
  });
});

describe("promemoria del ciclo", () => {
  const status = cycleStatus([p("2026-09-22", "2026-09-26")], "2026-10-01")!;
  const texts = { title: "GetControl", discreet: "A reminder for you.", detailed: (n: number) => `Your period may start in ${n} days.` };
  const now = new Date(2026, 9, 1, 12);

  it("spenti di partenza: nessuna notifica", () => {
    expect(planCycleReminders({ now, status, prefs: DEFAULT_CYCLE_PREFS, texts })).toEqual([]);
  });

  it("prima dei prossimi cicli, alle 9, con testo discreto di default", () => {
    const plan = planCycleReminders({ now, status, prefs: { ...DEFAULT_CYCLE_PREFS, reminders: true }, texts });
    // Prossimi inizi 20/10 e 17/11, due giorni prima.
    expect(plan.map((n) => new Date(n.at))).toEqual([new Date(2026, 9, 18, 9), new Date(2026, 10, 15, 9)]);
    expect(plan.every((n) => n.body === texts.discreet && n.title === "GetControl")).toBe(true);
    expect(plan.every((n) => !/period|cycle|ciclo/i.test(n.title + n.body))).toBe(true);
  });

  it("con il testo esplicito scelto dall'utente dice quanti giorni mancano", () => {
    const plan = planCycleReminders({ now, status, prefs: { ...DEFAULT_CYCLE_PREFS, reminders: true, discreet: false, daysBefore: 1 }, texts });
    expect(plan[0].body).toBe("Your period may start in 1 days.");
    expect(new Date(plan[0].at)).toEqual(new Date(2026, 9, 19, 9));
  });

  it("niente promemoria già passati né senza dati", () => {
    const late = new Date(2026, 9, 19, 12);
    const plan = planCycleReminders({ now: late, status, prefs: { ...DEFAULT_CYCLE_PREFS, reminders: true }, texts });
    expect(plan.map((n) => new Date(n.at))).toEqual([new Date(2026, 10, 15, 9)]);
    expect(planCycleReminders({ now, status: null, prefs: { ...DEFAULT_CYCLE_PREFS, reminders: true }, texts })).toEqual([]);
  });
});
