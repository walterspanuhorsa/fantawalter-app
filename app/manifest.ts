import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FantaConsigliere – Assistente per l’asta",
    short_name: "FantaConsigliere",
    description:
      "Assistente strategico per l’asta del fantacalcio: confronta i giocatori, valuta i prezzi e costruisci una rosa più equilibrata.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f7f9",
    theme_color: "#243444",
    lang: "it",
    categories: ["sports", "utilities"],
    icons: [
      {
        src: "/icons/fantaconsigliere-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/fantaconsigliere-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/fantaconsigliere-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
