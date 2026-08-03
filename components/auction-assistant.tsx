"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";

import PayPalSupportButton from "@/components/paypal-support-button";
import PlayerCell from "@/components/player-cell";
import PlayerTooltip from "@/components/player-tooltip";
import SquadPanel from "@/components/squad-panel";

import {
  calculateCredits,
  parseNumericValue,
} from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";

import {
  DEFAULT_ROLE_BUDGETS,
  DEFAULT_ROLE_LIMITS,
  ROLE_ORDER,
  ROLE_PLURAL_LABELS,
  getPlayerKey,
  getPlayerRole,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

interface AuctionAssistantProps {
  initialPlayers: PlayerRow[];
  strategyColumns: string[];
  lastUpdate: string | null;
}

interface ColumnDefinition {
  key: string;
  label: string;
}

type SortDirection = "asc" | "desc";

type HelpTopic = "resetAuction" | "purchasePrice";

const HELP_MESSAGES: Record<
  HelpTopic,
  { title: string; description: string }
> = {
  resetAuction: {
    title: "Azzera asta",
    description:
      "Riporta tutta l’app allo stato iniziale: svuota la rosa e il cestino e ripristina budget, filtri, limiti, colonne e configurazioni.",
  },
  purchasePrice: {
    title: "Registra prezzi di acquisto",
    description:
      "Quando è attivo, verrà richiesto il prezzo di acquisto di ogni giocatore inserito nella tua rosa.",
  },
};

interface PersistedAuctionState {
  initialBudget?: unknown;
  purchasedPlayerKeys?: unknown;
  deletedPlayerKeys?: unknown;
  roleLimits?: unknown;
  visibleColumnKeys?: unknown;
  columnOrderKeys?: unknown;
  recordPurchasePrice?: unknown;
  purchasePrices?: unknown;
  configurationOpen?: unknown;
  columnsVisibilityOpen?: unknown;
  roleBudgets?: unknown;
}

interface TooltipPointer {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

const STORAGE_KEY = "fantawalter-auction-state-v1";

const BASE_COLUMNS: ColumnDefinition[] = [
  { key: "ruolo", label: "Ruolo" },
  { key: "team", label: "Squadra" },
  { key: "nome", label: "Nome" },
  { key: "titolarita", label: "TIT" },
  { key: "affidabilita", label: "AFF" },
  { key: "integrita", label: "INT" },
  { key: "media_strategie", label: "Media" },
  { key: "pma", label: "PMA" },
  { key: "note", label: "NOTE" },
  { key: "percezione", label: "Percezione" },
];

const DEFAULT_VISIBLE_COLUMNS = BASE_COLUMNS.map(
  (column) => column.key,
);

const NON_SORTABLE_COLUMNS = new Set([
  "note",
  "percezione",
]);

function getTextValue(
  player: PlayerRow,
  columnName: string,
): string {
  const value = player[columnName];

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

function formatStrategyLabel(columnName: string): string {
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

function getRoleCellStyle(role: string): CSSProperties {
  switch (role) {
    case "P":
      return {
        background: "#fff3e0",
        fontWeight: 700,
      };

    case "D":
      return {
        background: "#e8f5e9",
        fontWeight: 700,
      };

    case "C":
      return {
        background: "#e1f5fe",
        fontWeight: 700,
      };

    case "A":
      return {
        background: "#ffebee",
        fontWeight: 700,
      };

    default:
      return {};
  }
}

function readPositiveNumber(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

function readNonNegativeInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.trunc(value);
}

function readRoleLimits(value: unknown): RoleLimits | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nextLimits: RoleLimits = {
    ...DEFAULT_ROLE_LIMITS,
  };

  for (const role of ["P", "D", "C", "A"] as PlayerRole[]) {
    const parsedValue = readNonNegativeInteger(record[role]);

    if (parsedValue !== null) {
      nextLimits[role] = parsedValue;
    }
  }

  return nextLimits;
}

function readRoleBudgets(value: unknown): RoleBudgets | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nextBudgets: RoleBudgets = {
    ...DEFAULT_ROLE_BUDGETS,
  };

  for (const role of ROLE_ORDER) {
    const parsedValue = readNonNegativeInteger(record[role]);

    if (parsedValue !== null) {
      nextBudgets[role] = parsedValue;
    }
  }

  return nextBudgets;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readPurchasePrices(
  value: unknown,
  existingPlayerKeySet: Set<string>,
): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const nextPrices: Record<string, number> = {};

  for (const [playerKey, rawPrice] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const parsedPrice = readNonNegativeInteger(rawPrice);

    if (
      existingPlayerKeySet.has(playerKey) &&
      parsedPrice !== null
    ) {
      nextPrices[playerKey] = parsedPrice;
    }
  }

  return nextPrices;
}

function formatLastUpdate(value: string | null): string {
  if (!value) {
    return "Non disponibile";
  }

  const normalizedValue =
    value.includes(" ") && !value.includes("T")
      ? value.replace(" ", "T")
      : value;
  const parsedDate = new Date(normalizedValue);

  if (!Number.isFinite(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(parsedDate);
}

export default function AuctionAssistant({
  initialPlayers,
  strategyColumns,
  lastUpdate,
}: AuctionAssistantProps) {
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [initialBudget, setInitialBudget] = useState(500);
  const [recordPurchasePrice, setRecordPurchasePrice] =
    useState(false);
  const [purchasePrices, setPurchasePrices] = useState<
    Record<string, number>
  >({});
  const [configurationOpen, setConfigurationOpen] =
    useState(true);
  const [columnsVisibilityOpen, setColumnsVisibilityOpen] =
    useState(true);
  const [roleBudgets, setRoleBudgets] =
    useState<RoleBudgets>(() => ({
      ...DEFAULT_ROLE_BUDGETS,
    }));

  const [purchasedPlayerKeys, setPurchasedPlayerKeys] =
    useState<string[]>([]);

  const [deletedPlayerKeys, setDeletedPlayerKeys] =
    useState<string[]>([]);

  const [isBinOpen, setIsBinOpen] = useState(false);
  const [hoveredHelpTopic, setHoveredHelpTopic] =
    useState<HelpTopic | null>(null);

  const [roleLimits, setRoleLimits] = useState<RoleLimits>(
    () => ({ ...DEFAULT_ROLE_LIMITS }),
  );

  const [sortColumn, setSortColumn] =
    useState<string>("nome");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const [visibleColumnKeys, setVisibleColumnKeys] =
    useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  const [columnOrderKeys, setColumnOrderKeys] =
    useState<string[]>([]);

  const [draggedColumnKey, setDraggedColumnKey] =
    useState<string | null>(null);

  const [storageReady, setStorageReady] = useState(false);

  const [hoveredPlayer, setHoveredPlayer] =
    useState<PlayerRow | null>(null);

  const [tooltipPointer, setTooltipPointer] =
    useState<TooltipPointer>({
      x: 0,
      y: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    });

  const allColumns = useMemo<ColumnDefinition[]>(() => {
    const dynamicStrategyColumns = strategyColumns.map(
      (columnName) => ({
        key: columnName,
        label: formatStrategyLabel(columnName),
      }),
    );

    return [...BASE_COLUMNS, ...dynamicStrategyColumns];
  }, [strategyColumns]);

  const allowedColumnKeySet = useMemo(
    () => new Set(allColumns.map((column) => column.key)),
    [allColumns],
  );

  const strategyColumnKeySet = useMemo(
    () => new Set(strategyColumns),
    [strategyColumns],
  );

  const orderedColumns = useMemo(() => {
    const columnsByKey = new Map(
      allColumns.map((column) => [column.key, column]),
    );

    const ordered = columnOrderKeys
      .map((columnKey) => columnsByKey.get(columnKey))
      .filter(
        (column): column is ColumnDefinition =>
          column !== undefined,
      );

    const orderedKeySet = new Set(
      ordered.map((column) => column.key),
    );

    for (const column of allColumns) {
      if (!orderedKeySet.has(column.key)) {
        ordered.push(column);
      }
    }

    return ordered;
  }, [allColumns, columnOrderKeys]);

  const orderedMainColumns = useMemo(
    () =>
      orderedColumns.filter(
        (column) => !strategyColumnKeySet.has(column.key),
      ),
    [orderedColumns, strategyColumnKeySet],
  );

  const orderedStrategyColumns = useMemo(
    () =>
      orderedColumns.filter((column) =>
        strategyColumnKeySet.has(column.key),
      ),
    [orderedColumns, strategyColumnKeySet],
  );

  const groupedOrderedColumns = useMemo(
    () => [...orderedMainColumns, ...orderedStrategyColumns],
    [orderedMainColumns, orderedStrategyColumns],
  );

  const existingPlayerKeySet = useMemo(
    () =>
      new Set(
        initialPlayers.map((player) => getPlayerKey(player)),
      ),
    [initialPlayers],
  );

  /*
   * Il ripristino da localStorage viene pianificato nel frame successivo:
   * le chiamate setState non sono quindi sincrone nel corpo dell’effect.
   */
  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      try {
        const savedState = window.localStorage.getItem(STORAGE_KEY);

        if (!savedState) {
          return;
        }

        const parsedState = JSON.parse(
          savedState,
        ) as PersistedAuctionState;

        const savedBudget = readPositiveNumber(
          parsedState.initialBudget,
        );

        if (savedBudget !== null) {
          setInitialBudget(savedBudget);
        }

        const savedRecordPurchasePrice = readBoolean(
          parsedState.recordPurchasePrice,
        );

        if (savedRecordPurchasePrice !== null) {
          setRecordPurchasePrice(savedRecordPurchasePrice);
        }

        const savedConfigurationOpen = readBoolean(
          parsedState.configurationOpen,
        );

        if (savedConfigurationOpen !== null) {
          setConfigurationOpen(savedConfigurationOpen);
        }

        const savedColumnsVisibilityOpen = readBoolean(
          parsedState.columnsVisibilityOpen,
        );

        if (savedColumnsVisibilityOpen !== null) {
          setColumnsVisibilityOpen(savedColumnsVisibilityOpen);
        }

        const savedRoleBudgets = readRoleBudgets(
          parsedState.roleBudgets,
        );

        if (savedRoleBudgets) {
          setRoleBudgets(savedRoleBudgets);
        }

        setPurchasePrices(
          readPurchasePrices(
            parsedState.purchasePrices,
            existingPlayerKeySet,
          ),
        );

        if (Array.isArray(parsedState.purchasedPlayerKeys)) {
          const validPurchasedKeys = Array.from(
            new Set(
              parsedState.purchasedPlayerKeys.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  existingPlayerKeySet.has(value),
              ),
            ),
          );

          setPurchasedPlayerKeys(validPurchasedKeys);
        }

        if (Array.isArray(parsedState.deletedPlayerKeys)) {
          const validDeletedKeys = Array.from(
            new Set(
              parsedState.deletedPlayerKeys.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  existingPlayerKeySet.has(value),
              ),
            ),
          );

          setDeletedPlayerKeys(validDeletedKeys);
        }

        const savedRoleLimits = readRoleLimits(
          parsedState.roleLimits,
        );

        if (savedRoleLimits) {
          setRoleLimits(savedRoleLimits);
        }

        if (Array.isArray(parsedState.visibleColumnKeys)) {
          const validVisibleColumns = Array.from(
            new Set(
              parsedState.visibleColumnKeys.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  allowedColumnKeySet.has(value),
              ),
            ),
          );

          if (validVisibleColumns.length > 0) {
            setVisibleColumnKeys(validVisibleColumns);
          }
        }

        if (Array.isArray(parsedState.columnOrderKeys)) {
          const validColumnOrder = Array.from(
            new Set(
              parsedState.columnOrderKeys.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  allowedColumnKeySet.has(value),
              ),
            ),
          );

          setColumnOrderKeys(validColumnOrder);
        }
      } catch (error) {
        console.error(
          "Impossibile leggere lo stato salvato di Fantawalter.",
          error,
        );
      } finally {
        setStorageReady(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [allowedColumnKeySet, existingPlayerKeySet]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    const stateToSave = {
      initialBudget,
      purchasedPlayerKeys,
      deletedPlayerKeys,
      roleLimits,
      visibleColumnKeys,
      columnOrderKeys,
      recordPurchasePrice,
      purchasePrices,
      configurationOpen,
      columnsVisibilityOpen,
      roleBudgets,
    };

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stateToSave),
      );
    } catch (error) {
      console.error(
        "Impossibile salvare lo stato di Fantawalter.",
        error,
      );
    }
  }, [
    initialBudget,
    purchasedPlayerKeys,
    deletedPlayerKeys,
    roleLimits,
    storageReady,
    visibleColumnKeys,
    columnOrderKeys,
    recordPurchasePrice,
    purchasePrices,
    configurationOpen,
    columnsVisibilityOpen,
    roleBudgets,
  ]);

  useEffect(() => {
    if (!isBinOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsBinOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isBinOpen]);

  const visibleColumns = useMemo(
    () =>
      groupedOrderedColumns.filter((column) =>
        visibleColumnKeys.includes(column.key),
      ),
    [groupedOrderedColumns, visibleColumnKeys],
  );

  const roles = useMemo(() => {
    const roleOrder = ["P", "D", "C", "A"];

    const availableRoles = new Set(
      initialPlayers
        .map((player) => getTextValue(player, "ruolo"))
        .filter(Boolean),
    );

    return roleOrder.filter((role) =>
      availableRoles.has(role),
    );
  }, [initialPlayers]);

  const teams = useMemo(() => {
    return Array.from(
      new Set(
        initialPlayers
          .map((player) => getTextValue(player, "team"))
          .filter(Boolean),
      ),
    ).sort((firstTeam, secondTeam) =>
      firstTeam.localeCompare(secondTeam, "it", {
        sensitivity: "base",
      }),
    );
  }, [initialPlayers]);

  const purchasedPlayerKeySet = useMemo(
    () => new Set(purchasedPlayerKeys),
    [purchasedPlayerKeys],
  );

  const deletedPlayerKeySet = useMemo(
    () => new Set(deletedPlayerKeys),
    [deletedPlayerKeys],
  );

  const purchasedPlayers = useMemo(
    () =>
      initialPlayers.filter((player) => {
        const playerKey = getPlayerKey(player);

        return (
          purchasedPlayerKeySet.has(playerKey) &&
          !deletedPlayerKeySet.has(playerKey)
        );
      }),
    [
      deletedPlayerKeySet,
      initialPlayers,
      purchasedPlayerKeySet,
    ],
  );

  const deletedPlayers = useMemo(() => {
    const playerByKey = new Map(
      initialPlayers.map((player) => [
        getPlayerKey(player),
        player,
      ]),
    );

    return deletedPlayerKeys
      .map((playerKey) => playerByKey.get(playerKey))
      .filter((player): player is PlayerRow => Boolean(player));
  }, [deletedPlayerKeys, initialPlayers]);

  const availablePlayersCount = useMemo(
    () =>
      initialPlayers.filter((player) => {
        const playerKey = getPlayerKey(player);

        return (
          !purchasedPlayerKeySet.has(playerKey) &&
          !deletedPlayerKeySet.has(playerKey)
        );
      }).length,
    [
      deletedPlayerKeySet,
      initialPlayers,
      purchasedPlayerKeySet,
    ],
  );

  const nameSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          initialPlayers
            .filter((player) => {
              const playerKey = getPlayerKey(player);

              return (
                !purchasedPlayerKeySet.has(playerKey) &&
                !deletedPlayerKeySet.has(playerKey)
              );
            })
            .map((player) => getTextValue(player, "nome"))
            .filter(Boolean),
        ),
      ).sort((firstName, secondName) =>
        firstName.localeCompare(secondName, "it", {
          sensitivity: "base",
        }),
      ),
    [
      deletedPlayerKeySet,
      initialPlayers,
      purchasedPlayerKeySet,
    ],
  );

  const displayedPlayers = useMemo(() => {
    const normalizedSearch = nameSearch
      .trim()
      .toLocaleLowerCase("it");

    const filteredPlayers = initialPlayers.filter((player) => {
      const playerKey = getPlayerKey(player);

      if (
        purchasedPlayerKeySet.has(playerKey) ||
        deletedPlayerKeySet.has(playerKey)
      ) {
        return false;
      }

      const ruolo = getTextValue(player, "ruolo");
      const team = getTextValue(player, "team");
      const nome = getTextValue(
        player,
        "nome",
      ).toLocaleLowerCase("it");

      return (
        (!roleFilter || ruolo === roleFilter) &&
        (!teamFilter || team === teamFilter) &&
        (!normalizedSearch || nome.includes(normalizedSearch))
      );
    });

    return [...filteredPlayers].sort(
      (firstPlayer, secondPlayer) => {
        const firstValue = firstPlayer[sortColumn];
        const secondValue = secondPlayer[sortColumn];

        const firstIsEmpty = isEmptyValue(firstValue);
        const secondIsEmpty = isEmptyValue(secondValue);

        if (firstIsEmpty && secondIsEmpty) {
          return 0;
        }

        if (firstIsEmpty) {
          return 1;
        }

        if (secondIsEmpty) {
          return -1;
        }

        const firstNumber = parseNumericValue(firstValue);
        const secondNumber = parseNumericValue(secondValue);

        let comparison = 0;

        if (firstNumber !== null && secondNumber !== null) {
          comparison = firstNumber - secondNumber;
        } else {
          comparison = String(firstValue).localeCompare(
            String(secondValue),
            "it",
            {
              numeric: true,
              sensitivity: "base",
            },
          );
        }

        return sortDirection === "asc"
          ? comparison
          : -comparison;
      },
    );
  }, [
    initialPlayers,
    roleFilter,
    teamFilter,
    nameSearch,
    sortColumn,
    sortDirection,
    purchasedPlayerKeySet,
    deletedPlayerKeySet,
  ]);

  function updateTooltipPointer(
    event: ReactMouseEvent<HTMLElement>,
  ): void {
    setTooltipPointer({
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }

  function showPlayerTooltip(
    event: ReactMouseEvent<HTMLElement>,
    player: PlayerRow,
  ): void {
    updateTooltipPointer(event);
    setHoveredPlayer(player);
  }

  function hidePlayerTooltip(): void {
    setHoveredPlayer(null);
  }

  function changeSorting(columnName: string): void {
    if (NON_SORTABLE_COLUMNS.has(columnName)) {
      return;
    }

    if (sortColumn === columnName) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );

      return;
    }

    setSortColumn(columnName);
    setSortDirection("asc");
  }

  function toggleColumn(columnName: string): void {
    setVisibleColumnKeys((currentColumns) => {
      if (currentColumns.includes(columnName)) {
        const remainingColumns = currentColumns.filter(
          (currentColumn) => currentColumn !== columnName,
        );

        return remainingColumns.length > 0
          ? remainingColumns
          : currentColumns;
      }

      return [...currentColumns, columnName];
    });
  }

  function showAllColumns(): void {
    setVisibleColumnKeys(
      groupedOrderedColumns.map((column) => column.key),
    );
  }

  function restoreDefaultColumns(): void {
    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrderKeys([]);
  }

  function reorderColumn(
    sourceColumnKey: string,
    targetColumnKey: string,
  ): void {
    if (sourceColumnKey === targetColumnKey) {
      return;
    }

    const sourceIsStrategy =
      strategyColumnKeySet.has(sourceColumnKey);
    const targetIsStrategy =
      strategyColumnKeySet.has(targetColumnKey);

    /*
     * Le colonne principali e le strategie restano in due
     * gruppi distinti; il trascinamento riordina il gruppo.
     */
    if (sourceIsStrategy !== targetIsStrategy) {
      return;
    }

    const nextOrder = groupedOrderedColumns.map(
      (column) => column.key,
    );
    const sourceIndex = nextOrder.indexOf(sourceColumnKey);
    const targetIndex = nextOrder.indexOf(targetColumnKey);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, sourceColumnKey);
    setColumnOrderKeys(nextOrder);
  }

  function resetFilters(): void {
    setRoleFilter("");
    setTeamFilter("");
    setNameSearch("");
  }

  function resetAuction(): void {
    const confirmed = window.confirm(
      "Vuoi azzerare rosa, cestino, budget, limiti e colonne salvate?",
    );

    if (!confirmed) {
      return;
    }

    setPurchasedPlayerKeys([]);
    setDeletedPlayerKeys([]);
    setHoveredPlayer(null);
    setIsBinOpen(false);
    setHoveredHelpTopic(null);
    setInitialBudget(500);
    setRecordPurchasePrice(false);
    setPurchasePrices({});
    setRoleBudgets({ ...DEFAULT_ROLE_BUDGETS });
    setConfigurationOpen(true);
    setColumnsVisibilityOpen(true);
    setRoleLimits({ ...DEFAULT_ROLE_LIMITS });
    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrderKeys([]);
    resetFilters();
    setSortColumn("nome");
    setSortDirection("asc");

    window.localStorage.removeItem(STORAGE_KEY);
  }

  function purchasePlayer(player: PlayerRow): void {
    setHoveredPlayer(null);

    const playerKey = getPlayerKey(player);

    if (deletedPlayerKeySet.has(playerKey)) {
      window.alert(
        "Il giocatore è nel cestino. Ripristinalo prima di acquistarlo.",
      );
      return;
    }

    const role = getPlayerRole(player);

    if (!role) {
      window.alert("Il giocatore non ha un ruolo valido.");
      return;
    }

    const purchasedInRole = purchasedPlayers.filter(
      (purchasedPlayer) =>
        getPlayerRole(purchasedPlayer) === role,
    ).length;

    if (purchasedInRole >= roleLimits[role]) {
      window.alert(
        `Hai già raggiunto il limite di ${roleLimits[role]} ` +
          `giocatori per il ruolo ${role}.`,
      );

      return;
    }

    let purchasePrice: number | null = null;

    if (recordPurchasePrice) {
      const expectedPercentage =
        parseNumericValue(player.media_strategie) ??
        parseNumericValue(player.pma);
      const expectedPrice =
        expectedPercentage !== null && expectedPercentage > 0
          ? calculateCredits(expectedPercentage, initialBudget)
          : null;

      const rawPrice = window.prompt(
        `Prezzo di acquisto per ${getTextValue(player, "nome")}:`,
        expectedPrice !== null ? String(expectedPrice) : "",
      );

      if (rawPrice === null) {
        return;
      }

      const parsedPrice = parseNumericValue(rawPrice);

      if (
        parsedPrice === null ||
        parsedPrice < 0 ||
        !Number.isFinite(parsedPrice)
      ) {
        window.alert(
          "Inserisci un prezzo numerico valido oppure annulla.",
        );
        return;
      }

      purchasePrice = Math.round(parsedPrice);

      const plannedRoleBudget = roleBudgets[role];

      if (plannedRoleBudget > 0) {
        const currentRoleSpent = purchasedPlayers.reduce(
          (total, purchasedPlayer) => {
            if (getPlayerRole(purchasedPlayer) !== role) {
              return total;
            }

            return (
              total +
              (purchasePrices[getPlayerKey(purchasedPlayer)] ?? 0)
            );
          },
          0,
        );
        const projectedRoleSpent =
          currentRoleSpent + purchasePrice;

        if (projectedRoleSpent > plannedRoleBudget) {
          const overrun =
            projectedRoleSpent - plannedRoleBudget;
          const roleLabel = ROLE_PLURAL_LABELS[role];
          const confirmed = window.confirm(
            `Con questo acquisto la spesa per i ${roleLabel} ` +
              `salirebbe a ${projectedRoleSpent} crediti, ` +
              `superando di ${overrun} il budget previsto di ` +
              `${plannedRoleBudget} crediti. Vuoi confermare ` +
              `comunque l'acquisto?`,
          );

          if (!confirmed) {
            return;
          }
        }
      }
    }

    setPurchasedPlayerKeys((currentKeys) => {
      if (currentKeys.includes(playerKey)) {
        return currentKeys;
      }

      return [...currentKeys, playerKey];
    });

    if (purchasePrice !== null) {
      setPurchasePrices((currentPrices) => ({
        ...currentPrices,
        [playerKey]: purchasePrice,
      }));
    }
  }

  function removePurchasedPlayer(player: PlayerRow): void {
    const playerKey = getPlayerKey(player);

    setPurchasedPlayerKeys((currentKeys) =>
      currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    );

    setPurchasePrices((currentPrices) => {
      const nextPrices = { ...currentPrices };
      delete nextPrices[playerKey];
      return nextPrices;
    });
  }

  function deletePlayer(player: PlayerRow): void {
    setHoveredPlayer(null);

    const playerKey = getPlayerKey(player);

    setPurchasedPlayerKeys((currentKeys) =>
      currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    );

    setPurchasePrices((currentPrices) => {
      const nextPrices = { ...currentPrices };
      delete nextPrices[playerKey];
      return nextPrices;
    });

    setDeletedPlayerKeys((currentKeys) => [
      playerKey,
      ...currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    ]);
  }

  function restorePlayer(player: PlayerRow): void {
    const playerKey = getPlayerKey(player);

    setDeletedPlayerKeys((currentKeys) =>
      currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    );
  }

  function changeRoleLimit(
    role: PlayerRole,
    value: number,
  ): void {
    setRoleLimits((currentLimits) => ({
      ...currentLimits,
      [role]: value,
    }));
  }

  function changeRoleBudget(
    role: PlayerRole,
    value: number,
  ): void {
    setRoleBudgets((currentBudgets) => ({
      ...currentBudgets,
      [role]: value,
    }));
  }

  const totalPlannedRoleBudget = ROLE_ORDER.reduce(
    (total, role) => total + roleBudgets[role],
    0,
  );
  const unallocatedRoleBudget =
    initialBudget - totalPlannedRoleBudget;

  function renderColumnControls(
    columns: ColumnDefinition[],
  ) {
    return columns.map((column) => {
      const isVisible = visibleColumnKeys.includes(column.key);
      const isDragging = draggedColumnKey === column.key;

      return (
        <div
          key={column.key}
          draggable
          onDragStart={(event) => {
            setDraggedColumnKey(column.key);
            event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();

            if (draggedColumnKey) {
              reorderColumn(draggedColumnKey, column.key);
            }

            setDraggedColumnKey(null);
          }}
          onDragEnd={() => setDraggedColumnKey(null)}
          style={{
            ...columnDragItemStyle,
            opacity: isDragging ? 0.45 : 1,
          }}
          title="Trascina per spostare la colonna nel suo gruppo"
        >
          <span style={dragHandleStyle}>☰</span>

          <button
            type="button"
            onClick={() => toggleColumn(column.key)}
            style={{
              ...columnButtonStyle,
              background: isVisible ? "#f1c40f" : "#bdc3c7",
              borderColor: isVisible ? "#f39c12" : "#95a5a6",
              color: isVisible ? "#222" : "#555",
            }}
          >
            {column.label}
          </button>
        </div>
      );
    });
  }

  function getSortIndicator(columnName: string): string {
    if (sortColumn !== columnName) {
      return "";
    }

    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  return (
    <main className="fantawalter-page" style={pageStyle}>
      <style>{`
        @media (max-width: 1100px) {
          .fantawalter-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .fantawalter-squad-panel {
            max-height: none !important;
          }
        }

        @media (max-width: 640px) {
          .fantawalter-page {
            padding: 10px !important;
          }

          .fantawalter-main-panel,
          .fantawalter-squad-panel {
            padding: 12px !important;
          }

          .fantawalter-configuration-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }
        }
      `}</style>

      <div className="fantawalter-layout" style={layoutStyle}>
        <section
          className="fantawalter-main-panel"
          style={containerStyle}
        >
          <section style={configurationPanelStyle}>
            <div
              className="fantawalter-configuration-header"
              style={configurationHeaderRowStyle}
            >
              <button
                type="button"
                aria-expanded={configurationOpen}
                onClick={() =>
                  setConfigurationOpen((currentValue) => !currentValue)
                }
                style={configurationToggleButtonStyle}
              >
                <span aria-hidden="true" style={sectionArrowStyle}>
                  {configurationOpen ? "▼" : "▶"}
                </span>
                <span>⚙️ Configurazione</span>
              </button>

              <div style={supportButtonsStyle}>
                <PayPalSupportButton />
              </div>
            </div>

            {configurationOpen && (
              <>
                <div style={configurationTopRowStyle}>
              <div style={configurationLeftActionsStyle}>
                <label style={configurationFieldStyle}>
                  <span style={labelStyle}>Budget iniziale</span>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={initialBudget}
                    onChange={(event) => {
                      const value =
                        event.currentTarget.valueAsNumber;

                      setInitialBudget(
                        Number.isFinite(value) && value > 0
                          ? value
                          : 0,
                      );
                    }}
                    style={{ ...controlStyle, width: "140px" }}
                  />
                </label>

                <div style={actionWithHelpStyle}>
                  <button
                    type="button"
                    aria-describedby={
                      hoveredHelpTopic === "resetAuction"
                        ? "reset-auction-help"
                        : undefined
                    }
                    onClick={resetAuction}
                    onMouseEnter={() =>
                      setHoveredHelpTopic("resetAuction")
                    }
                    onMouseLeave={() => setHoveredHelpTopic(null)}
                    onFocus={() =>
                      setHoveredHelpTopic("resetAuction")
                    }
                    onBlur={() => setHoveredHelpTopic(null)}
                    style={resetAuctionButtonStyle}
                  >
                    Azzera asta
                  </button>

                  {hoveredHelpTopic === "resetAuction" && (
                    <span
                      id="reset-auction-help"
                      role="tooltip"
                      style={{
                        ...helpTooltipStyle,
                        left: 0,
                      }}
                    >
                      {HELP_MESSAGES.resetAuction.description}
                    </span>
                  )}
                </div>
              </div>

              <div style={purchasePriceActionStyle}>
                <button
                  type="button"
                  aria-pressed={recordPurchasePrice}
                  aria-describedby={
                    hoveredHelpTopic === "purchasePrice"
                      ? "purchase-price-help"
                      : undefined
                  }
                  onClick={() =>
                    setRecordPurchasePrice((currentValue) =>
                      !currentValue
                    )
                  }
                  onMouseEnter={() =>
                    setHoveredHelpTopic("purchasePrice")
                  }
                  onMouseLeave={() => setHoveredHelpTopic(null)}
                  onFocus={() =>
                    setHoveredHelpTopic("purchasePrice")
                  }
                  onBlur={() => setHoveredHelpTopic(null)}
                  style={{
                    ...purchasePriceToggleStyle,
                    ...(recordPurchasePrice
                      ? purchasePriceToggleActiveStyle
                      : {}),
                  }}
                >
                  <span style={purchasePriceToggleIconStyle}>🧾</span>
                  <span>
                    <strong>Registra prezzi di acquisto</strong>
                    <small style={optionDescriptionStyle}>
                      {recordPurchasePrice
                        ? "Attivo: configura il budget previsto per ruolo."
                        : "Disattivato: l'acquisto non richiede il prezzo."}
                    </small>
                  </span>
                </button>

                {hoveredHelpTopic === "purchasePrice" && (
                  <span
                    id="purchase-price-help"
                    role="tooltip"
                    style={{
                      ...helpTooltipStyle,
                      right: 0,
                    }}
                  >
                    {HELP_MESSAGES.purchasePrice.description}
                  </span>
                )}
              </div>
            </div>

            {recordPurchasePrice && (
              <section style={roleBudgetMenuStyle}>
                <div style={roleBudgetMenuHeaderStyle}>
                  <div>
                    <strong>Budget previsto per ruolo</strong>
                    <p style={roleBudgetHelpStyle}>
                      Inserendo un tetto di spesa in crediti verranno
                      attivati anche gli avvisi sulle spese.
                    </p>
                  </div>

                  <span style={plannedBudgetBadgeStyle}>
                    {totalPlannedRoleBudget}/{initialBudget}
                  </span>
                </div>

                <div style={roleBudgetInputsStyle}>
                  {ROLE_ORDER.map((role) => (
                    <label key={role} style={roleBudgetFieldStyle}>
                      <span style={labelStyle}>
                        {role} · {ROLE_PLURAL_LABELS[role]}
                      </span>

                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={roleBudgets[role]}
                        onChange={(event) => {
                          const value =
                            event.currentTarget.valueAsNumber;

                          changeRoleBudget(
                            role,
                            Number.isFinite(value)
                              ? Math.max(0, Math.trunc(value))
                              : 0,
                          );
                        }}
                        style={{ ...controlStyle, width: "120px" }}
                      />
                    </label>
                  ))}
                </div>

                <div
                  style={{
                    ...roleBudgetStatusStyle,
                    ...(unallocatedRoleBudget < 0
                      ? roleBudgetStatusWarningStyle
                      : {}),
                  }}
                >
                  {unallocatedRoleBudget > 0 && (
                    <>
                      Restano <strong>{unallocatedRoleBudget}</strong>{" "}
                      crediti non assegnati ai ruoli.
                    </>
                  )}

                  {unallocatedRoleBudget === 0 && (
                    <>Il budget iniziale è interamente assegnato.</>
                  )}

                  {unallocatedRoleBudget < 0 && (
                    <>
                      La pianificazione supera il budget iniziale di{" "}
                      <strong>{Math.abs(unallocatedRoleBudget)}</strong>{" "}
                      crediti.
                    </>
                  )}
                </div>
              </section>
            )}
              </>
            )}
          </section>

          <details
            open={columnsVisibilityOpen}
            onToggle={(event) =>
              setColumnsVisibilityOpen(event.currentTarget.open)
            }
            style={columnsVisibilityPanelStyle}
          >
            <summary style={configurationSummaryStyle}>
              👁️ Visibilità colonne
            </summary>

            <div style={columnsPanelContentStyle}>
              <div style={columnsPanelHeaderStyle}>
                <p style={columnHelpStyle}>
                  Trascina le colonne per riordinarle nel proprio
                  gruppo. Clicca sul nome per mostrarle o nasconderle.
                </p>

                <div style={columnUtilityButtonsStyle}>
                  <button
                    type="button"
                    onClick={showAllColumns}
                    style={smallButtonStyle}
                  >
                    Mostra tutte
                  </button>

                  <button
                    type="button"
                    onClick={restoreDefaultColumns}
                    style={smallButtonStyle}
                  >
                    Ripristina predefinite
                  </button>
                </div>
              </div>

              <section style={columnGroupStyle}>
                <h4 style={columnGroupTitleStyle}>
                  Colonne principali
                </h4>
                <div style={columnButtonsStyle}>
                  {renderColumnControls(orderedMainColumns)}
                </div>
              </section>

              <section style={strategyColumnGroupStyle}>
                <h4 style={columnGroupTitleStyle}>Strategie</h4>

                {orderedStrategyColumns.length > 0 ? (
                  <div style={columnButtonsStyle}>
                    {renderColumnControls(orderedStrategyColumns)}
                  </div>
                ) : (
                  <p style={emptyStrategiesStyle}>
                    Nessuna colonna strategia rilevata.
                  </p>
                )}
              </section>
            </div>
          </details>

          <div style={filtersStyle}>
            <label>
              <span style={labelStyle}>Ruolo</span>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                style={{ ...controlStyle, minWidth: "110px" }}
              >
                <option value="">Tutti</option>

                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={labelStyle}>Squadra</span>

              <select
                value={teamFilter}
                onChange={(event) =>
                  setTeamFilter(event.target.value)
                }
                style={{ ...controlStyle, minWidth: "180px" }}
              >
                <option value="">Tutte</option>

                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={labelStyle}>Nome</span>

              <input
                type="search"
                list="fantawalter-player-names"
                value={nameSearch}
                placeholder="Digita o scegli un giocatore..."
                autoComplete="off"
                onChange={(event) =>
                  setNameSearch(event.target.value)
                }
                style={{ ...controlStyle, minWidth: "260px" }}
              />

              <datalist id="fantawalter-player-names">
                {nameSuggestions.map((playerName) => (
                  <option key={playerName} value={playerName} />
                ))}
              </datalist>
            </label>

            <button
              type="button"
              onClick={() => {
                setHoveredPlayer(null);
                setIsBinOpen(true);
              }}
              style={filterBinButtonStyle}
            >
              🗑️ Cestino

              {deletedPlayers.length > 0 && (
                <span style={binBadgeStyle}>
                  {deletedPlayers.length}
                </span>
              )}
            </button>
          </div>

          <div style={summaryStyle}>
            <span>
              Giocatori nella lista {" "}
              <strong>{availablePlayersCount}</strong>
            </span>

            <span>
              Ultimo aggiornamento: {" "}
              <strong>{formatLastUpdate(lastUpdate)}</strong>
            </span>
          </div>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...headerCellStyle,
                      ...actionsHeaderCellStyle,
                    }}
                    title="Azioni"
                  >
                    Az.
                  </th>

                  {visibleColumns.map((column) => {
                    const sortable = !NON_SORTABLE_COLUMNS.has(
                      column.key,
                    );

                    return (
                      <th
                        key={column.key}
                        onClick={() => changeSorting(column.key)}
                        aria-sort={
                          sortable && sortColumn === column.key
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        title={
                          sortable
                            ? `Ordina per ${column.label}`
                            : column.label
                        }
                        style={{
                          ...headerCellStyle,
                          cursor: sortable ? "pointer" : "default",
                        }}
                      >
                        {column.label}
                        {sortable && getSortIndicator(column.key)}
                      </th>
                    );
                  })}

                </tr>
              </thead>

              <tbody>
                {displayedPlayers.map((player) => {
                  const ruolo = getTextValue(player, "ruolo");
                  const rowKey = getPlayerKey(player);

                  return (
                    <tr key={rowKey}>
                      <td style={actionCellStyle}>
                        <div style={actionButtonsStyle}>
                          <button
                            type="button"
                            onClick={() => purchasePlayer(player)}
                            style={buyIconButtonStyle}
                            aria-label={`Aggiungi ${getTextValue(player, "nome")} alla rosa`}
                            title="Aggiungi alla rosa"
                          >
                            🛒
                          </button>

                          <button
                            type="button"
                            onClick={() => deletePlayer(player)}
                            style={deleteIconButtonStyle}
                            aria-label={`Elimina ${getTextValue(player, "nome")}`}
                            title="Sposta nel cestino"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>

                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          onMouseEnter={
                            column.key === "nome"
                              ? (event) =>
                                  showPlayerTooltip(event, player)
                              : undefined
                          }
                          onMouseMove={
                            column.key === "nome"
                              ? updateTooltipPointer
                              : undefined
                          }
                          onMouseLeave={
                            column.key === "nome"
                              ? hidePlayerTooltip
                              : undefined
                          }
                          style={{
                            ...cellStyle,
                            ...(column.key === "ruolo"
                              ? getRoleCellStyle(ruolo)
                              : {}),
                            ...(column.key === "nome"
                              ? nameCellStyle
                              : {}),
                          }}
                        >
                          <PlayerCell
                            player={player}
                            columnName={column.key}
                            initialBudget={initialBudget}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {displayedPlayers.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(
                        visibleColumns.length + 1,
                        1,
                      )}
                      style={{
                        padding: "30px",
                        textAlign: "center",
                      }}
                    >
                      Nessun giocatore trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside
          className="fantawalter-squad-panel"
          style={rightPanelStyle}
        >
          <SquadPanel
            purchasedPlayers={purchasedPlayers}
            roleLimits={roleLimits}
            onLimitChange={changeRoleLimit}
            onRemovePlayer={removePurchasedPlayer}
            onDeletePlayer={deletePlayer}
            recordPurchasePrice={recordPurchasePrice}
            purchasePrices={purchasePrices}
            initialBudget={initialBudget}
            roleBudgets={roleBudgets}
          />
        </aside>
      </div>

      <PlayerTooltip
        player={hoveredPlayer}
        pointerX={tooltipPointer.x}
        pointerY={tooltipPointer.y}
        viewportWidth={tooltipPointer.viewportWidth}
        viewportHeight={tooltipPointer.viewportHeight}
        initialBudget={initialBudget}
        strategyColumns={strategyColumns}
        purchasedPlayers={purchasedPlayers}
        roleLimits={roleLimits}
        recordPurchasePrice={recordPurchasePrice}
        purchasePrices={purchasePrices}
        roleBudgets={roleBudgets}
      />

      {isBinOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsBinOpen(false);
            }
          }}
          style={modalOverlayStyle}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleted-players-title"
            style={modalContentStyle}
          >
            <div style={modalHeaderStyle}>
              <h2 id="deleted-players-title" style={{ margin: 0 }}>
                Giocatori eliminati
              </h2>

              <button
                type="button"
                aria-label="Chiudi cestino"
                title="Chiudi"
                onClick={() => setIsBinOpen(false)}
                style={closeModalButtonStyle}
              >
                ×
              </button>
            </div>

            {deletedPlayers.length === 0 ? (
              <p style={{ marginBottom: 0 }}>
                Il cestino è vuoto.
              </p>
            ) : (
              <div style={deletedPlayersListStyle}>
                {deletedPlayers.map((player) => {
                  const role = getTextValue(player, "ruolo");

                  return (
                    <div
                      key={getPlayerKey(player)}
                      style={deletedPlayerItemStyle}
                    >
                      <span>
                        <span
                          style={{
                            ...deletedRoleBadgeStyle,
                            ...getRoleCellStyle(role),
                          }}
                        >
                          {role || "-"}
                        </span>{" "}
                        <strong>{getTextValue(player, "nome")}</strong>
                        {" ("}
                        {getTextValue(player, "team") || "-"}
                        {")"}
                      </span>

                      <button
                        type="button"
                        onClick={() => restorePlayer(player)}
                        style={restoreButtonStyle}
                      >
                        Ripristina
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}


const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "#f0f2f5",
  color: "#222",
  fontFamily: "Arial, sans-serif",
};

const layoutStyle: CSSProperties = {
  maxWidth: "1900px",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns:
    "minmax(700px, 2fr) minmax(430px, 1fr)",
  gap: "16px",
  alignItems: "start",
};

const containerStyle: CSSProperties = {
  minWidth: 0,
  padding: "20px",
  background: "#fff",
  borderRadius: "10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const rightPanelStyle: CSSProperties = {
  minWidth: 0,
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  padding: "20px",
  background: "#fff",
  borderRadius: "10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const configurationPanelStyle: CSSProperties = {
  marginBottom: "14px",
  padding: "0 14px",
  border: "1px solid #d7dee5",
  borderRadius: "8px",
  background: "#f8fafc",
};

const configurationSummaryStyle: CSSProperties = {
  padding: "11px 0",
  color: "#2c3e50",
  fontWeight: 800,
  cursor: "pointer",
  userSelect: "none",
};

const configurationHeaderRowStyle: CSSProperties = {
  minHeight: "48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "10px",
};

const configurationToggleButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "11px 0",
  border: 0,
  background: "transparent",
  color: "#2c3e50",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
};

const supportButtonsStyle: CSSProperties = {
  minWidth: 0,
  minHeight: "36px",
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexShrink: 0,
};

const sectionArrowStyle: CSSProperties = {
  width: "12px",
  display: "inline-flex",
  justifyContent: "center",
  fontSize: "0.72rem",
  lineHeight: 1,
};

const configurationTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "14px",
  padding: "0 0 14px",
};

const configurationLeftActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "end",
  flexWrap: "wrap",
  gap: "12px",
};

const actionWithHelpStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const purchasePriceActionStyle: CSSProperties = {
  position: "relative",
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
};

const helpTooltipStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  zIndex: 40,
  width: "min(320px, calc(100vw - 40px))",
  padding: "9px 11px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#b8c5d1",
  borderRadius: "7px",
  background: "#ffffff",
  color: "#2c3e50",
  boxShadow: "0 6px 18px rgba(0, 0, 0, 0.16)",
  fontSize: "0.82rem",
  fontWeight: 500,
  lineHeight: 1.35,
  pointerEvents: "none",
};

const configurationFieldStyle: CSSProperties = {
  display: "block",
};

const purchasePriceToggleStyle: CSSProperties = {
  minHeight: "58px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "9px 13px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#b8c5d1",
  borderRadius: "8px",
  background: "#fff",
  color: "#2c3e50",
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const purchasePriceToggleActiveStyle: CSSProperties = {
  borderColor: "#2980b9",
  background: "#eaf4fb",
  boxShadow: "0 0 0 2px rgba(41,128,185,0.12)",
};

const purchasePriceToggleIconStyle: CSSProperties = {
  fontSize: "1.2rem",
};

const roleBudgetMenuStyle: CSSProperties = {
  marginBottom: "14px",
  padding: "13px",
  border: "1px solid #c9d8e5",
  borderRadius: "8px",
  background: "#fff",
};

const roleBudgetMenuHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: "12px",
  marginBottom: "11px",
};

const roleBudgetHelpStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#637381",
  fontSize: "0.82rem",
};

const plannedBudgetBadgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#eaf4fb",
  color: "#2471a3",
  fontWeight: 800,
  fontSize: "0.82rem",
};

const roleBudgetInputsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: "10px",
};

