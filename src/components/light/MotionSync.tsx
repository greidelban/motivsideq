"use client";

import { useEffect, useSyncExternalStore } from "react";
import { appearance, paletteFor } from "@/lib/light/appearance";
import { setLightMotion } from "@/lib/light/bus";
import { effectiveMotion } from "@/lib/light/motion";
import { hexToRgb, paletteHex } from "@/lib/light/palettes";

const rgbVar = (hex: string) =>
  hexToRgb(hex)
    .map((c) => Math.round(c * 255))
    .join(" ");

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
 * - il valore per la luce viva (velocità e ampiezza dello sfondo);
 * - i colori dei due aloni dello sfondo "classico" (--aura-a, --aura-b).
 */
export function MotionSync() {
  const settings = appearance.use();
  const reduced = usePrefersReducedMotion();
  const m = effectiveMotion(settings.motion, reduced);
  const [, auraA, , auraB] = paletteHex("classic", paletteFor(settings, "classic"));

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--aura-a", rgbVar(auraA));
    root.style.setProperty("--aura-b", rgbVar(auraB));
  }, [auraA, auraB]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--motion", String(m));
    root.dataset.motion = m === 0 ? "off" : "on";
    setLightMotion(m);
  }, [m]);

  return null;
}
