// Versione 1.8
import {
  DEFAULT_ROLE_BUDGETS,
  DEFAULT_ROLE_LIMITS,
  ROLE_ORDER,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

// STRATEGY_LABELS_V1
export interface StrategyColumnMeta {
  key: string;
  fullLabel: string;
  shortLabel: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  fullLabel?: string;
  shortLabel?: string;
}

export type PlayerMode = "classic" | "mantra";
export type LeagueSize = 8 | 10 | 12;

export interface PersistedAuctionState {
  playerMode?: unknown;
  leagueSize?: unknown;
  defenseModifier?: unknown;
  initialBudget?: unknown;
  purchasedPlayerKeys?: unknown;
  deletedPlayerKeys?: unknown;
  roleLimits?: unknown;
  visibleColumnKeys?: unknown;
  columnOrderKeys?: unknown;
  recordPurchasePrice?: unknown;
  purchasePrices?: unknown;
  roleBudgets?: unknown;
  configurationOpen?: unknown;
  columnsVisibilityOpen?: unknown;
}

export interface AuctionSettings {
  playerMode: PlayerMode;
  leagueSize: LeagueSize;

  /*
   * Predisposto per la selezione mod / nomod.
   * Per ora non viene mostrato nella pagina Configurazione.
   */
  defenseModifier: boolean;

  initialBudget: number;
  recordPurchasePrice: boolean;
  roleLimits: RoleLimits;
  roleBudgets: RoleBudgets;
  visibleColumnKeys: string[];
  columnOrderKeys: string[];
}

export const AUCTION_STORAGE_KEY =
  "fantawalter-auction-state-v1";

export const PLAYER_MODE_COOKIE =
  "fantawalter-player-mode";

export const LEAGUE_SIZE_COOKIE =
  "fantawalter-league-size";

export const DEFENSE_MODIFIER_COOKIE =
  "fantawalter-defense-modifier";

/*
 * Scelta di migrazione: chi non ha ancora impostato la dimensione
 * della lega viene inizializzato a 10 partecipanti.
 */
export const DEFAULT_LEAGUE_SIZE: LeagueSize = 8;

export function resolvePlayerMode(
  value: unknown,
): PlayerMode {
  return value === "mantra" ? "mantra" : "classic";
}

export function resolveLeagueSize(
  value: unknown,
): LeagueSize {
  const parsedValue =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").trim());

  return parsedValue === 8 ||
    parsedValue === 10 ||
    parsedValue === 12
    ? parsedValue
    : DEFAULT_LEAGUE_SIZE;
}

export function resolveDefenseModifier(
  value: unknown,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value ?? "")
    .trim()
    .toLocaleLowerCase("it");

  return (
    normalizedValue === "true" ||
    normalizedValue === "1" ||
    normalizedValue === "y" ||
    normalizedValue === "yes" ||
    normalizedValue === "mod"
  );
}

export const SELECTED_AVERAGE_COLUMN_KEY =
  "media_selezionati";

export const BASE_COLUMNS: ColumnDefinition[] = [
  { key: "giocatore", label: "Giocatore" },
  { key: "media_strategie", label: "Media" },
  {
    key: SELECTED_AVERAGE_COLUMN_KEY,
    label: "Media Selezionati",
  },
  { key: "pma", label: "PMA" },
  { key: "titolarita", label: "TIT" },
  { key: "affidabilita", label: "AFF" },
  { key: "integrita", label: "INT" },
  { key: "note", label: "NOTE" },
  { key: "percezione", label: "Percezione" },
];

export const FANTACALCIO_COLUMNS: ColumnDefinition[] = [
  { key: "fc_qi", label: "FC QI" },
  { key: "fc_qa", label: "FC QA" },
  { key: "fc_qi_m", label: "FC QI_M" },
  { key: "fc_qa_m", label: "FC QA_M" },
  { key: "fc_fvm1000", label: "FC FVM1000" },
  { key: "fc_fvm1000_m", label: "FC FVM1000_M" },
];

export const DEFAULT_VISIBLE_COLUMNS = BASE_COLUMNS
  .filter(
    (column) =>
      column.key !== SELECTED_AVERAGE_COLUMN_KEY,
  )
  .map((column) => column.key);