const roleBudgetFieldStyle: CSSProperties = {
  minWidth: 0,
};

const roleBudgetStatusStyle: CSSProperties = {
  marginTop: "10px",
  padding: "8px 10px",
  borderRadius: "6px",
  background: "#f3f8fc",
  color: "#34495e",
  fontSize: "0.84rem",
};

const roleBudgetStatusWarningStyle: CSSProperties = {
  background: "#ffebee",
  color: "#b03a2e",
};

const optionDescriptionStyle: CSSProperties = {
  display: "block",
  marginTop: "2px",
  color: "#637381",
  fontSize: "0.78rem",
  fontWeight: 400,
};

const filterBinButtonStyle: CSSProperties = {
  position: "relative",
  minHeight: "40px",
  padding: "8px 13px",
  border: 0,
  borderRadius: "7px",
  background: "#7f8c8d",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const binBadgeStyle: CSSProperties = {
  position: "absolute",
  top: "-7px",
  right: "-7px",
  minWidth: "20px",
  height: "20px",
  padding: "0 5px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  background: "#e74c3c",
  color: "#fff",
  fontSize: "0.72rem",
  lineHeight: 1,
};

const filtersStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  alignItems: "end",
  padding: "14px",
  marginBottom: "14px",
  background: "#f8f9fa",
  border: "1px solid #ddd",
  borderRadius: "8px",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "5px",
  fontWeight: 700,
};

