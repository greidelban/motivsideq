import { describe, expect, it } from "vitest";
import { MAX_PULSE, addPulse, breath, guidedEnergy, idleBreath, ignitionEnergy, stepLight } from "./envelope";

describe("stepLight", () => {
  it("l'energia insegue il valore desiderato senza superarlo", () => {
    let s = { energy: 0.2, target: 0.8, pulse: 0 };
    let prev = s.energy;
    for (let i = 0; i < 120; i++) {
      s = stepLight(s, 1 / 30);
      expect(s.energy).toBeGreaterThanOrEqual(prev);
      expect(s.energy).toBeLessThanOrEqual(0.8);
      prev = s.energy;
    }
    expect(s.energy).toBeCloseTo(0.8, 1);
  });

  it("gli impulsi si spengono da soli", () => {
    let s = { energy: 0.3, target: 0.3, pulse: 1 };
    for (let i = 0; i < 60; i++) s = stepLight(s, 1 / 30);
    expect(s.pulse).toBeLessThan(0.15);
  });

  it("una pausa lunga (scheda in background) non provoca salti", () => {
    const s = stepLight({ energy: 0, target: 1, pulse: 1 }, 30);
    expect(s.energy).toBeLessThan(0.4);
    expect(s.pulse).toBeGreaterThan(0.5);
  });
});

describe("addPulse", () => {
  it("somma gli impulsi fino a un tetto", () => {
    expect(addPulse(0.2, 0.3)).toBeCloseTo(0.5);
    expect(addPulse(1.4, 1)).toBe(MAX_PULSE);
    expect(addPulse(0.2, -1)).toBe(0.2);
  });
});

describe("breath", () => {
  it("inspira da vuoto a pieno, poi espira", () => {
    expect(breath(0)).toMatchObject({ phase: "in", value: 0 });
    expect(breath(2000).value).toBeCloseTo(0.5);
    expect(breath(4000)).toMatchObject({ phase: "out", value: 1 });
    expect(breath(7000).value).toBeCloseTo(0.5);
    expect(breath(10000)).toMatchObject({ phase: "in", value: 0 });
  });

  it("resta tra 0 e 1, anche con tempi negativi", () => {
    for (let t = -5000; t < 30000; t += 137) {
      const v = breath(t).value;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(idleBreath(1234)).toBeGreaterThanOrEqual(0);
  });
});

describe("ignitionEnergy", () => {
  it("parte quasi al buio e arriva al massimo, accelerando", () => {
    expect(ignitionEnergy(0)).toBeCloseTo(0.08);
    expect(ignitionEnergy(1)).toBeCloseTo(1);
    // cresce poco all'inizio e molto alla fine
    expect(ignitionEnergy(0.5) - ignitionEnergy(0)).toBeLessThan(ignitionEnergy(1) - ignitionEnergy(0.5));
    expect(ignitionEnergy(2)).toBeCloseTo(1);
  });
});

describe("guidedEnergy", () => {
  it("la luce sale inspirando e scende espirando, in modo ben visibile", () => {
    for (const base of [0.1, 0.5, 1]) {
      const full = guidedEnergy(base, 1);
      const empty = guidedEnergy(base, 0);
      expect(full - empty).toBeGreaterThan(0.45);
    }
  });

  it("con l'alba che avanza anche il punto più basso si alza", () => {
    expect(guidedEnergy(1, 0)).toBeGreaterThan(guidedEnergy(0.1, 0));
  });

  it("resta tra 0 e 1", () => {
    expect(guidedEnergy(1, 1)).toBe(1);
    expect(guidedEnergy(0, 0)).toBeGreaterThanOrEqual(0);
  });
});
