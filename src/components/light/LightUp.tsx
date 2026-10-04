"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { now } from "@/lib/clock";
import { DEFAULT_ENERGY, pulseLight, setGuidedBreath, setLightEnergy, setLightForceOn } from "@/lib/light/bus";
import { breath, ignitionEnergy } from "@/lib/light/envelope";

const DURATION_MS = 30_000; // tre respiri da 10 s (4 dentro, 6 fuori)
// Un timer e non requestAnimationFrame: rAF si ferma quando la scheda non è in
// primo piano, mentre l'esercizio deve seguire l'orologio. La fluidità della luce
// la garantisce il renderer, che calcola il respiro da solo a ogni frame.
const TICK_MS = 100;
const DONE_ENERGY = 0.75;

function vibrate(ms: number) {
  // Solo dove esiste (Android); su iPhone non fa nulla.
  if ("vibrate" in navigator) navigator.vibrate(ms);
}

/**
 * "Accendi": si fissa la croce di luce e si respira con lei, mentre la luce viva
 * cresce dal buio fino a sbocciare. Lo sfondo è la luce stessa
 * (src/components/light/LivingLight.tsx): qui si guida solo il ritmo.
 */
export function LightUp({
  routine = false,
  onNext,
  nextLabel,
}: {
  routine?: boolean;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const { dict } = useI18n();
  const t = dict.mind.light;
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [inhaling, setInhaling] = useState(true);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (phase !== "run") return;
    const start = now();
    let lastPhase: "in" | "out" = "in";
    setGuidedBreath(start);
    vibrate(8);

    const id = setInterval(() => {
      const elapsed = now() - start;
      const progress = Math.min(1, elapsed / DURATION_MS);
      const b = breath(elapsed);
      setLightEnergy(ignitionEnergy(progress));
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      if (b.phase !== lastPhase) {
        lastPhase = b.phase;
        setInhaling(b.phase === "in");
        if (b.phase === "in") vibrate(8);
      }
      if (progress >= 1) {
        clearInterval(id);
        setGuidedBreath(null);
        setLightEnergy(DONE_ENERGY);
        pulseLight(1.4);
        vibrate(25);
        setPhase("done");
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  // L'esercizio è la luce: si accende anche se l'utente ha scelto lo sfondo classico.
  // Uscendo, la luce torna al suo respiro, alla sua intensità e allo sfondo scelto.
  useEffect(() => {
    setLightForceOn(true);
    return () => {
      setLightForceOn(false);
      setGuidedBreath(null);
      setLightEnergy(DEFAULT_ENERGY);
    };
  }, []);

  if (phase === "intro") {
    return (
      <div className="materialize flex flex-1 flex-col gap-4">
        <section className="glass-elevated rounded-xl p-6">
          <p className="eyebrow mb-1">{t.duration}</p>
          <h2 className="text-title2 font-bold">{t.title}</h2>
          <p className="mt-3 text-body text-ink-2">{t.howTo}</p>
          <p className="mt-3 text-footnote text-muted">{t.calmNote}</p>
        </section>
        <div className="mt-auto flex gap-3">
          {routine && onNext && (
            <button type="button" className="btn btn-ghost" onClick={onNext}>
              {dict.mind.intro.skip}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" onClick={() => setPhase("run")}>
            {dict.mind.intro.start}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "run") {
    // Il centro resta libero: è lì che si guarda la croce di luce.
    return (
      <div className="flex flex-1 flex-col justify-end gap-4 pb-6">
        <p
          key={inhaling ? "in" : "out"}
          className="materialize on-backdrop text-center text-title1 font-semibold text-ink"
          aria-live="polite"
        >
          {inhaling ? t.inhale : t.exhale}
        </p>
        <span className="mx-auto block h-1 w-40 overflow-hidden rounded-full bg-control" aria-hidden="true">
          <span
            ref={barRef}
            className="block h-full origin-left rounded-full bg-ink-2 transition-transform duration-100 ease-linear"
            style={{ transform: "scaleX(0)" }}
          />
        </span>
      </div>
    );
  }

  return (
    <div className="materialize flex flex-1 flex-col justify-end gap-4">
      <section className="glass-elevated rounded-xl p-6 text-center">
        <h2 className="text-title1 font-bold">{t.doneTitle}</h2>
        <p className="mt-2 text-body text-ink-2">{t.doneText}</p>
      </section>
      <div className="flex gap-3">
        {routine && onNext ? (
          <button type="button" className="btn btn-primary flex-1" onClick={onNext}>
            {nextLabel ?? dict.mind.result.next}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setPhase("run")}>
              {t.again}
            </button>
            <Link href="/mind" className="btn btn-primary flex-1">
              {dict.mind.result.done}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
