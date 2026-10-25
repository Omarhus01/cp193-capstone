import * as authData from "@/lib/data/auth";

/**
 * Whether the logged-in user is on the tester list, so the surah page reads content in review
 * through the uncached preview path (ADR 0016). False for everyone else, and on any error.
 */
export const isCurrentUserTester = authData.isTester;
