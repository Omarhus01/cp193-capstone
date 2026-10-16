export function getSupabaseEnv(): { url: string; anonKey: string } {
  // Read each variable by its full name so Next.js can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy apps/web/.env.example to apps/web/.env.local and fill in both values.",
    );
  }
  return { url, anonKey };
}
