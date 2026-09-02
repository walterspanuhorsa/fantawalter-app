"use client";

import type { ComponentProps } from "react";

import AuctionAssistantBase from "./auction-assistant-base";

type AuctionAssistantProps = ComponentProps<
  typeof AuctionAssistantBase
>;

export default function AuctionAssistant(
  props: AuctionAssistantProps,
) {
  return (
    <>
      <style jsx global>{`
        /*
         * LISTONE: prime due colonne sempre visibili.
         *
         * 1ª colonna: Az. (già sticky nel componente originale)
         * 2ª colonna: prima colonna configurabile visibile
         *
         * La seconda colonna viene individuata tramite nth-child(2),
         * quindi continua a funzionare anche se l'utente cambia
         * l'ordine delle colonne dalla configurazione.
         */

        .fantawalter-table thead th:first-child {
          z-index: 6 !important;
        }

        .fantawalter-table thead th:nth-child(2) {
          left: 60px !important;
          z-index: 5 !important;
          box-shadow: 3px 0 5px -3px rgba(15, 23, 42, 0.35);
          background-clip: padding-box;
        }

        .fantawalter-table tbody td:first-child {
          z-index: 4 !important;
        }

        .fantawalter-table tbody td:nth-child(2) {
          position: sticky !important;
          left: 60px !important;
          z-index: 3 !important;
          box-shadow: 3px 0 5px -3px rgba(15, 23, 42, 0.22);
          background-clip: padding-box;
        }
      `}</style>

      <AuctionAssistantBase {...props} />
    </>
  );
}
