import type { Metadata } from "next";
import Link from "next/link";
import { BackupPanel } from "@/components/BackupPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LocalDataPanel } from "@/components/LocalDataPanel";
import { MotionPicker } from "@/components/MotionPicker";
import { ProfilePanel } from "@/components/ProfilePanel";
import { PageHeader, Panel } from "@/components/ui";
import { WallpaperButton } from "@/components/wallpaper/WallpaperButton";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.settings.title };
}

export default async function SettingsPage() {
  const { dict } = await getI18n();
  const t = dict.settings;
  return (
    <>
      <PageHeader title={t.title} back={{ href: "/today", label: dict.common.back }} />
      <div className="space-y-4">
        <ProfilePanel />
        <WallpaperButton />
        <MotionPicker />
        <LanguagePicker />
        <LocalDataPanel />
        <BackupPanel />

        <Panel>
          <h2 className="mb-2 text-headline font-semibold">{t.disclaimerTitle}</h2>
          <Disclaimer />
        </Panel>

        <Panel>
          <h2 className="mb-2 text-headline font-semibold">{t.privacy.title}</h2>
          <p className="text-subhead text-ink-2">
            {t.privacy.body}{" "}
            <Link href="/privacy" className="link">
              {t.privacy.link}
            </Link>
          </p>
        </Panel>
      </div>
    </>
  );
}
