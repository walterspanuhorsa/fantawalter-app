import "server-only";

import { supabase } from "@/lib/supabase";
import {
  resolveDefenseModifier,
  resolveLeagueSize,
  resolvePlayerMode,
  type LeagueSize,
  type PlayerMode,
} from "@/lib/auction-settings";

export type PlayerRow = Record<string, unknown>;

export interface LeagueDataPreferences {
  playerMode: PlayerMode;
  leagueSize: LeagueSize;
  defenseModifier: boolean;
}

interface PmaRow extends Record<string, unknown> {
  Nome?: unknown;
  PMA?: unknown;
}

interface StrategyRow extends Record<string, unknown> {
  fascia?: unknown;
  nome?: unknown;
  prezzo?: unknown;
  budget?: unknown;
  esperto?: unknown;
}

const PAGE_SIZE = 1000;

const STAT_COLUMN_MAP: Record<string, string> = {
  Ruolo: "ruolo",
  Ruolo_mantra: "ruolo_mantra",
  Team: "team",
  Nome: "nome",
  Quo: "quo",
  Titolarita: "titolarita",
  Affidabilita: "affidabilita",
  Integrita: "integrita",
  Commento: "commento",
  Nota_1: "nota_1",
  Nota_2: "nota_2",
  Nota_3: "nota_3",
  Nota_4: "nota_4",
  Nota_5: "nota_5",
  MV: "mv",
  FMV: "fmv",
  Presenze: "presenze",
  FMV_Exp: "fmv_exp",
  Pt__Tit: "pt__tit",
  Minuti: "minuti",
  Pt__Inf: "pt__inf",
  Gol: "gol",
  Assist: "assist",
  Ammonizioni: "ammonizioni",
  Espulsioni: "espulsioni",
  Rig__Segnati: "rig__segnati",
  Rig__Sbagliati: "rig__sbagliati",
  Gol_Subiti: "gol_subiti",
  Rig__Parati: "rig__parati",
};

function normalizePlayerName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it");
}

