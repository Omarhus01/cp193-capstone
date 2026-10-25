import type { Passage, SurahContent } from "@/lib/domain/content";
import { createClient } from "@/lib/supabase/server";
import { queryPassages, querySurahContent } from "./content-queries";

// The tester preview (ADR 0016): content in review, read with the user's own session so row level
// security decides what they may see. Never add "use cache" here. Drafts must not reach the
// shared cache in content.ts, which every reader gets; these functions read cookies, so each
// request renders on its own.

/** The surah as the logged-in user may read it: published content, and for testers, drafts. */
export async function getSurahContentPreview(surah: number): Promise<SurahContent | null> {
  return querySurahContent(await createClient(), surah, "preview");
}

/** The passages with these ids that the logged-in user may read, in the order asked for. */
export async function getPassagesPreview(ids: readonly string[]): Promise<Passage[]> {
  return queryPassages(await createClient(), ids);
}
