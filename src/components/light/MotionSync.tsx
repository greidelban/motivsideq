"use client";

import { useEffect, useSyncExternalStore } from "react";
import { appearance } from "@/lib/light/appearance";
import { setLightMotion } from "@/lib/light/bus";
import { effectiveMotion } from "@/lib/light/motion";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** "Riduci movimento" del sistema operativo (false sul server). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * Applica il livello di animazione scelto in Impostazioni:
 * - `--motion` (0..1) sull'html, per scalare le animazioni CSS;
 * - `data-motion="off"` quando è 0, che le spegne tutte (come "riduci movimento");
 * - il valore per la luce viva (velocità e ampiezza dello sfondo).
 */
export function MotionSync() {
  const { motion } = appearance.use();
  const reduced = usePrefersReducedMotion();
  const m = effectiveMotion(motion, reduced);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--motion", String(m));
    root.dataset.motion = m === 0 ? "off" : "on";
    setLightMotion(m);
  }, [m]);

  return null;
}
