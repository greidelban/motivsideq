// Comportamento della "luce viva" (sfondo animato), separato dal rendering.
// Tutto qui è puro e testato; il disegno è in src/components/light/LivingLight.tsx.

export type LightState = {
  /** Intensità attuale 0..1 (insegue `target` senza scatti). */
  energy: number;
  /** Intensità desiderata, decisa dalla schermata. */
  target: number;
  /** Impulso momentaneo (risposta giusta, record…), decade da solo. */
  pulse: number;
};

// Velocità con cui l'energia insegue il valore desiderato e con cui gli impulsi si spengono.
export const ENERGY_RATE = 1.4;
export const PULSE_DECAY = 2.4;
export const MAX_PULSE = 1.5;

export function stepLight(s: LightState, dtSec: number): LightState {
  const dt = Math.max(0, Math.min(dtSec, 0.25)); // dopo una pausa lunga niente salti
  const k = 1 - Math.exp(-ENERGY_RATE * dt);
  return {
    target: s.target,
    energy: s.energy + (s.target - s.energy) * k,
    pulse: s.pulse * Math.exp(-PULSE_DECAY * dt),
  };
}

export function addPulse(current: number, strength: number): number {
  return Math.min(MAX_PULSE, current + Math.max(0, strength));
}

const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

export type Breath = { phase: "in" | "out"; /** 0 = svuoto, 1 = pieno */ value: number; /** 0..1 dentro la fase */ progress: number };

/** Respiro guidato: inspira per `inhaleMs`, espira per `exhaleMs`, in ciclo. */
export function breath(tMs: number, inhaleMs = 4000, exhaleMs = 6000): Breath {
  const cycle = inhaleMs + exhaleMs;
  const t = ((tMs % cycle) + cycle) % cycle;
  if (t < inhaleMs) {
    const progress = t / inhaleMs;
    return { phase: "in", value: easeInOut(progress), progress };
  }
  const progress = (t - inhaleMs) / exhaleMs;
  return { phase: "out", value: 1 - easeInOut(progress), progress };
}

/** Respiro lento "a riposo": la luce non è mai del tutto ferma. */
export function idleBreath(tMs: number): number {
  return breath(tMs, 3500, 5000).value;
}

/**
 * Curva dell'accensione: parte quasi al buio e cresce sempre più in fretta,
 * come un'alba che accelera. `progress` 0..1.
 */
export function ignitionEnergy(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return 0.08 + 0.92 * p ** 2.2;
}

/**
 * Intensità durante il respiro guidato: la luce si accende inspirando e si
 * abbassa espirando (`breathValue` 0..1), mentre `base` (la curva dell'alba)
 * alza piano tutto l'insieme. Calcolata a ogni frame, quindi senza ritardi.
 */
export function guidedEnergy(base: number, breathValue: number): number {
  return Math.max(0, Math.min(1, 0.08 + 0.45 * base + 0.6 * breathValue));
}
