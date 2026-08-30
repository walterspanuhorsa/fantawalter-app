import type { Metadata } from "next";
import { cookies } from "next/headers";

import AuctionSettingsPanel from "@/components/auction-settings";
import {
  DEFENSE_MODIFIER_COOKIE,
  LEAGUE_SIZE_COOKIE,
  PLAYER_MODE_COOKIE,
  resolveDefenseModifier,
  resolveLeagueSize,
  resolvePlayerMode,
} from "@/lib/auction-settings";
import { loadStrategyColumns } from "@/lib/players";

export const metadata: Metadata = {
  title: "Configurazione | FantaConsigliere",
  description:
    "Configura preferenze della lega, composizione della rosa e tabella giocatori di FantaConsigliere.",
};

export default async function ConfigurationPage() {
  const cookieStore = await cookies();

  const playerMode = resolvePlayerMode(
    cookieStore.get(PLAYER_MODE_COOKIE)?.value,
  );

  const leagueSize = resolveLeagueSize(
    cookieStore.get(LEAGUE_SIZE_COOKIE)?.value,
  );

  const defenseModifier =
    resolveDefenseModifier(
      cookieStore.get(
        DEFENSE_MODIFIER_COOKIE,
      )?.value,
    );

  const strategyColumns =
    await loadStrategyColumns(playerMode);

  return (
    <AuctionSettingsPanel
      strategyColumns={strategyColumns}
      playerMode={playerMode}
      leagueSize={leagueSize}
      defenseModifier={defenseModifier}
    />
  );
}
