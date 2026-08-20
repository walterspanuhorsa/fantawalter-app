import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"

import ThemeInitializer from "@/components/theme-initializer";

import "./globals.css";
import "./theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FantaConsigliere",
    template: "%s | FantaConsigliere",
  },
  description:
    "FantaConsigliere è uno strumento di supporto all'asta del Fantacalcio, con listone, PMA, strategie, configurazione Classic e Mantra e gestione della rosa.",
  applicationName: "FantaConsigliere",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeInitializer />
        {children}
		<Analytics />
      </body>
    </html>
  );
}
