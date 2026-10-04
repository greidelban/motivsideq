// Quanto è animata l'app: un livello 0..100 scelto dall'utente (cursore in
// Impostazioni). "Riduci movimento" del sistema operativo vince sempre: con
// quello attivo tutto resta fermo, qualunque sia il livello scelto.

export const DEFAULT_MOTION_LEVEL = 70;

/** Livello effettivo 0..1 (0 = tutto fermo). */
export function effectiveMotion(level: number, prefersReducedMotion: boolean): number {
  if (prefersReducedMotion) return 0;
  return Math.max(0, Math.min(100, level)) / 100;
}

/**
 * Velocità dello sfondo rispetto a quella di base: ferma a 0, poi da lenta
 * (0.4×) a molto vivace (2.2×). Le animazioni non partono mai "a scatti" dallo zero.
 */
export function timeScale(motion: number): number {
  if (motion <= 0) return 0;
  return 0.4 + 1.8 * Math.min(1, motion);
}

export type MotionLabel = "still" | "calm" | "lively" | "max";

export function motionLabel(level: number): MotionLabel {
  if (level <= 0) return "still";
  if (level <= 40) return "calm";
  if (level <= 80) return "lively";
  return "max";
}
