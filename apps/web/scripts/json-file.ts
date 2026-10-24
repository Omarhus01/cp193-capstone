import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";

/** Writes JSON formatted the way `npm run format` would, so format:check passes on it. */
export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  const options = await resolveConfig(file);
  const json = await format(JSON.stringify(data), { ...options, parser: "json" });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, json);
}
