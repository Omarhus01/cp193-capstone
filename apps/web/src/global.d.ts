import type { routing } from "@/i18n/routing";
import type messages from "../messages/en.json";

// Types every next-intl call: unknown locales and missing message keys become type errors.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
