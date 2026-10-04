import { IconInfo } from "@/components/icons";
import type { Dictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";

export async function Disclaimer() {
  const { dict } = await getI18n();
  return <p className="text-subhead text-ink-2">{dict.legal.disclaimer}</p>;
}

// Versione breve per le sezioni alimentazione, allenamento e ciclo.
export async function DisclaimerNote({ section }: { section: keyof Dictionary["legal"]["short"] }) {
  const { dict } = await getI18n();
  return (
    <p className="card flex gap-2.5 px-3.5 py-3 text-footnote text-muted">
      <IconInfo width={18} height={18} className="mt-px shrink-0" />
      <span>{dict.legal.short[section]}</span>
    </p>
  );
}
