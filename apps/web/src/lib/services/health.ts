import { getHealth } from "@/lib/data/health";

/** For the /health route: the server is up, and whether its Supabase is local or hosted. */
export const healthReport = getHealth;
