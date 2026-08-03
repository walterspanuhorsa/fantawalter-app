import "server-only";

import { supabase } from "@/lib/supabase";

export type PlayerRow = Record<string, unknown>;

const PAGE_SIZE = 1000;

const EXCLUDED_COLUMNS = new Set([
  "strategieall",
]);

function sanitizePlayer(row: PlayerRow): PlayerRow {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([columnName]) => !EXCLUDED_COLUMNS.has(columnName),
    ),
  );
}

export async function loadPlayers(): Promise<PlayerRow[]> {
  const players: PlayerRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .schema("public")
      .from("data_ready_for_app")
      .select("*")
      .order("nome", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Errore nel caricamento dei giocatori: ${error.message}`,
      );
    }

    const currentPage = (data ?? []) as PlayerRow[];

    players.push(
      ...currentPage.map(sanitizePlayer),
    );

    if (currentPage.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return players;
}

export function getStrategyColumns(
  players: PlayerRow[],
): string[] {
  const columns = new Set<string>();

  for (const player of players) {
    for (const columnName of Object.keys(player)) {
      if (columnName.startsWith("strategia_")) {
        columns.add(columnName);
      }
    }
  }

  return Array.from(columns).sort();
}