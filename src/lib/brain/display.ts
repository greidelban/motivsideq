import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { GAMES, type GameId } from "./games";

/** Punteggio di un gioco con i decimali giusti e il separatore della lingua. */
export function formatScore(locale: Locale, game: GameId, score: number): string {
  return formatNumber(locale, score, GAMES[game].decimals);
}
