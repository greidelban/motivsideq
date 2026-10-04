import { type Rng, pick } from "@/lib/random";
import { mean } from "./stats";

// Test di Stroop: compare il NOME di un colore scritto con un inchiostro di un
// altro colore; si tocca il colore dell'INCHIOSTRO. Allena attenzione e controllo.
// Colori scelti per essere ben distinguibili sul fondo scuro; i pulsanti
// riportano anche il nome (nei dizionari, games.colors.names), quindi non si
// risponde solo col colore.
export const STROOP_COLORS = [
  { id: "red", hex: "#ff5c5c" },
  { id: "green", hex: "#34d399" },
  { id: "blue", hex: "#60a5fa" },
  { id: "yellow", hex: "#facc15" },
] as const;

export type StroopColorId = (typeof STROOP_COLORS)[number]["id"];
export type StroopTrial = { word: StroopColorId; ink: StroopColorId };

export const STROOP_TRIALS = 20;
const STROOP_INCONGRUENT_RATIO = 0.75;

const IDS = STROOP_COLORS.map((c) => c.id);

export function generateStroopTrial(
  rng: Rng,
  previous?: StroopTrial,
  incongruentRatio: number = STROOP_INCONGRUENT_RATIO,
): StroopTrial {
  for (;;) {
    const word = pick(rng, IDS);
    const ink = rng() < incongruentRatio ? pick(rng, IDS.filter((id) => id !== word)) : word;
    if (!previous || previous.word !== word || previous.ink !== ink) return { word, ink };
  }
}

export function stroopColor(id: StroopColorId) {
  return STROOP_COLORS.find((c) => c.id === id)!;
}

export type StroopAnswer = { correct: boolean; ms: number };

export function summarizeStroop(answers: readonly StroopAnswer[]) {
  const correct = answers.filter((a) => a.correct);
  const ms = correct.map((a) => a.ms);
  return {
    /** Tempo medio delle risposte giuste (ms): è il punteggio, più basso è meglio. */
    avgMs: ms.length ? Math.round(mean(ms)) : null,
    fastestMs: ms.length ? Math.round(Math.min(...ms)) : null,
    slowestMs: ms.length ? Math.round(Math.max(...ms)) : null,
    accuracy: answers.length ? Math.round((correct.length / answers.length) * 100) : 0,
    errors: answers.length - correct.length,
  };
}
