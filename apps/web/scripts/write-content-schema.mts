// Writes the JSON Schema of each content file to content/schema/, from the Zod schemas in
// src/lib/services/content/schema.ts. Run it after changing those: npm run content:schema
import path from "node:path";
import { CONTENT_DIR } from "@/lib/services/content/load";
import { CONTENT_SCHEMAS, toJsonSchema } from "@/lib/services/content/schema";
import { writeJsonFile } from "./json-file";

for (const [name, schema] of Object.entries(CONTENT_SCHEMAS)) {
  await writeJsonFile(path.join(CONTENT_DIR, "schema", name), toJsonSchema(schema));
  console.log(`content/schema/${name}`);
}
