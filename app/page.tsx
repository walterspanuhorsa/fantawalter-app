import AuctionAssistant from "@/components/auction-assistant";
import {
  getStrategyColumns,
  loadLastUpdate,
  loadPlayers,
} from "@/lib/players";

export const revalidate = 60;

export default async function Home() {
  const [players, lastUpdate] = await Promise.all([
    loadPlayers(),
    loadLastUpdate(),
  ]);

  const strategyColumns = getStrategyColumns(players);

  return (
    <AuctionAssistant
      initialPlayers={players}
      strategyColumns={strategyColumns}
      lastUpdate={lastUpdate}
    />
  );
}
