"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { useLocalSaveFailed } from "@/lib/storage/db";

// Se il dispositivo rifiuta di salvare (spazio pieno, navigazione privata...),
// l'utente deve saperlo subito: altrimenti crede di aver salvato e perde i dati.
// Sparisce da solo al primo salvataggio riuscito.
export function SaveErrorBanner() {
  const { dict } = useI18n();
  const failed = useLocalSaveFailed();
  if (!failed) return null;
  return (
    <div
      role="alert"
      className="glass-elevated fixed inset-x-4 z-50 mx-auto max-w-md space-y-1 rounded-xl px-4 py-3 text-subhead"
      style={{ top: "calc(var(--safe-top) + 8px)" }}
    >
      <p className="text-warning">{dict.errors.saveFailed}</p>
      <Link href="/settings" className="link flex min-h-11 items-center">
        {dict.errors.saveFailedAction}
      </Link>
    </div>
  );
}
