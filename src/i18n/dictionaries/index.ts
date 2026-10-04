import type { Locale } from "../config";
import { type Dictionary, en } from "./en";
import { it } from "./it";

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = { en, it };
