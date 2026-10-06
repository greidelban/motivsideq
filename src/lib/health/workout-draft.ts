"use client";

import * as z from "zod/mini";
import { defineStore } from "@/lib/storage/local-store";

// Allenamento in corso: si compila mentre ci si allena (esercizio dopo
// esercizio) e non deve sparire se si chiude l'app o si cambia schermata.
// È una bozza temporanea di questo telefono: sta in localStorage, non va nel
// cloud né nel backup e sparisce appena l'allenamento si salva (o si scarta).
// I campi sono testo, come nei moduli: diventano numeri al salvataggio.

const text = (max: number) => z.string().check(z.maxLength(max));

const draftSetSchema = z.object({ reps: text(4), seconds: text(4), weight: text(7) });
export type DraftSet = z.infer<typeof draftSetSchema>;

const draftExerciseSchema = z.object({
  /** Chiave unica nella bozza (lo stesso esercizio può comparire due volte). */
  uid: text(40),
  exercise: text(40),
  name: z.optional(text(60)),
  sets: z.array(draftSetSchema).check(z.maxLength(30)),
});
export type DraftExercise = z.infer<typeof draftExerciseSchema>;

const draftSchema = z.nullable(
  z.object({
    type: text(20),
    minutes: text(3),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    day: text(10),
    note: text(200),
    distance: text(7),
    exercises: z.array(draftExerciseSchema).check(z.maxLength(40)),
  }),
);
export type WorkoutDraft = NonNullable<z.infer<typeof draftSchema>>;

export const workoutDraft = defineStore("workout-draft", draftSchema, null);

export const EMPTY_SET: DraftSet = { reps: "", seconds: "", weight: "" };
