import type { ReactNode } from "react";
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
    </>
  );
}
