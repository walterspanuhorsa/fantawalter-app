import AuctionAssistant from "@/components/auction-assistant";
import {
  getStrategyColumns,
  loadPlayers,
} from "@/lib/players";

export const dynamic = "force-dynamic";

export default async function Home() {
  const players = await loadPlayers();
  const strategyColumns =
    getStrategyColumns(players);

  return (
    <AuctionAssistant
      initialPlayers={players}
      strategyColumns={strategyColumns}
    />
  );
}