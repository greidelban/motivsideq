import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type BackupEntry, buildBackup, countItems, mergeByKey, parseBackup, planImport } from "./backup";

const item = z.object({ id: z.string(), v: z.number() });
const ENTRIES: BackupEntry[] = [
  { name: "things", kind: "list", item, keyOf: ((x: { id: string }) => x.id) as (item: never) => string },
  { name: "profile", kind: "doc", schema: z.object({ name: z.string() }) },
];

describe("copia di sicurezza", () => {
  const current: Record<string, unknown> = { things: [{ id: "a", v: 1 }, { id: "b", v: 2 }], profile: { name: "Ada" } };
  const read = (name: string) => current[name];

  it("l'export contiene tutti gli store e si rilegge", () => {
    const file = buildBackup(ENTRIES, read, new Date("2026-10-04T10:00:00Z"));
    expect(file).toMatchObject({ app: "getcontrol", format: 1, exportedAt: "2026-10-04T10:00:00.000Z" });
    const back = parseBackup(JSON.stringify(file));
    expect(back).toEqual({ ok: true, file });
    expect(countItems(file)).toBe(3);
  });

  it("riconosce file non validi", () => {
    expect(parseBackup("non è json")).toEqual({ ok: false, reason: "json" });
    expect(parseBackup(JSON.stringify({ app: "altro", format: 1, exportedAt: "", data: {} }))).toEqual({ ok: false, reason: "format" });
    expect(parseBackup(JSON.stringify({ app: "getcontrol", format: 99, exportedAt: "", data: {} }))).toEqual({ ok: false, reason: "format" });
  });

  it("l'import unisce gli elenchi senza perdere nulla e sostituisce i documenti", () => {
    const file = buildBackup(ENTRIES, (name) =>
      name === "things" ? [{ id: "b", v: 20 }, { id: "c", v: 3 }, { id: "x", v: "rotto" }] : { name: "Grace" },
    );
    const plan = planImport(ENTRIES, file, read);
    expect(plan.writes).toEqual([
      { name: "things", value: [{ id: "a", v: 1 }, { id: "b", v: 20 }, { id: "c", v: 3 }] },
      { name: "profile", value: { name: "Grace" } },
    ]);
    expect(plan.counts).toEqual({ things: 2, profile: 1 });
    expect(plan.skipped).toBe(1);
  });

  it("store assenti dal file restano intatti", () => {
    const file = { app: "getcontrol" as const, format: 1 as const, exportedAt: "x", data: { profile: { name: "Grace" } } };
    expect(planImport(ENTRIES, file, read).writes.map((w) => w.name)).toEqual(["profile"]);
  });

  it("mergeByKey: ordine dei presenti, nuovi in fondo", () => {
    expect(mergeByKey([{ k: "1" }, { k: "2" }], [{ k: "3" }, { k: "1" }], (x) => x.k)).toEqual([{ k: "1" }, { k: "2" }, { k: "3" }]);
  });
});

describe("completezza dell'export", () => {
  it("ogni dato dell'utente finisce nel file", async () => {
    const { BACKUP_STORE_NAMES } = await import("./backup-stores");
    const { ALL_DEFS } = await import("./definitions");
    // Solo il segno "ciclo cancellato il…" resta fuori: è una nota interna, non un dato.
    const userData = ALL_DEFS.map((d) => d.name).filter((n) => n !== "cycle-wiped-at");
    expect(BACKUP_STORE_NAMES).toEqual(expect.arrayContaining([...userData, "appearance", "brain-settings"]));
  });
});

describe("cambio di nome dell'app", () => {
  it("i file esportati quando l'app si chiamava Ritmo si importano ancora", () => {
    const old = { app: "ritmo", format: 1, exportedAt: "2026-10-04T10:00:00.000Z", data: { profile: { name: "Ada" } } };
    expect(parseBackup(JSON.stringify(old))).toEqual({ ok: true, file: { ...old, app: "getcontrol" } });
  });
});
