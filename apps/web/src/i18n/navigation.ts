import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware versions of Next's navigation APIs. Use these instead of next/link and next/navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
