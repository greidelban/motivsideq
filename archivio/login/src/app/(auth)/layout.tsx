import type { ReactNode } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/app";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4"
      style={{ paddingTop: "calc(var(--safe-top) + 24px)", paddingBottom: "calc(var(--safe-bottom) + 24px)" }}
    >
      <p className="mb-6 text-center text-title2 font-bold tracking-tight">{APP_NAME}</p>
      <div className="glass-elevated materialize rounded-xl p-6">{children}</div>
      <p className="mt-6 text-center text-footnote text-muted">
        <Link href="/privacy" className="link">
          Privacy
        </Link>
      </p>
    </main>
  );
}
