"use client";

import { useEffect } from "react";
import { type LightState, addPulse } from "./envelope";

// Stato condiviso della luce viva. Le schermate dicono "quanto" deve essere
// accesa e mandano impulsi; il renderer lo legge a ogni frame. Niente React
// state: aggiornare la luce non deve far ri-renderizzare l'interfaccia.

export const DEFAULT_ENERGY = 0.28;

const state: LightState & {
  /**
   * Inizio (performance.now) di un respiro guidato: il renderer calcola il
   * respiro da qui a ogni frame, così resta fluido. null = respiro a riposo.
   */
  breathStart: number | null;
  /** Accende la luce anche con lo sfondo "classico" (es. durante "Accendi"). */
  forceOn: boolean;
  /** Livello di animazione effettivo 0..1 (0 = immagine ferma). Vedi motion.ts. */
  motion: number;
} = { energy: DEFAULT_ENERGY, target: DEFAULT_ENERGY, pulse: 0, breathStart: null, forceOn: false, motion: 0.7 };

export function readLight() {
  return state;
}

export function writeLight(next: LightState) {
  state.energy = next.energy;
  state.pulse = next.pulse;
}

export function setLightEnergy(target: number) {
  state.target = Math.max(0, Math.min(1, target));
}

/** Un battito di luce: 0.2 piccolo (risposta giusta), 1 grande (record, fine routine). */
export function pulseLight(strength: number) {
  state.pulse = addPulse(state.pulse, strength);
}

export function setGuidedBreath(start: number | null) {
  state.breathStart = start;
}

export function setLightForceOn(on: boolean) {
  state.forceOn = on;
}

export function setLightMotion(motion: number) {
  state.motion = motion;
}

/**
 * Imposta l'intensità della luce finché il componente è montato.
 * `null` = non toccarla (la decide un componente genitore, es. la routine).
 */
export function useLightEnergy(target: number | null) {
  useEffect(() => {
    if (target === null) return;
    setLightEnergy(target);
    return () => setLightEnergy(DEFAULT_ENERGY);
  }, [target]);
}
