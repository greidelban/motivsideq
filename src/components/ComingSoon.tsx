import { Panel } from "@/components/ui";
import { interpolate } from "@/i18n/format";
import { getI18n } from "@/i18n/server";

// Segnaposto per i moduli non ancora costruiti (verrà rimosso modulo per modulo).
export async function ComingSoon({ what }: { what: string }) {
  const { dict } = await getI18n();
  return (
    <Panel className="text-center">
      <p className="eyebrow mb-2">{dict.common.comingSoonEyebrow}</p>
      <p className="text-subhead text-ink-2">{interpolate(dict.common.comingSoon, { what })}</p>
    </Panel>
  );
}
