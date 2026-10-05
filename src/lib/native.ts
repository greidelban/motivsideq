// L'app gira come app nativa (Capacitor su iPhone o Android) o nel browser?
// Si legge da window.Capacitor, così il sito non dipende dai pacchetti nativi.

export type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

export function nativeApp(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}
