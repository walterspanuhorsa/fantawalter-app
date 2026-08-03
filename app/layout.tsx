import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fantawalter-app.vercel.app"),

  title: "FantaWalter – Assistente per l'asta",

  description:
    "Consulta prezzi consigliati, confronta le strategie e costruisci la tua rosa durante l'asta del fantacalcio.",

  applicationName: "FantaWalter",

  openGraph: {
    title: "FantaWalter – Assistente per l'asta",
    description:
      "Prezzi consigliati, strategie e supporto alla costruzione della rosa durante l'asta.",
    url: "/",
    siteName: "FantaWalter",
    locale: "it_IT",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "FantaWalter – Assistente per l'asta",
    description:
      "Prezzi consigliati, strategie e supporto alla costruzione della rosa durante l'asta.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
