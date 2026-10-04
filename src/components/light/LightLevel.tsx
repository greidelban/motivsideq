"use client";

import { useLightEnergy } from "@/lib/light/bus";

/** Imposta l'intensità della luce viva da una pagina server (non disegna nulla). */
export function LightLevel({ energy }: { energy: number }) {
  useLightEnergy(energy);
  return null;
}
