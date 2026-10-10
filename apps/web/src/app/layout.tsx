import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran Explained",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
