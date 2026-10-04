// Sfondi scelti dall'utente in Impostazioni. "classic" è lo sfondo fermo in CSS
// (gli aloni viola/ciano di globals.css): niente WebGL, niente animazione.
export const BACKGROUNDS = ["smoke", "galaxy", "crystal", "sparkle", "prism", "classic"] as const;
export type BackgroundId = (typeof BACKGROUNDS)[number];
export type AnimatedBackgroundId = Exclude<BackgroundId, "classic">;

export const DEFAULT_BACKGROUND: BackgroundId = "smoke";

export function isAnimated(id: BackgroundId): id is AnimatedBackgroundId {
  return id !== "classic";
}

// Risoluzione di disegno rispetto allo schermo: il fumo è sfocato per natura,
// gli altri hanno dettagli fini (stelle, aghi, polvere, bordi netti) e ne vogliono di più.
export const RENDER_SCALE: Record<AnimatedBackgroundId, number> = {
  smoke: 0.5,
  galaxy: 0.75,
  crystal: 0.7,
  sparkle: 0.7,
  prism: 0.7,
};
