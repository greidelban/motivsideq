"use client";

import { z } from "zod";
import { defineStore } from "@/lib/storage/local-store";
import { type BodyWeight, type Profile, bodyWeightSchema, profileSchema } from "./profile";

const EMPTY_PROFILE: Profile = {};
const NO_WEIGHTS: BodyWeight[] = [];

export const profile = defineStore("profile", profileSchema, EMPTY_PROFILE);

/** Storico del peso (come la tabella body_weights): l'ultimo valore è il peso attuale. */
export const bodyWeights = defineStore("body-weights", z.array(bodyWeightSchema).max(5000), NO_WEIGHTS);