export function formatStrategyLabel(
  columnName: string,
): string {
  return columnName
    .replace(/^strategia_/, "")
    .replace(/_(classic|mantra)$/i, "")
    .split("_")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function getStrategyMetaMap(
  strategyColumnMeta: StrategyColumnMeta[],
): Map<string, StrategyColumnMeta> {
  return new Map(
    strategyColumnMeta.map((item) => [item.key, item]),
  );
}

export function getStrategyFullLabel(
  columnName: string,
  strategyColumnMeta: StrategyColumnMeta[] = [],
): string {
  const meta = getStrategyMetaMap(strategyColumnMeta).get(
    columnName,
  );

  return meta?.fullLabel?.trim() || formatStrategyLabel(columnName);
}

export function getStrategyShortLabel(
  columnName: string,
  strategyColumnMeta: StrategyColumnMeta[] = [],
): string {
  const meta = getStrategyMetaMap(strategyColumnMeta).get(
    columnName,
  );

  return (
    meta?.shortLabel?.trim() ||
    meta?.fullLabel?.trim() ||
    formatStrategyLabel(columnName)
  );
}

export function getAllColumns(
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[] = [],
): ColumnDefinition[] {
  const metaByKey = getStrategyMetaMap(strategyColumnMeta);

  return [
    ...BASE_COLUMNS,
    ...FANTACALCIO_COLUMNS,
    ...strategyColumns.map((columnName) => {
      const meta = metaByKey.get(columnName);
      const fullLabel =
        meta?.fullLabel?.trim() ||
        formatStrategyLabel(columnName);
      const shortLabel =
        meta?.shortLabel?.trim() || fullLabel;

      return {
        key: columnName,
        label: fullLabel,
        fullLabel,
        shortLabel,
      };
    }),
  ];
}

export function getListColumns(
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[] = [],
): ColumnDefinition[] {
  return getAllColumns(
    strategyColumns,
    strategyColumnMeta,
  ).map((column) =>
    column.key.startsWith("strategia_")
      ? {
          ...column,
          label:
            column.shortLabel ||
            column.fullLabel ||
            column.label,
        }
      : column,
  );
}

function readPositiveNumber(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : fallback;
}

function readNonNegativeInteger(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? Math.trunc(value)
    : fallback;
}

function resolveRoleLimits(value: unknown): RoleLimits {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return ROLE_ORDER.reduce<RoleLimits>(
    (limits, role) => {
      limits[role] = readNonNegativeInteger(
        record[role],
        DEFAULT_ROLE_LIMITS[role],
      );
      return limits;
    },
    { ...DEFAULT_ROLE_LIMITS },
  );
}

function resolveRoleBudgets(value: unknown): RoleBudgets {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return ROLE_ORDER.reduce<RoleBudgets>(
    (budgets, role) => {
      budgets[role] = readNonNegativeInteger(
        record[role],
        DEFAULT_ROLE_BUDGETS[role],
      );
      return budgets;
    },
    { ...DEFAULT_ROLE_BUDGETS },
  );
}

function normalizeReferenceColumnOrder(
  columnKeys: string[],
): string[] {
  const playerIndex = columnKeys.indexOf("giocatore");
  const mediaIndex = columnKeys.indexOf("media_strategie");
  const pmaIndex = columnKeys.indexOf("pma");

  const legacyIndicators = new Set([
    "titolarita",
    "affidabilita",
    "integrita",
  ]);

  const hasLegacyOrder =
    playerIndex >= 0 &&
    mediaIndex > playerIndex &&
    pmaIndex > mediaIndex &&
    columnKeys
      .slice(playerIndex + 1, mediaIndex)
      .some((key) => legacyIndicators.has(key));

  if (!hasLegacyOrder) {
    return columnKeys;
  }

  const withoutReferenceColumns = columnKeys.filter(
    (key) =>
      key !== "media_strategie" &&
      key !== SELECTED_AVERAGE_COLUMN_KEY &&
      key !== "pma",
  );

  const nextPlayerIndex =
    withoutReferenceColumns.indexOf("giocatore");

  withoutReferenceColumns.splice(
    nextPlayerIndex + 1,
    0,
    "media_strategie",
    SELECTED_AVERAGE_COLUMN_KEY,
    "pma",
  );

  return withoutReferenceColumns;
}

function readColumnKeys(
  value: unknown,
  allowedColumnKeySet: Set<string>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const migratedKeys = value
    .filter((item): item is string => typeof item === "string")
    .map((item) =>
      item === "nome" || item === "team"
        ? "giocatore"
        : item,
    );

  const validColumnKeys = Array.from(
    new Set(
      migratedKeys.filter((item) =>
        allowedColumnKeySet.has(item),
      ),
    ),
  );

  return normalizeReferenceColumnOrder(validColumnKeys);
}

export function createDefaultAuctionSettings(): AuctionSettings {
  return {
    playerMode: "classic",
    leagueSize: DEFAULT_LEAGUE_SIZE,
    defenseModifier: false,
    initialBudget: 500,
    recordPurchasePrice: false,
    roleLimits: { ...DEFAULT_ROLE_LIMITS },
    roleBudgets: { ...DEFAULT_ROLE_BUDGETS },
    visibleColumnKeys: [...DEFAULT_VISIBLE_COLUMNS],
    columnOrderKeys: [],
  };
}

export function resolveAuctionSettings(
  state: PersistedAuctionState,
  strategyColumns: string[],
): AuctionSettings {
  const allColumns = getAllColumns(strategyColumns);
  const allowedColumnKeySet = new Set(
    allColumns.map((column) => column.key),
  );
  const visibleColumnKeys = readColumnKeys(
    state.visibleColumnKeys,
    allowedColumnKeySet,
  );
  const strategyColumnKeySet = new Set(strategyColumns);
  const selectedStrategyCount =
    visibleColumnKeys.filter((columnKey) =>
      strategyColumnKeySet.has(columnKey),
    ).length;
  const normalizedVisibleColumnKeys =
    selectedStrategyCount >= 2
      ? visibleColumnKeys
      : visibleColumnKeys.filter(
          (columnKey) =>
            columnKey !== SELECTED_AVERAGE_COLUMN_KEY,
        );

  return {
    playerMode: resolvePlayerMode(state.playerMode),
    leagueSize: resolveLeagueSize(state.leagueSize),
    defenseModifier: resolveDefenseModifier(
      state.defenseModifier,
    ),
    initialBudget: readPositiveNumber(
      state.initialBudget,
      500,
    ),
    recordPurchasePrice:
      typeof state.recordPurchasePrice === "boolean"
        ? state.recordPurchasePrice
        : false,
    roleLimits: resolveRoleLimits(state.roleLimits),
    roleBudgets: resolveRoleBudgets(state.roleBudgets),
    visibleColumnKeys:
      normalizedVisibleColumnKeys.length > 0
        ? normalizedVisibleColumnKeys
        : [...DEFAULT_VISIBLE_COLUMNS],
    columnOrderKeys: readColumnKeys(
      state.columnOrderKeys,
      allowedColumnKeySet,
    ),
  };
}

export function loadPersistedAuctionState(): PersistedAuctionState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const savedState = window.localStorage.getItem(
      AUCTION_STORAGE_KEY,
    );

    if (!savedState) {
      return {};
    }

    const parsedState = JSON.parse(savedState);

    return parsedState && typeof parsedState === "object"
      ? (parsedState as PersistedAuctionState)
      : {};
  } catch (error) {
    console.error(
      "Impossibile leggere le impostazioni di FantaWalter.",
      error,
    );
    return {};
  }
}

