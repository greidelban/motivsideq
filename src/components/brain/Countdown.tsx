"use client";

import { useEffect, useEffectEvent, useState } from "react";

const STEP_MS = 650;

// 3 · 2 · 1 prima di partire, così il primo stimolo non coglie di sorpresa.
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const t = setTimeout(() => (n > 1 ? setN(n - 1) : done()), STEP_MS);
    return () => clearTimeout(t);
  }, [n]);

  return (
    <div className="grid flex-1 place-items-center" aria-live="assertive">
      <span key={n} className="materialize text-[96px] leading-none font-bold text-ink">
        {n}
      </span>
    </div>
  );
}
