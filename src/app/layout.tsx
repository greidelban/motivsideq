import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { JetBrains_Mono, Onest } from "next/font/google";
import { LivingLight } from "@/components/light/LivingLight";
import { MotionSync } from "@/components/light/MotionSync";
import { SyncRunner } from "@/components/account/SyncRunner";
import { CycleReminderScheduler } from "@/components/health/CycleReminderScheduler";
import { QuoteScheduler } from "@/components/quotes/QuoteScheduler";
import { SaveErrorBanner } from "@/components/SaveErrorBanner";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { I18nProvider } from "@/i18n/client";
import { localeDir } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { APP_NAME, THEME_COLOR } from "@/lib/app";
import "./globals.css";

// Cirillico per il russo; cinese e arabo usano i caratteri di sistema (fallback in globals.css).
const onest = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-onest", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: dict.meta.description,
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // La CSP usa un nonce diverso per ogni richiesta: tutte le pagine devono
  // essere renderizzate al momento della richiesta, non in build.
  await connection();
  const { locale, dict } = await getI18n();

  return (
    <html lang={locale} dir={localeDir(locale)} className={`${onest.variable} ${jetbrainsMono.variable}`}>
      <body>
        <MotionSync />
        <LivingLight />
        <I18nProvider locale={locale} dict={dict}>
          {children}
          <SaveErrorBanner />
          <QuoteScheduler />
          <CycleReminderScheduler />
        </I18nProvider>
        <ServiceWorkerRegister />
        <SyncRunner />
      </body>
    </html>
  );
}
