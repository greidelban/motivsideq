import type { BackgroundId } from "@/lib/light/backgrounds";

// Anteprime in CSS: danno l'idea dello sfondo senza avviare altri WebGL.
export const WALLPAPER_PREVIEWS: Record<BackgroundId, string> = {
  smoke: [
    "linear-gradient(transparent 49%, rgb(255 230 235 / 0.7) 50%, transparent 51%)",
    "linear-gradient(90deg, transparent 49%, rgb(255 230 235 / 0.5) 50%, transparent 51%)",
    "radial-gradient(circle at 50% 50%, rgb(255 236 230 / 0.95) 0 6%, transparent 22%)",
    "radial-gradient(60% 45% at 25% 70%, rgb(235 110 200 / 0.55), transparent 70%)",
    "radial-gradient(55% 40% at 80% 25%, rgb(255 170 150 / 0.45), transparent 70%)",
    "#100810",
  ].join(", "),
  galaxy: [
    "radial-gradient(1px 1px at 18% 22%, #fff, transparent)",
    "radial-gradient(1px 1px at 78% 14%, #ffe6c8, transparent)",
    "radial-gradient(1px 1px at 86% 72%, #d6e2ff, transparent)",
    "radial-gradient(1px 1px at 28% 84%, #fff, transparent)",
    "radial-gradient(1px 1px at 62% 88%, #ffd9b8, transparent)",
    "radial-gradient(ellipse 12% 6% at 50% 50%, rgb(255 238 210 / 0.95), transparent 100%)",
    "radial-gradient(ellipse 46% 15% at 50% 50%, rgb(205 210 235 / 0.45), transparent 100%)",
    "#04050a",
  ].join(", "),
  crystal: [
    "linear-gradient(90deg, transparent 38%, rgb(200 225 255 / 0.35) 42%, transparent 46%, transparent 55%, rgb(255 215 170 / 0.25) 57%, transparent 60%)",
    "linear-gradient(transparent 49%, rgb(225 240 255 / 0.7) 50%, transparent 51%)",
    "radial-gradient(circle at 50% 50%, rgb(240 248 255 / 0.95) 0 6%, transparent 24%)",
    "repeating-conic-gradient(from 0deg at 50% 50%, rgb(170 220 255 / 0.25) 0 2deg, transparent 2deg 9deg)",
    "#060a12",
  ].join(", "),
  sparkle: [
    "radial-gradient(circle at 62% 34%, rgb(255 255 255 / 0.85) 0 5%, transparent 7%)",
    "radial-gradient(circle at 70% 48%, rgb(255 255 255 / 0.6) 0 7%, transparent 9%)",
    "radial-gradient(circle at 54% 56%, rgb(255 250 245 / 0.7) 0 4%, transparent 6%)",
    "radial-gradient(circle at 30% 70%, rgb(235 235 245 / 0.35) 0 9%, transparent 11%)",
    "radial-gradient(circle at 78% 22%, rgb(255 255 255 / 0.5) 0 3%, transparent 5%)",
    "radial-gradient(50% 45% at 62% 45%, rgb(220 220 230 / 0.25), transparent 70%)",
    "#0b0a0c",
  ].join(", "),
  prism: [
    "linear-gradient(32deg, transparent 49.4%, rgb(200 220 255 / 0.95) 50%, transparent 50.6%)",
    "linear-gradient(32deg, transparent 50%, rgb(150 170 255 / 0.25) 50.5%, transparent 75%)",
    "linear-gradient(118deg, transparent 49.5%, rgb(255 190 225 / 0.8) 50%, transparent 50.5%)",
    "linear-gradient(118deg, transparent 50%, rgb(255 170 215 / 0.18) 50.5%, transparent 70%)",
    "radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.9) 0 3%, transparent 9%)",
    "#05050a",
  ].join(", "),
  classic: [
    "radial-gradient(70% 50% at 10% 0%, rgb(176 38 255 / 0.45), transparent 70%)",
    "radial-gradient(60% 45% at 100% 40%, rgb(0 200 224 / 0.3), transparent 70%)",
    "#0a0e1a",
  ].join(", "),
};
