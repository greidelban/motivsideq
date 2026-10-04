// Orologio ad alta precisione per misurare i tempi di risposta nei giochi.
// Va chiamato solo nei gestori di eventi e nei timer, mai durante il render.
export function now(): number {
  return performance.now();
}

export function msSince(start: number): number {
  return performance.now() - start;
}
