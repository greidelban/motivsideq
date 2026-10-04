import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/ui";
import { SignInForm } from "../forms";

export const metadata: Metadata = { title: "Accedi" };

const ERRORS: Record<string, string> = {
  link: "Il link non è valido o è scaduto. Accedi oppure richiedine uno nuovo.",
};

export default async function SignInPage({ searchParams }: PageProps<"/accedi">) {
  const { next, errore } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const error = typeof errore === "string" ? ERRORS[errore] : undefined;

  return (
    <>
      <h1 className="mb-1 text-title2 font-bold">Accedi</h1>
      <p className="mb-6 text-subhead text-muted">Inserisci email e password per continuare.</p>
      {error && (
        <div className="mb-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      <SignInForm next={nextPath} />
      <div className="mt-6 space-y-2 text-center text-subhead">
        <p>
          <Link href="/password-dimenticata" className="link">
            Password dimenticata?
          </Link>
        </p>
        <p className="text-muted">
          Non hai un account?{" "}
          <Link href="/registrati" className="link">
            Registrati
          </Link>
        </p>
      </div>
    </>
  );
}