export function savePersistedAuctionState(
  state: PersistedAuctionState,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      AUCTION_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.error(
      "Impossibile salvare le impostazioni di FantaWalter.",
      error,
    );
  }
}

export function updatePersistedAuctionState(
  patch: Partial<PersistedAuctionState>,
): void {
  const currentState = loadPersistedAuctionState();

  savePersistedAuctionState({
    ...currentState,
    ...patch,
  });
}

export function saveAuctionSettings(
  settings: AuctionSettings,
): void {
  updatePersistedAuctionState({
    playerMode: settings.playerMode,
    leagueSize: settings.leagueSize,
    defenseModifier: settings.defenseModifier,
    initialBudget: settings.initialBudget,
    recordPurchasePrice: settings.recordPurchasePrice,
    roleLimits: settings.roleLimits,
    roleBudgets: settings.roleBudgets,
    visibleColumnKeys: settings.visibleColumnKeys,
    columnOrderKeys: settings.columnOrderKeys,
  });
}

export function clearAuctionData(): void {
  updatePersistedAuctionState({
    purchasedPlayerKeys: [],
    deletedPlayerKeys: [],
    purchasePrices: {},
  });
}

export function roleLabel(role: PlayerRole): string {
  switch (role) {
    case "P":
      return "Portieri";
    case "D":
      return "Difensori";
    case "C":
      return "Centrocampisti";
    case "A":
      return "Attaccanti";
  }
}
