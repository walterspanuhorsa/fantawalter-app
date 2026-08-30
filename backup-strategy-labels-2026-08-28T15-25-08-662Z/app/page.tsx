
import { cookies } from "next/headers";

import AuctionAssistant from "@/components/auction-assistant";
import {
  DEFENSE_MODIFIER_COOKIE,
  LEAGUE_SIZE_COOKIE,
  PLAYER_MODE_COOKIE,
  resolveDefenseModifier,
  resolveLeagueSize,
  resolvePlayerMode,
} from "@/lib/auction-settings";
import {
  getStrategyColumns,
  loadLastUpdate,
  loadPlayers,
} from "@/lib/players";

export default async function Home() {
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

  const [players, lastUpdate] = await Promise.all([
    loadPlayers({
      playerMode,
      leagueSize,
      defenseModifier,
    }),
    loadLastUpdate(),
  ]);

  const strategyColumns = getStrategyColumns(
    players,
    playerMode,
  );

return (
  <AuctionAssistant
    initialPlayers={players}
    strategyColumns={strategyColumns}
    lastUpdate={lastUpdate}
    playerMode={playerMode}
    leagueSize={leagueSize}
    defenseModifier={defenseModifier}
  />
);
}
