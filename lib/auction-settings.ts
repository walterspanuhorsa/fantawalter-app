import {
  DEFAULT_ROLE_BUDGETS,
  DEFAULT_ROLE_LIMITS,
  ROLE_ORDER,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

export interface ColumnDefinition {
  key: string;
  label: string;
}

export interface PersistedAuctionState {
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
  initialBudget: number;
  recordPurchasePrice: boolean;
  roleLimits: RoleLimits;
  roleBudgets: RoleBudgets;
  visibleColumnKeys: string[];
  columnOrderKeys: string[];
}

export const AUCTION_STORAGE_KEY =
  "fantawalter-auction-state-v1";

export const BASE_COLUMNS: ColumnDefinition[] = [
  { key: "ruolo", label: "R" },
  { key: "giocatore", label: "Giocatore" },
  { key: "titolarita", label: "TIT" },
  { key: "affidabilita", label: "AFF" },
  { key: "integrita", label: "INT" },
  { key: "media_strategie", label: "Media" },
  { key: "pma", label: "PMA" },
  { key: "note", label: "NOTE" },
  { key: "percezione", label: "Percezione" },
];

export const DEFAULT_VISIBLE_COLUMNS = BASE_COLUMNS.map(
  (column) => column.key,
);

export function formatStrategyLabel(
  columnName: string,
): string {
  return columnName
    .replace(/^strategia_/, "")
    .split("_")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function getAllColumns(
  strategyColumns: string[],
): ColumnDefinition[] {
  return [
    ...BASE_COLUMNS,
    ...strategyColumns.map((columnName) => ({
      key: columnName,
      label: formatStrategyLabel(columnName),
    })),
  ];
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

function readColumnKeys(
  value: unknown,
  allowedColumnKeySet: Set<string>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  /*
   * Migrazione dalla precedente configurazione, nella quale
   * Nome e Squadra erano due colonne separate.
   */
  const migratedKeys = value
    .filter((item): item is string => typeof item === "string")
    .map((item) =>
      item === "nome" || item === "team"
        ? "giocatore"
        : item,
    );

  return Array.from(
    new Set(
      migratedKeys.filter((item) =>
        allowedColumnKeySet.has(item),
      ),
    ),
  );
}

export function createDefaultAuctionSettings(): AuctionSettings {
  return {
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

  return {
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
      visibleColumnKeys.length > 0
        ? visibleColumnKeys
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
