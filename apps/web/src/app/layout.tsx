import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran Explained",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-900">{children}</body>
    </html>
  );
}
