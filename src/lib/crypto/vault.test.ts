import { describe, expect, it } from "vitest";
import { keyIdOf, newDataKey, newRecoveryCode, parseRecoveryCode, unwrapDataKey, vaultCipher, wrapDataKey } from "./vault";

describe("caveau cifrato", () => {
  it("cifra e decifra una riga; il testo cifrato non contiene nulla di leggibile", async () => {
    const cipher = await vaultCipher(newDataKey());
    const id = await cipher.recordId("body-weights", "2026-10-04");
    const content = { c: "body-weights", k: "2026-10-04", v: { day: "2026-10-04", kg: 70 }, ca: "2026-10-04T08:00:00.000Z" };
    const payload = await cipher.seal(id, content);
    expect(payload.startsWith("v1.")).toBe(true);
    // Solo parole di almeno 4 lettere: due lettere ("kg") compaiono per caso nel base64 circa una volta su 20.
    expect(payload).not.toMatch(/body|weights|2026/);
    expect(await cipher.open(id, payload)).toEqual(content);
  });

  it("id delle righe: stessi dati → stesso id; nessuna traccia del tipo o del giorno", async () => {
    const key = newDataKey();
    const a = await vaultCipher(key);
    const b = await vaultCipher(key);
    const other = await vaultCipher(newDataKey());
    const id = await a.recordId("cycle-day-logs", "2026-10-04");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await b.recordId("cycle-day-logs", "2026-10-04")).toBe(id);
    expect(await a.recordId("cycle-day-logs", "2026-10-05")).not.toBe(id);
    expect(await other.recordId("cycle-day-logs", "2026-10-04")).not.toBe(id);
  });

  it("rifiuta una riga modificata, spostata su un altro id o cifrata con un'altra chiave", async () => {
    const cipher = await vaultCipher(newDataKey());
    const id = await cipher.recordId("workouts", "w1");
    const payload = await cipher.seal(id, { c: "workouts", k: "w1", v: { minutes: 30 }, ca: "x" });
    const flipped = payload.slice(0, -4) + (payload.endsWith("AAAA") ? "BBBB" : "AAAA");
    await expect(cipher.open(id, flipped)).rejects.toThrow();
    await expect(cipher.open(await cipher.recordId("workouts", "w2"), payload)).rejects.toThrow();
    await expect((await vaultCipher(newDataKey())).open(id, payload)).rejects.toThrow();
  });

  it("codice di recupero: ritrova la chiave; un codice sbagliato no", async () => {
    const key = newDataKey();
    const code = newRecoveryCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    const wrapped = await wrapDataKey(parseRecoveryCode(code)!, key);

    const back = await unwrapDataKey(parseRecoveryCode(code)!, wrapped);
    expect(back && (await keyIdOf(back))).toBe(await keyIdOf(key));
    expect(await unwrapDataKey(parseRecoveryCode(newRecoveryCode())!, wrapped)).toBeNull();
  });

  it("il codice si può scrivere senza trattini, in minuscolo, con O al posto di 0", async () => {
    const code = newRecoveryCode();
    const typed = code.replace(/-/g, " ").toLowerCase().replace(/0/g, "o");
    expect(parseRecoveryCode(typed)).toEqual(parseRecoveryCode(code));
    expect(parseRecoveryCode("troppo corto")).toBeNull();
    expect(parseRecoveryCode(code + "X")).toBeNull();
  });
});
