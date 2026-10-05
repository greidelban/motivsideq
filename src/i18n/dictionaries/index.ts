import type { Locale } from "../config";
import { ar } from "./ar";
import { de } from "./de";
import { type Dictionary, en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { he } from "./he";
import { it } from "./it";
import { pl } from "./pl";
import { pt } from "./pt";
import { ru } from "./ru";
import { zh } from "./zh";

export type { Dictionary };

// Sul server si importano tutte; al browser arriva solo quella attiva (layout radice).
export const DICTIONARIES: Record<Locale, Dictionary> = { en, it, es, fr, pt, de, pl, ru, zh, ar, he };