const controlStyle: CSSProperties = {
  minHeight: "40px",
  padding: "8px 11px",
  border: "2px solid #aebdca",
  borderRadius: "7px",
  background: "#ffffff",
  color: "#1f2933",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
  outline: "none",
  fontSize: "0.95rem",
};

const columnsVisibilityPanelStyle: CSSProperties = {
  marginBottom: "14px",
  padding: "0 14px",
  border: "1px solid #d7dee5",
  borderRadius: "8px",
  background: "#fdfdfd",
};

const columnsPanelContentStyle: CSSProperties = {
  padding: "0 0 14px",
};

const columnsPanelHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginBottom: "10px",
};

const columnUtilityButtonsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const columnGroupStyle: CSSProperties = {
  padding: "10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#e1e6eb",
  borderRadius: "7px",
  background: "#fff",
};

const strategyColumnGroupStyle: CSSProperties = {
  ...columnGroupStyle,
  marginTop: "10px",
  borderColor: "#d7c8a2",
  background: "#fffaf0",
};

const columnGroupTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  color: "#2c3e50",
  fontSize: "0.9rem",
};

const emptyStrategiesStyle: CSSProperties = {
  margin: 0,
  color: "#7f8c8d",
  fontSize: "0.84rem",
};

const columnHelpStyle: CSSProperties = {
  margin: "0 0 9px",
  color: "#637381",
  fontSize: "0.82rem",
};

const columnButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
};

const columnDragItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "stretch",
  borderRadius: "5px",
  cursor: "grab",
  transition: "opacity 0.15s ease",
};

const dragHandleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0 6px",
  borderWidth: "1px 0 1px 1px",
  borderStyle: "solid",
  borderColor: "#95a5a6",
  borderRadius: "5px 0 0 5px",
  background: "#ecf0f1",
  color: "#5d6d7e",
  fontSize: "0.8rem",
  userSelect: "none",
};

const columnButtonStyle: CSSProperties = {
  padding: "6px 10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#95a5a6",
  borderRadius: "0 5px 5px 0",
  fontWeight: 700,
  cursor: "pointer",
};



const resetAuctionButtonStyle: CSSProperties = {
  padding: "8px 12px",
  border: 0,
  borderRadius: "5px",
  background: "#c0392b",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const smallButtonStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #aaa",
  borderRadius: "5px",
  background: "#fff",
  cursor: "pointer",
};

const summaryStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  marginBottom: "12px",
  fontSize: "0.95rem",
};

const tableWrapperStyle: CSSProperties = {
  maxHeight: "68vh",
  overflow: "auto",
  border: "1px solid #ddd",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
};

const headerCellStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  padding: "10px",
  border: "1px solid #ddd",
  background: "#34495e",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const cellStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const nameCellStyle: CSSProperties = {
  cursor: "help",
};

