import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran Explained",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900">{children}</body>
    </html>
  );
}
