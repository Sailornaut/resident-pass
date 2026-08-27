import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npxCommand, ["supabase", "start"]);
run(npxCommand, ["supabase", "migration", "up", "--local"]);
run(npmCommand, ["run", "db:seed"]);
run(npxCommand, ["playwright", "test", ...process.argv.slice(2)]);
