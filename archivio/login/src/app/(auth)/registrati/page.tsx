import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "../forms";

export const metadata: Metadata = { title: "Registrati" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-1 text-title2 font-bold">Crea il tuo account</h1>
      <p className="mb-6 text-subhead text-muted">Serve un&apos;email: ti mandiamo un link per confermarla.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-footnote text-muted">
        Registrandoti confermi di avere almeno 14 anni e di aver letto l&apos;
        <Link href="/privacy" className="link">
          informativa privacy
        </Link>
        .
      </p>
      <p className="mt-3 text-center text-subhead text-muted">
        Hai già un account?{" "}
        <Link href="/accedi" className="link">
          Accedi
        </Link>
      </p>
    </>
  );
}
