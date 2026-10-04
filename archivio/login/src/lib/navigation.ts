export const HOME_PATH = "/oggi";

// Pagine raggiungibili senza sessione. Tutto il resto richiede l'accesso.
export const PUBLIC_PATHS = ["/accedi", "/registrati", "/password-dimenticata", "/auth", "/privacy"] as const;

// Pagine per chi NON ha una sessione (chi è già dentro viene rimandato alla home).
export const GUEST_ONLY_PATHS = ["/accedi", "/registrati", "/password-dimenticata"] as const;

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicPath(pathname: string): boolean {
  return matches(pathname, PUBLIC_PATHS);
}

export function isGuestOnlyPath(pathname: string): boolean {
  return matches(pathname, GUEST_ONLY_PATHS);
}

/**
 * Accetta solo percorsi interni ("/qualcosa"), per evitare redirect verso siti
 * esterni tramite ?next=https://... o //dominio.
 */
export function safeNextPath(next: string | null | undefined, fallback: string = HOME_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
