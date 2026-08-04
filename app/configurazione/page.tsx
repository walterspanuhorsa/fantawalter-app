import type { Metadata } from "next";

import AuctionSettingsPanel from "@/components/auction-settings";
import {
  getStrategyColumns,
  loadPlayers,
} from "@/lib/players";

export const metadata: Metadata = {
  title: "Configurazione | FantaWalter",
  description:
    "Configura budget, composizione della rosa e tabella giocatori di FantaWalter.",
};

export default async function ConfigurationPage() {
  const players = await loadPlayers();
  const strategyColumns = getStrategyColumns(players);

  return (
    <AuctionSettingsPanel
      strategyColumns={strategyColumns}
    />
  );
}
