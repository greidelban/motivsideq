import type { ReactNode } from "react";
import { DevPersonas } from "@/components/DevPersonas";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main
        className="mx-auto w-full max-w-md px-4"
        style={{
          paddingTop: "calc(var(--safe-top) + 16px)",
          paddingBottom: "calc(var(--safe-bottom) + var(--tabbar-height) + 32px)",
        }}
      >
        {children}
      </main>
      <TabBar />
      {/* Profili di prova (Giorgio, Marta): solo in sviluppo, mai nella versione pubblicata. */}
      {process.env.NODE_ENV === "development" && <DevPersonas />}
    </>
  );
}