const actionsHeaderCellStyle: CSSProperties = {
  left: 0,
  zIndex: 4,
  width: "68px",
  minWidth: "68px",
  textAlign: "center",
};

const actionCellStyle: CSSProperties = {
  ...cellStyle,
  position: "sticky",
  left: 0,
  zIndex: 1,
  width: "68px",
  minWidth: "68px",
  padding: "4px",
  background: "#fff",
};

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "3px",
};

const buyIconButtonStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#7dcea0",
  borderRadius: "5px",
  background: "#d5f5e3",
  color: "#145a32",
  fontSize: "0.9rem",
  lineHeight: 1,
  cursor: "pointer",
};

const deleteIconButtonStyle: CSSProperties = {
  width: "25px",
  height: "28px",
  padding: 0,
  border: "1px solid #d9dfe5",
  borderRadius: "5px",
  background: "#fff",
  color: "#c0392b",
  fontSize: "0.78rem",
  lineHeight: 1,
  cursor: "pointer",
};


const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(0,0,0,0.5)",
};

const modalContentStyle: CSSProperties = {
  width: "min(680px, 100%)",
  maxHeight: "80vh",
  overflowY: "auto",
  padding: "20px",
  borderRadius: "10px",
  background: "#fff",
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  paddingBottom: "10px",
  marginBottom: "10px",
  borderBottom: "1px solid #ddd",
};

const closeModalButtonStyle: CSSProperties = {
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#777",
  fontSize: "2rem",
  lineHeight: 1,
  cursor: "pointer",
};

const deletedPlayersListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const deletedPlayerItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "8px",
  borderBottom: "1px solid #eee",
  color: "#666",
  textDecoration: "line-through",
};

const deletedRoleBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: "4px",
  color: "#222",
  textDecoration: "none",
};

const restoreButtonStyle: CSSProperties = {
  flexShrink: 0,
  padding: "6px 10px",
  border: 0,
  borderRadius: "5px",
  background: "#2ecc71",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};
