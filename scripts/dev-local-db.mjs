// Avvia l'app (next dev) collegata al Supabase SUL PC invece che a quello online.
// Indirizzo e chiave pubblica locali si leggono al volo da `supabase status`:
// nessuna chiave finisce nei file. Prima serve: npm run db:local (con Docker acceso).
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Docker Desktop installato per l'utente non sempre è già nel PATH della shell.
const dockerBin = join(process.env.LOCALAPPDATA ?? "", "Programs", "DockerDesktop", "resources", "bin");
const env = { ...process.env };
if (existsSync(dockerBin)) env.PATH = `${dockerBin}${process.platform === "win32" ? ";" : ":"}${env.PATH ?? env.Path ?? ""}`;

let status;
try {
  status = JSON.parse(execSync("npx supabase status -o json", { env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  console.error("Supabase sul PC non risponde: accendi Docker Desktop e lancia npm run db:local.");
  process.exit(1);
}

console.log(`App collegata al Supabase locale (${status.API_URL}). Email di prova: ${status.MAILPIT_URL}`);
const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY,
    // La chiave segreta locale non serve all'app: si toglie quella online per sicurezza.
    SUPABASE_SERVICE_ROLE_KEY: "",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