function strategySlug(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(
    String(value).trim().replace(",", "."),
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatRow(
  source: Record<string, unknown>,
): PlayerRow {
  const target: PlayerRow = {};

  for (const [sourceColumn, targetColumn] of Object.entries(
    STAT_COLUMN_MAP,
  )) {
    target[targetColumn] = source[sourceColumn] ?? null;
  }

  /*
   * I componenti attuali leggono le note dai campi nota_1 ... nota_5.
   * Manteniamo inoltre "note" disponibile come campo sintetico.
   */
  target.note = [
    target.nota_1,
    target.nota_2,
    target.nota_3,
    target.nota_4,
    target.nota_5,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== "",
    )
    .map((value) => String(value).trim())
    .join(" · ");

  return target;
}

function robustAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort(
    (first, second) => first - second,
  );

  /*
   * Mantiene la logica robusta già usata nel progetto:
   * da 4 valori in su elimina progressivamente gli estremi.
   * k = floor(n / 4), quindi 4 -> 1 per lato, 8 -> 2, ecc.
   */
  const valuesToDiscardPerSide =
    Math.floor(sortedValues.length / 4);

  const usableValues =
    valuesToDiscardPerSide > 0
      ? sortedValues.slice(
          valuesToDiscardPerSide,
          sortedValues.length - valuesToDiscardPerSide,
        )
      : sortedValues;

  if (usableValues.length === 0) {
    return null;
  }

  const average =
    usableValues.reduce(
      (total, value) => total + value,
      0,
    ) / usableValues.length;

  return Math.max(1, Math.round(average));
}

async function loadTableRows<T extends Record<string, unknown>>(
  tableName: string,
  orderColumn?: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .schema("public")
      .from(tableName)
      .select("*");

    if (orderColumn) {
      query = query.order(orderColumn, {
        ascending: true,
      });
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      throw error;
    }

    const currentPage = (data ?? []) as T[];
    rows.push(...currentPage);

    if (currentPage.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = String(record.code ?? "");
  const message = String(record.message ?? "")
    .toLocaleLowerCase("it");

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

export function getPmaTableName(
  preferences: LeagueDataPreferences,
): string {
  const mode = resolvePlayerMode(
    preferences.playerMode,
  );
  const leagueSize = resolveLeagueSize(
    preferences.leagueSize,
  );
  if (mode === "mantra") {
    return `pma${leagueSize}_mantra`;
  }

  const modifier = resolveDefenseModifier(
    preferences.defenseModifier,
  )
    ? "mod"
    : "nomod";

  return `pma${leagueSize}_${modifier}_classic`;
}

export function getStrategiesTableName(
  requestedMode: PlayerMode | string,
): string {
  const mode = resolvePlayerMode(requestedMode);

  return `strategieall_${mode}`;
}

async function loadStats(): Promise<PlayerRow[]> {
  try {
    const rows = await loadTableRows<
      Record<string, unknown>
    >(
      "player_stats_table",
      "Nome",
    );

    return rows.map(normalizeStatRow);
  } catch (error) {
    const message =
      error && typeof error === "object"
        ? String(
            (error as Record<string, unknown>).message ??
              error,
          )
        : String(error);

    throw new Error(
      `Errore nel caricamento di player_stats_table: ${message}`,
    );
  }
}

async function loadPmaMap(
  preferences: LeagueDataPreferences,
): Promise<Map<string, unknown>> {
  const tableName = getPmaTableName(preferences);

  try {
    const rows = await loadTableRows<PmaRow>(
      tableName,
      "Nome",
    );

    const pmaByPlayer = new Map<string, unknown>();

    for (const row of rows) {
      const playerKey = normalizePlayerName(row.Nome);

      if (!playerKey) {
        continue;
      }

      pmaByPlayer.set(
        playerKey,
        row.PMA ?? null,
      );
    }

    return pmaByPlayer;
  } catch (error) {
    /*
     * Le PMA Mantra non erano ancora state definite quando è stata
     * introdotta questa modifica. Se una specifica tabella non esiste,
     * la pagina continua a funzionare mostrando PMA vuota.
     */
    if (isMissingRelationError(error)) {
      console.warn(
        `[FantaWalter] Tabella PMA non disponibile: ${tableName}.`,
      );
      return new Map();
    }

    const message =
      error && typeof error === "object"
        ? String(
            (error as Record<string, unknown>).message ??
              error,
          )
        : String(error);

    throw new Error(
      `Errore nel caricamento di ${tableName}: ${message}`,
    );
  }
}

async function loadStrategyRows(
  requestedMode: PlayerMode | string,
): Promise<StrategyRow[]> {
  const tableName =
    getStrategiesTableName(requestedMode);

  try {
    return await loadTableRows<StrategyRow>(
      tableName,
      "nome",
    );
  } catch (error) {
    const message =
      error && typeof error === "object"
        ? String(
            (error as Record<string, unknown>).message ??
              error,
          )
        : String(error);

    throw new Error(
      `Errore nel caricamento di ${tableName}: ${message}`,
    );
  }
}

function buildStrategyDataByPlayer(
  rows: StrategyRow[],
  mode: PlayerMode,
): Map<string, PlayerRow> {
  const dataByPlayer = new Map<
    string,
    PlayerRow
  >();
  const budgetsByPlayer = new Map<
    string,
    number[]
  >();

  for (const row of rows) {
    const playerKey = normalizePlayerName(row.nome);
    const expertSlug = strategySlug(row.esperto);

    if (!playerKey || !expertSlug) {
      continue;
    }

    const columnName =
      `strategia_${expertSlug}_${mode}`;
    const budget = parseNumber(row.budget);

    const playerData =
      dataByPlayer.get(playerKey) ?? {};

    /*
     * Le colonne strategia continuano a contenere la percentuale
     * di budget, così PlayerCell e PlayerTooltip possono convertire
     * il dato nei crediti del budget scelto dall'utente.
     */
    playerData[columnName] =
      budget ?? row.budget ?? null;

    dataByPlayer.set(playerKey, playerData);

    if (budget !== null) {
      const playerBudgets =
        budgetsByPlayer.get(playerKey) ?? [];

      playerBudgets.push(budget);
      budgetsByPlayer.set(
        playerKey,
        playerBudgets,
      );
    }
  }

  for (const [playerKey, playerData] of dataByPlayer) {
    playerData.media_strategie =
      robustAverage(
        budgetsByPlayer.get(playerKey) ?? [],
      );
  }

  return dataByPlayer;
}

export async function loadPlayers(
  requestedPreferences:
    | LeagueDataPreferences
    | PlayerMode
    | string = {
      playerMode: "classic",
      leagueSize: 8,
      defenseModifier: false,
    },
): Promise<PlayerRow[]> {
  /*
   * Compatibilità temporanea con vecchie chiamate loadPlayers("classic").
   */
  const preferences: LeagueDataPreferences =
    typeof requestedPreferences === "string"
      ? {
          playerMode: resolvePlayerMode(
            requestedPreferences,
          ),
          leagueSize: 8,
          defenseModifier: false,
        }
      : {
          playerMode: resolvePlayerMode(
            requestedPreferences.playerMode,
          ),
          leagueSize: resolveLeagueSize(
            requestedPreferences.leagueSize,
          ),
          defenseModifier:
            resolvePlayerMode(
              requestedPreferences.playerMode,
            ) === "mantra"
              ? false
              : resolveDefenseModifier(
                  requestedPreferences.defenseModifier,
                ),
        };

  const [
    stats,
    pmaByPlayer,
    strategyRows,
  ] = await Promise.all([
    loadStats(),
    loadPmaMap(preferences),
    loadStrategyRows(preferences.playerMode),
  ]);

  const strategyDataByPlayer =
    buildStrategyDataByPlayer(
      strategyRows,
      preferences.playerMode,
    );

  return stats.map((player) => {
    const playerKey = normalizePlayerName(
      player.nome,
    );
    const strategyData =
      strategyDataByPlayer.get(playerKey) ?? {};

    return {
      ...player,
      pma: pmaByPlayer.get(playerKey) ?? null,
      media_strategie: null,
      ...strategyData,
    };
  });
}

export async function loadStrategyColumns(
  requestedMode: PlayerMode | string = "classic",
): Promise<string[]> {
  const mode = resolvePlayerMode(requestedMode);
  const rows = await loadStrategyRows(mode);
  const columns = new Set<string>();

  for (const row of rows) {
    const expertSlug = strategySlug(row.esperto);

    if (expertSlug) {
      columns.add(
        `strategia_${expertSlug}_${mode}`,
      );
    }
  }

  return Array.from(columns).sort(
    (first, second) =>
      first.localeCompare(second, "it", {
        sensitivity: "base",
      }),
  );
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

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(value);
}

export function getStrategyColumns(
  players: PlayerRow[],
  requestedMode?: PlayerMode | string,
): string[] {
  const mode = requestedMode
    ? resolvePlayerMode(requestedMode)
    : null;

  const expectedSuffix = mode
    ? `_${mode}`
    : null;

  const strategyColumns = new Set<string>();

  for (const player of players) {
    for (const columnName of Object.keys(player)) {
      if (
        !columnName.startsWith("strategia_")
      ) {
        continue;
      }

      if (
        expectedSuffix &&
        !columnName
          .toLocaleLowerCase("it")
          .endsWith(expectedSuffix)
      ) {
        continue;
      }

      strategyColumns.add(columnName);
    }
  }

  return Array.from(strategyColumns).sort(
    (first, second) =>
      first.localeCompare(second, "it", {
        sensitivity: "base",
      }),
  );
}
