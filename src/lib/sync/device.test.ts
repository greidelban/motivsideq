import { IDBFactory } from "fake-indexeddb";
import { expect, it } from "vitest";
import { openIdbBackend } from "@/lib/storage/backends";
import { ALL_DEFS, DEFS } from "@/lib/storage/definitions";
import { createLocalDb } from "@/lib/storage/local-db";
import { deviceOnlyCount } from "./device";

const SYNCED = new Set([DEFS.bodyWeights.name, DEFS.workouts.name]);
const workout = { id: "w1", day: "2026-10-04", at: "2026-10-04T08:00:00.000Z", type: "running" as const, minutes: 30, intensity: 2 as const };

it("conta ciò che esiste solo sul dispositivo e lo toglie tutto", async () => {
  const idb = new IDBFactory();
  const db = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(idb), legacy: null });
  await db.start();
  const weights = db.store(DEFS.bodyWeights);
  const workouts = db.store(DEFS.workouts);
  const food = db.store(DEFS.foodEntries);

  expect(deviceOnlyCount(db, ALL_DEFS, SYNCED)).toBe(0);

  weights.set([{ day: "2026-10-04", kg: 70 }]);
  workouts.set([workout]);
  // Già nel cloud: non andrebbero persi.
  db.markClean(DEFS.bodyWeights.name, db.dirty(DEFS.bodyWeights.name));
  db.markClean(DEFS.workouts.name, db.dirty(DEFS.workouts.name));
  expect(deviceOnlyCount(db, ALL_DEFS, SYNCED)).toBe(0);

  // Una cancellazione non inviata conta: nel cloud resterebbe la riga.
  workouts.set([]);
  expect(deviceOnlyCount(db, ALL_DEFS, SYNCED)).toBe(1);

  // Un elenco che non si sincronizza: tutto ciò che c'è è solo qui.
  food.set([{ id: "f1", day: "2026-10-04", at: "2026-10-04T12:00:00.000Z", meal: "lunch", name: "Pasta", kcal: 600 }]);
  expect(deviceOnlyCount(db, ALL_DEFS, SYNCED)).toBe(2);

  db.purgeAll();
  await db.flush();
  expect(weights.get()).toEqual([]);
  expect(food.get()).toEqual([]);
  expect(deviceOnlyCount(db, ALL_DEFS, SYNCED)).toBe(0);

  // Anche su disco: riaprendo l'archivio non c'è più niente.
  const reopened = createLocalDb({ defs: ALL_DEFS, open: () => openIdbBackend(idb), legacy: null });
  await reopened.start();
  expect(ALL_DEFS.flatMap((d) => reopened.records(d.name))).toEqual([]);
});
