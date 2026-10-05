// Categorie e toni delle frasi, separati dall'archivio: le preferenze e le
// impostazioni li usano senza caricare tutte le frasi su ogni pagina.

export const QUOTE_CATEGORIES = ["discipline", "habits", "character", "recovery"] as const;
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

export const INTENSITIES = ["soft", "direct", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];
