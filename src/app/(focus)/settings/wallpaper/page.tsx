import type { Metadata } from "next";
import { GameHeader } from "@/components/brain/GameHeader";
import { LightLevel } from "@/components/light/LightLevel";
import { WallpaperPicker } from "@/components/wallpaper/WallpaperPicker";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.settings.wallpaper.title };
}

// Pagina a tutto schermo: lo sfondo vero si vede sopra, le scelte stanno in basso.
export default async function WallpaperPage() {
  const { dict } = await getI18n();
  const t = dict.settings.wallpaper;
  return (
    <>
      <LightLevel energy={0.45} />
      <GameHeader title={t.title} closeHref="/settings" closeLabel={dict.common.back} />
      {/* Spazio libero: lo sfondo vero si vede qui sopra le scelte. */}
      <div className="flex-1" />
      <WallpaperPicker />
    </>
  );
}
