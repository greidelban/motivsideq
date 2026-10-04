import { describe, expect, it } from "vitest";
import { effectiveMotion, motionLabel, timeScale } from "./motion";

describe("effectiveMotion", () => {
  it("converte il livello 0..100 in 0..1", () => {
    expect(effectiveMotion(70, false)).toBeCloseTo(0.7);
    expect(effectiveMotion(0, false)).toBe(0);
    expect(effectiveMotion(150, false)).toBe(1);
    expect(effectiveMotion(-5, false)).toBe(0);
  });

  it("'riduci movimento' del sistema vince sempre", () => {
    expect(effectiveMotion(100, true)).toBe(0);
  });
});

describe("timeScale", () => {
  it("fermo a 0, poi cresce con il livello", () => {
    expect(timeScale(0)).toBe(0);
    expect(timeScale(0.01)).toBeGreaterThan(0.39);
    expect(timeScale(0.5)).toBeLessThan(timeScale(1));
    expect(timeScale(1)).toBeCloseTo(2.2);
  });
});

describe("motionLabel", () => {
  it("dà un nome ai livelli del cursore", () => {
    expect(motionLabel(0)).toBe("still");
    expect(motionLabel(30)).toBe("calm");
    expect(motionLabel(70)).toBe("lively");
    expect(motionLabel(100)).toBe("max");
  });
});
