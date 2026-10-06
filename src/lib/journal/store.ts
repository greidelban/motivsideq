"use client";

import { localDb } from "@/lib/storage/db";
import { DEFS } from "@/lib/storage/definitions";
import { isCloudLinked } from "@/lib/sync/run";

export const checkIns = localDb.store(DEFS.checkIns);
export const journalPages = localDb.store(DEFS.journalPages);

/**
 * Cancella davvero tutto il diario, check-in compresi.
 * Senza cloud spariscono subito dal dispositivo; con il cloud diventano segnali
 * di cancellazione vuoti, così spariscono anche dagli altri dispositivi
 * (come deleteCycleData).
 */
export function deleteJournalData() {
  if (isCloudLinked()) {
    checkIns.clear();
    journalPages.clear();
  } else {
    checkIns.purge();
    journalPages.purge();
  }
}
