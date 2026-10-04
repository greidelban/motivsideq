import type { Better } from "./stats";

// Identificativi stabili (usati negli URL e nei dati salvati). I testi di ogni
// gioco sono nei dizionari, sotto `games.<id>`.
export const GAME_IDS = ["reaction", "colors", "math", "schulte"] as const;
export type GameId = (typeof GAME_IDS)[number];

// Nomi usati nella prima versione, ancora presenti nei dati salvati in locale.
export const LEGACY_GAME_IDS: Record<string, GameId> = {
  reazione: "reaction",
  colori: "colors",
  calcolo: "math",
};

export type GameInfo = {
  id: GameId;
  better: Better;
  /** Decimali con cui mostrare il punteggio. */
  decimals: number;
};

export const GAMES: Record<GameId, GameInfo> = {
  reaction: { id: "reaction", better: "lower", decimals: 0 },
  colors: { id: "colors", better: "lower", decimals: 0 },
  math: { id: "math", better: "higher", decimals: 1 },
  schulte: { id: "schulte", better: "lower", decimals: 1 },
};

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}
