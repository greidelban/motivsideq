import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";
import { DISCLAIMER_TEXT } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy" };

// TODO prima della pubblicazione: completare i dati del titolare e farla
// rivedere da un consulente privacy. Il testo descrive cosa fa davvero l'app.
const CONTROLLER = "[Nome e cognome / ragione sociale del titolare]";
const CONTACT = "[email di contatto per la privacy]";
const LAST_UPDATE = "3 ottobre 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-title3 font-semibold">{title}</h2>
      <div className="space-y-2 text-subhead text-ink-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main
      className="mx-auto w-full max-w-2xl px-4"
      style={{ paddingTop: "calc(var(--safe-top) + 24px)", paddingBottom: "calc(var(--safe-bottom) + 32px)" }}
    >
      <article className="glass-elevated space-y-6 rounded-xl p-6">
        <header>
          <p className="eyebrow mb-1">Aggiornata il {LAST_UPDATE}</p>
          <h1 className="text-title1 font-bold">Privacy di {APP_NAME}</h1>
          <p className="mt-2 text-subhead text-muted">In breve: i tuoi dati servono solo a te. Niente pubblicità, niente analytics, niente intelligenza artificiale, niente vendita a terzi.</p>
        </header>

        <Section title="Chi tratta i dati">
          <p>Titolare del trattamento: {CONTROLLER}. Contatto: {CONTACT}.</p>
          <p>
            I dati sono conservati su Supabase (database e autenticazione), che agisce come responsabile del
            trattamento, su server nell&apos;Unione Europea.
          </p>
        </Section>

        <Section title="Quali dati raccogliamo e perché">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Account</strong>: email e password (cifrata). Servono per farti accedere.</li>
            <li><strong>Profilo</strong>: sesso, altezza, mese e anno di nascita, livello di attività, obiettivo, storico del peso. Servono a calcolare i tuoi obiettivi e a verificare l&apos;età minima.</li>
            <li><strong>Diario</strong>: testo, umore, energia, ore di sonno.</li>
            <li><strong>Allenamenti</strong>: esercizi, serie, ripetizioni, pesi, sforzo percepito, note.</li>
            <li><strong>Alimentazione</strong>: pasti registrati, pasti preferiti, voti agli alimenti.</li>
            <li><strong>Ciclo mestruale</strong> (solo se lo attivi e solo da maggiorenne): date, sintomi, fame.</li>
          </ul>
          <p>
            Base giuridica: l&apos;esecuzione del servizio che hai richiesto. Per i dati del ciclo, che sono dati
            relativi alla salute (art. 9 GDPR), il tuo consenso esplicito e separato.
          </p>
        </Section>

        <Section title="Cosa è condiviso con altri utenti">
          <p>
            Solo gli alimenti che crei nel database comune (nome, marca, valori nutrizionali), senza il tuo nome. I tuoi
            voti sugli alimenti e tutti gli altri dati sono visibili solo a te.
          </p>
        </Section>

        <Section title="Dati del ciclo">
          <p>
            Il modulo è spento finché non lo attivi e dai il consenso. Puoi revocarlo quando vuoi: un solo tasto cancella
            tutti i dati del ciclo. Questi dati non entrano in statistiche aggregate, non vengono confrontati con quelli
            di altri utenti e non vengono condivisi.
          </p>
          <p>Il modulo non è un metodo contraccettivo né uno strumento diagnostico.</p>
        </Section>

        <Section title="Età">
          <p>
            L&apos;app è per persone dai 14 anni in su. Tra i 14 e i 17 anni alcune funzioni sono limitate (niente
            obiettivi di dimagrimento né obiettivo calorico, modulo ciclo non disponibile).
          </p>
        </Section>

        <Section title="Cookie">
          <p>Usiamo solo cookie tecnici necessari a mantenere l&apos;accesso. Nessun cookie di profilazione o di terze parti.</p>
        </Section>

        <Section title="Per quanto tempo">
          <p>
            Finché hai un account. Se lo cancelli, tutti i tuoi dati vengono eliminati. Gli alimenti che hai creato
            restano nel database comune, senza alcun collegamento a te.
          </p>
        </Section>

        <Section title="I tuoi diritti">
          <p>
            Puoi accedere ai tuoi dati, correggerli, scaricarli (export in JSON o CSV), cancellarli, revocare il
            consenso per il ciclo e opporti al trattamento. Per qualsiasi richiesta scrivi a {CONTACT}. Puoi anche
            presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).
          </p>
        </Section>

        <Section title="Avviso sulla salute">
          <p>{DISCLAIMER_TEXT}</p>
        </Section>

        <p className="text-subhead">
          <Link href="/" className="link">
            Torna all&apos;app
          </Link>
        </p>
      </article>
    </main>
  );
}
