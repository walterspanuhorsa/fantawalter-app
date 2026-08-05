import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./theme.css";

const SITE_URL = "https://fantawalter-app.vercel.app";

const THEME_INITIALIZER = `
  (() => {
    try {
      const savedTheme = window.localStorage.getItem(
        "fantawalter-theme-v1",
      );
      const theme = savedTheme === "dark" ? "dark" : "light";

      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
    }
  })();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "FantaConsigliere – Assistente per l’asta",
    template: "%s | FantaConsigliere",
  },

  description:
    "Assistente strategico per l’asta del fantacalcio: confronta i giocatori, valuta i prezzi e costruisci una rosa più equilibrata.",

  applicationName: "FantaConsigliere",
  category: "sports",
  creator: "FantaConsigliere",
  publisher: "FantaConsigliere",

  keywords: [
    "fantacalcio",
    "asta fantacalcio",
    "consigli fantacalcio",
    "prezzi giocatori",
    "strategie asta",
    "assistente asta",
    "composizione rosa",
  ],

  alternates: {
    canonical: "/",
  },

  manifest: "/manifest.webmanifest",

  openGraph: {
    type: "website",
    locale: "it_IT",
    url: "/",
    siteName: "FantaConsigliere",
    title: "FantaConsigliere – Assistente per l’asta",
    description:
      "Assistente strategico per l’asta del fantacalcio: confronta i giocatori, valuta i prezzi e costruisci una rosa più equilibrata.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "FantaConsigliere – Assistente strategico per l’asta",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "FantaConsigliere – Assistente per l’asta",
    description:
      "Assistente strategico per l’asta del fantacalcio: confronta i giocatori, valuta i prezzi e costruisci una rosa più equilibrata.",
    images: ["/twitter-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  appleWebApp: {
    capable: true,
    title: "FantaConsigliere",
    statusBarStyle: "default",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#f4f7f9",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#182532",
    },
  ],
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INITIALIZER,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
