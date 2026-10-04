"use client";

import { useLayoutEffect } from "react";
import { now } from "@/lib/clock";

// Oltre questo scarto il frame è arrivato in ritardo (scheda in background,
// telefono sotto sforzo): meglio tenere l'istante provvisorio.
const MAX_SHIFT_MS = 100;

/**
 * Sposta l'istante di partenza (già impostato quando lo stimolo viene mostrato)
 * al frame in cui lo stimolo è davvero disegnato, così il tempo di reazione non
 * include il ritardo di render. `trigger` cambia a ogni nuovo stimolo.
 */
export function useAlignToPaint(start: { current: number | null }, trigger: unknown) {
  useLayoutEffect(() => {
    if (trigger === null || trigger === undefined || trigger === false) return;
    const raf = requestAnimationFrame(() => {
      const painted = now();
      if (start.current !== null && painted - start.current < MAX_SHIFT_MS) start.current = painted;
    });
    return () => cancelAnimationFrame(raf);
  }, [start, trigger]);
}
