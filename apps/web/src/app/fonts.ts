import { Amiri, Inter, Noto_Sans_KR } from "next/font/google";

/** Latin UI text. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** Korean UI text and explanations. Korean glyphs load on demand, so nothing is preloaded. */
const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-kr",
  display: "swap",
  preload: false,
});

/** Quran text. Use it through the ArabicText component. */
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
  preload: false,
});

export const fontVariables = [inter.variable, notoSansKr.variable, amiri.variable].join(" ");
