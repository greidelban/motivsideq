import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Password dimenticata" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-title2 font-bold">Password dimenticata</h1>
      <p className="mb-6 text-subhead text-muted">Ti mandiamo un link per sceglierne una nuova.</p>
      <ResetPasswordForm />
      <p className="mt-6 text-center text-subhead">
        <Link href="/accedi" className="link">
          Torna all&apos;accesso
        </Link>
      </p>
    </>
  );
}
