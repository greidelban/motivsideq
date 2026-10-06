import { addDays } from "@/lib/dates";
import type { Period } from "@/lib/health/cycle";
import type { CheckIn } from "@/lib/journal/journal";
import type { Profile } from "@/lib/profile/profile";

// Profili di prova decisi con l'utente il 6/10/2026: da usare come persone vere
// quando si prova l'app (nel browser e nei test). Solo per lo sviluppo.
// Età indicata dall'utente: 20 anni entrambi (mese di nascita non indicato:
// gennaio 2006). Livello di attività non indicato.

export type Persona = { profile: Profile; kg: number };

export const PERSONAS = {
  giorgio: { profile: { displayName: "Giorgio", sex: "male", heightCm: 178, birthYear: 2006, birthMonth: 1 }, kg: 68 },
  marta: { profile: { displayName: "Marta", sex: "female", heightCm: 155, birthYear: 2006, birthMonth: 1 }, kg: 47 },
} as const satisfies Record<string, Persona>;

export type PersonaId = keyof typeof PERSONAS;

export type PersonaHistory = {
  checkIns: CheckIn[];
  workouts: { day: string; type: "gym" | "running"; minutes: number; intensity: 1 | 2 | 3 }[];
  reactions: { day: string; score: number }[];
  /** Solo per Marta. */
  periods: Period[];
};

/** Numeri pseudo-casuali ripetibili (stesso storico a ogni prova). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * Storico verosimile degli ultimi `days` giorni: sonno tra 5,5 e 9 ore, umore ed
 * energia un po' più alti dopo le notti piene e nei giorni di allenamento,
 * riflessi più rapidi dopo aver dormito. Giorgio fa palestra 3 volte a
 * settimana, Marta corre 2 volte e ha le mestruazioni ogni 28 giorni.
 */
export function personaHistory(id: PersonaId, today: string, days: number): PersonaHistory {
  const rand = seeded(id === "giorgio" ? 7 : 11);
  const out: PersonaHistory = { checkIns: [], workouts: [], reactions: [], periods: [] };
  const trainEvery = id === "giorgio" ? [1, 3, 5] : [2, 6];

  if (id === "marta") {
    for (let start = addDays(today, -12); start >= addDays(today, -(days + 28)); start = addDays(start, -28)) {
      out.periods.push({ id: `demo-${start}`, start, end: addDays(start, 4) });
    }
    out.periods.reverse();
  }
  const onPeriod = (day: string) => out.periods.some((p) => day >= p.start && day <= (p.end ?? p.start));

  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const [y, m, d] = day.split("-").map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    const sleepHours = Math.round((5.5 + rand() * 3.5) * 2) / 2;
    const trains = trainEvery.includes(weekday);
    const good = sleepHours >= 7;
    const level = (base: number) => Math.max(1, Math.min(5, Math.round(base + (rand() - 0.5) * 1.2)));
    const mood = level(3 + (good ? 0.8 : -0.3) + (trains ? 0.4 : 0) - (onPeriod(day) ? 0.8 : 0));
    const energy = level(3 + (good ? 0.6 : -0.5) + (trains ? 0.6 : 0) - (onPeriod(day) ? 0.7 : 0));
    // Qualche giorno senza check-in, come nella realtà.
    if (rand() > 0.12) out.checkIns.push({ day, sleepHours, mood, energy });
    if (trains) out.workouts.push({ day, type: id === "giorgio" ? "gym" : "running", minutes: id === "giorgio" ? 60 : 35, intensity: 2 });
    if (rand() > 0.3) out.reactions.push({ day, score: Math.round((good ? 275 : 310) + (rand() - 0.5) * 30) });
  }
  return out;
}
