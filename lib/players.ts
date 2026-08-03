import "server-only";

import { supabase } from "@/lib/supabase";

export type PlayerRow = Record<string, unknown>;

const PAGE_SIZE = 1000;
const EXCLUDED_COLUMNS = new Set(["strategieall"]);

function sanitizePlayerRow(row: PlayerRow): PlayerRow {
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
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .schema("public")
      .from("data_ready_for_app")
      .select("*")
      .order("nome", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(
        `Errore nel caricamento dei giocatori: ${error.message}`,
      );
    }

    const currentPage = (data ?? []) as PlayerRow[];
    players.push(...currentPage.map(sanitizePlayerRow));

    if (currentPage.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return players;
}

export async function loadLastUpdate(): Promise<string | null> {
  const { data, error } = await supabase
    .schema("public")
    .from("last_update")
    .select("last_update")
    .order("last_update", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Errore nel caricamento dell'ultimo aggiornamento: ${error.message}`,
    );
  }

  const value = data?.last_update;

  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

export function getStrategyColumns(
  players: PlayerRow[],
): string[] {
  const strategyColumns = new Set<string>();

  for (const player of players) {
    for (const columnName of Object.keys(player)) {
      if (columnName.startsWith("strategia_")) {
        strategyColumns.add(columnName);
      }
    }
  }

  return Array.from(strategyColumns).sort((first, second) =>
    first.localeCompare(second, "it", {
      sensitivity: "base",
    }),
  );
}
