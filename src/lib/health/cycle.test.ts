import { describe, expect, it } from "vitest";
import {
  type Period,
  cycleLengths,
  cycleStats,
  cycleStatus,
  endPeriod,
  setFlow,
  startPeriod,
  toggleSymptom,
  upcomingStarts,
} from "./cycle";

const p = (start: string, end?: string): Period => ({ id: start, start, end });

describe("medie del ciclo", () => {
  it("senza storico usa 28 e 5 giorni", () => {
    expect(cycleStats([p("2026-09-01")])).toMatchObject({ cycleLength: 28, periodLength: 5, basedOn: 0, irregular: false });
  });

  it("media delle durate, scartando quelle impossibili", () => {
    const periods = [p("2026-05-01", "2026-05-04"), p("2026-05-31", "2026-06-05"), p("2026-06-30"), p("2026-07-05"), p("2026-08-02")];
    // 30, 30, (5 scartato), 28
    expect(cycleLengths(periods)).toEqual([30, 30, 28]);
    expect(cycleStats(periods)).toMatchObject({ cycleLength: 29, periodLength: 5, basedOn: 3 });
  });

  it("riconosce un ciclo irregolare", () => {
    const periods = [p("2026-01-01"), p("2026-01-23"), p("2026-02-28"), p("2026-03-25")];
    // 22, 36, 25 → scarto 14 giorni
    expect(cycleStats(periods).irregular).toBe(true);
  });
});

describe("stato del ciclo", () => {
  const periods = [p("2026-08-01", "2026-08-05"), p("2026-08-29", "2026-09-02"), p("2026-09-26", "2026-09-30")];
  // cicli di 28 giorni, mestruazioni di 5

  it("nessun dato → null", () => {
    expect(cycleStatus([], "2026-10-04")).toBeNull();
  });

  it("fasi lungo il ciclo", () => {
    expect(cycleStatus(periods, "2026-09-27")).toMatchObject({ day: 2, phase: "menstrual", nextStart: "2026-10-24" });
    expect(cycleStatus(periods, "2026-10-04")).toMatchObject({ day: 9, phase: "follicular", daysUntilNext: 20 });
    // Ovulazione 14 giorni prima: 10 ottobre; finestra fertile 5–11 ottobre.
    const s = cycleStatus(periods, "2026-10-10")!;
    expect(s).toMatchObject({ phase: "fertile", ovulation: "2026-10-10", fertileStart: "2026-10-05", fertileEnd: "2026-10-11" });
    expect(cycleStatus(periods, "2026-10-15")!.phase).toBe("luteal");
    expect(cycleStatus(periods, "2026-10-24")).toMatchObject({ phase: "luteal", daysUntilNext: 0 });
    expect(cycleStatus(periods, "2026-10-27")).toMatchObject({ phase: "late", daysUntilNext: -3, day: 32 });
  });

  it("mestruazione aperta: fine stimata con la durata media", () => {
    const s = cycleStatus([...periods, p("2026-10-24")], "2026-10-25")!;
    expect(s).toMatchObject({ phase: "menstrual", periodOpen: true, periodEnd: "2026-10-28" });
  });

  it("prossimi inizi previsti, anche in ritardo", () => {
    expect(upcomingStarts(cycleStatus(periods, "2026-10-04")!, 3)).toEqual(["2026-10-24", "2026-11-21", "2026-12-19"]);
    expect(upcomingStarts(cycleStatus(periods, "2026-10-27")!, 1)).toEqual(["2026-10-27"]);
  });
});

describe("registrazione", () => {
  it("rifiuta date future, doppioni e giorni dentro una mestruazione", () => {
    const periods = [p("2026-09-26", "2026-09-30")];
    expect(startPeriod(periods, "2026-10-05", "2026-10-04", "x")).toEqual({ ok: false, reason: "future" });
    expect(startPeriod(periods, "2026-09-26", "2026-10-04", "x")).toEqual({ ok: false, reason: "duplicate" });
    expect(startPeriod(periods, "2026-09-28", "2026-10-04", "x")).toEqual({ ok: false, reason: "insidePeriod" });
  });

  it("chiude la mestruazione rimasta aperta", () => {
    const r = startPeriod([p("2026-09-01")], "2026-09-29", "2026-10-04", "new");
    expect(r).toEqual({ ok: true, periods: [p("2026-09-01", "2026-09-05"), { id: "new", start: "2026-09-29" }] });
  });

  it("segna la fine della mestruazione più recente", () => {
    expect(endPeriod([p("2026-09-01", "2026-09-05"), p("2026-09-29")], "2026-10-03")).toEqual([
      p("2026-09-01", "2026-09-05"),
      p("2026-09-29", "2026-10-03"),
    ]);
    expect(endPeriod([p("2026-09-29")], "2026-09-20")).toBeNull();
  });

  it("sintomi e flusso del giorno; un giorno vuoto sparisce", () => {
    let logs = toggleSymptom([], "2026-10-04", "cramps");
    logs = setFlow(logs, "2026-10-04", "light");
    expect(logs).toEqual([{ day: "2026-10-04", symptoms: ["cramps"], flow: "light" }]);
    logs = toggleSymptom(logs, "2026-10-04", "cramps");
    logs = setFlow(logs, "2026-10-04", undefined);
    expect(logs).toEqual([]);
  });
});
