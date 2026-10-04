import type { Metadata } from "next";
import { RoutineRunner } from "@/components/brain/RoutineRunner";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.mind.routine.title };
}

export default function WakeUpPage() {
  return <RoutineRunner />;
}
