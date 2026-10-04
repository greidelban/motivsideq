import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameHeader } from "@/components/brain/GameHeader";
import { GameRunner } from "@/components/brain/GameRunner";
import { getI18n } from "@/i18n/server";
import { isGameId } from "@/lib/brain/games";

export async function generateMetadata({ params }: PageProps<"/mind/[game]">): Promise<Metadata> {
  const { game } = await params;
  const { dict } = await getI18n();
  return { title: isGameId(game) ? dict.games[game].name : dict.mind.title };
}

export default async function GamePage({ params }: PageProps<"/mind/[game]">) {
  const { game } = await params;
  if (!isGameId(game)) notFound();
  const { dict } = await getI18n();

  return (
    <>
      <GameHeader title={dict.games[game].name} />
      <GameRunner game={game} />
    </>
  );
}
