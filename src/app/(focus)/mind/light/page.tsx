import type { Metadata } from "next";
import { GameHeader } from "@/components/brain/GameHeader";
import { LightUp } from "@/components/light/LightUp";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.mind.light.title };
}

export default async function LightUpPage() {
  const { dict } = await getI18n();
  return (
    <>
      <GameHeader title={dict.mind.light.title} />
      <LightUp />
    </>
  );
}
