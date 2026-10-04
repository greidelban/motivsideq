import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { NewPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nuova password" };

// Si arriva qui dal link "password dimenticata" (che apre una sessione di recupero).
export default async function NewPasswordPage() {
  await requireUser();
  return (
    <>
      <h1 className="mb-1 text-title2 font-bold">Scegli una nuova password</h1>
      <p className="mb-6 text-subhead text-muted">Dopo il salvataggio entrerai direttamente nell&apos;app.</p>
      <NewPasswordForm />
    </>
  );
}
