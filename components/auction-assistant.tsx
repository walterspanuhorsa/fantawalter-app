"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useRef,
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
  AUCTION_STORAGE_KEY,
  BASE_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  formatStrategyLabel,
  type ColumnDefinition,
  type PersistedAuctionState,
} from "@/lib/auction-settings";

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

type SortDirection = "asc" | "desc";

interface TooltipPointer {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
}

const NON_SORTABLE_COLUMNS = new Set([
  "note",
  "percezione",
]);

const NOTE_ICON_LEGEND = [
  "🏰 Modificatore",
  "🧱 Imbattibilità",
  "📋 Titolarissimo",
  "🎲 Scommessa",
  "❌ Pararigori",
  "🔄 Subentrante",
  "🚑 Rischio infortuni",
  "➕ Bonus",
  "👟 Assistman o tiratore",
  "🟥 Cartellini",
  "📉 Incostante",
  "📈 Costante",
  "🥅 Tanti gol",
  "🅿️ Rigorista",
  "🃏 Jolly",
  "🦁 Coppa d’Africa",
].join(" · ");

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  giocatore:
    "Mostra il ruolo a sinistra e, a destra, squadra e nome del giocatore.",
  titolarita:
    "Titolarità (1–5): un valore di 4 o 5 indica un giocatore stabilmente titolare e difficilmente sostituibile nella propria squadra.",
  affidabilita:
    "Affidabilità (1–5): più il valore è alto, maggiore è la tendenza del giocatore a ottenere voti positivi.",
  integrita:
    "Integrità (1–5): più il valore è alto, minore è la propensione del giocatore agli infortuni.",
  media_strategie:
    "Prezzo consigliato medio, espresso in crediti, calcolato sulle valutazioni dei creator esperti.",
  pma:
    "Prezzo medio d’asta: media dei prezzi a cui il giocatore è stato acquistato nelle aste registrate su Fantalab.",
  note: `Note sintetiche sul giocatore. Legenda: ${NOTE_ICON_LEGEND}`,
  percezione:
    "Confronta il prezzo medio d’asta con il prezzo consigliato medio: verde se il PMA è almeno il 10% più basso, rosso se è almeno il 10% più alto, grigio se i valori sono in linea o non disponibili.",
};

function getColumnDescription(
  column: ColumnDefinition,
): string {
  if (COLUMN_DESCRIPTIONS[column.key]) {
    return COLUMN_DESCRIPTIONS[column.key];
  }

  if (column.key.startsWith("strategia_")) {
    return `Prezzo consigliato da ${column.label}, espresso in crediti in base al budget iniziale.`;
  }

  return column.label;
}

function getColumnHeaderTitle(
  column: ColumnDefinition,
  sortable: boolean,
): string {
  const interactionHelp = sortable
    ? "Clicca per ordinare. Trascina per spostare la colonna."
    : "Trascina per spostare la colonna.";

  return `${getColumnDescription(column)}\n\n${interactionHelp}`;
}

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

function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .trim();
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

function getRoleCellStyle(role: string): CSSProperties {
  switch (role) {
    case "P":
      return {
        background: "var(--fw-role-p-soft)",
        fontWeight: 700,
      };

    case "D":
      return {
        background: "var(--fw-role-d-soft)",
        fontWeight: 700,
      };

    case "C":
      return {
        background: "var(--fw-role-c-soft)",
        fontWeight: 700,
      };

    case "A":
      return {
        background: "var(--fw-role-a-soft)",
        fontWeight: 700,
      };

    default:
      return {};
  }
}

function getRoleColor(role: PlayerRole): string {
  switch (role) {
    case "P":
      return "#d99000";
    case "D":
      return "#219653";
    case "C":
      return "#2d9cdb";
    case "A":
      return "#c44536";
  }
}

function getRoleFilterButtonStyle(
  role: PlayerRole | null,
  active: boolean,
): CSSProperties {
  if (!active) {
    return {
      background: "transparent",
      borderColor: "var(--fw-border-strong)",
      color: "var(--fw-text-secondary)",
      boxShadow: "none",
    };
  }

  return {
    background: role
      ? getRoleColor(role)
      : "var(--fw-accent)",
    borderColor: role ? "#ffffff" : "#34495e",
    color: "#ffffff",
    boxShadow: role
      ? "0 0 0 2px #f8f9fa, 0 2px 7px rgba(15, 23, 42, 0.2)"
      : "0 2px 7px rgba(15, 23, 42, 0.16)",
  };
}

function getPlayerRoleBadgeStyle(
  role: PlayerRole | null,
): CSSProperties {
  return {
    ...playerRoleBadgeStyle,
    background: role ? getRoleColor(role) : "#7f8c8d",
  };
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

function readStoredColumnKeys(
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

  return Array.from(
    new Set(
      migratedKeys.filter((item) =>
        allowedColumnKeySet.has(item),
      ),
    ),
  );
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [roleFilter, setRoleFilter] = useState<PlayerRole | "">("");
  const [teamFilter, setTeamFilter] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [initialBudget, setInitialBudget] = useState(500);
  const [recordPurchasePrice, setRecordPurchasePrice] =
    useState(false);
  const [purchasePrices, setPurchasePrices] = useState<
    Record<string, number>
  >({});
  const [roleBudgets, setRoleBudgets] =
    useState<RoleBudgets>(() => ({
      ...DEFAULT_ROLE_BUDGETS,
    }));

  const [purchasedPlayerKeys, setPurchasedPlayerKeys] =
    useState<string[]>([]);

  const [deletedPlayerKeys, setDeletedPlayerKeys] =
    useState<string[]>([]);

  const [isBinOpen, setIsBinOpen] = useState(false);
  const [roleLimits, setRoleLimits] = useState<RoleLimits>(
    () => ({ ...DEFAULT_ROLE_LIMITS }),
  );

  const [sortColumn, setSortColumn] =
    useState<string>("giocatore");

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
        const savedState = window.localStorage.getItem(AUCTION_STORAGE_KEY);

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
          const validVisibleColumns = readStoredColumnKeys(
            parsedState.visibleColumnKeys,
            allowedColumnKeySet,
          );

          if (validVisibleColumns.length > 0) {
            setVisibleColumnKeys(validVisibleColumns);
          }
        }

        if (Array.isArray(parsedState.columnOrderKeys)) {
          setColumnOrderKeys(
            readStoredColumnKeys(
              parsedState.columnOrderKeys,
              allowedColumnKeySet,
            ),
          );
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
      roleBudgets,
    };

    try {
      window.localStorage.setItem(
        AUCTION_STORAGE_KEY,
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
    const normalizedSearch = normalizeSearchText(nameSearch);

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
      const nome = getTextValue(player, "nome");
      const searchableText = normalizeSearchText(
        `${nome} ${team} ${ruolo}`,
      );

      return (
        (!roleFilter || ruolo === roleFilter) &&
        (!teamFilter || team === teamFilter) &&
        (!normalizedSearch ||
          searchableText.includes(normalizedSearch))
      );
    });

    return [...filteredPlayers].sort(
      (firstPlayer, secondPlayer) => {
        const firstValue =
          sortColumn === "giocatore"
            ? getTextValue(firstPlayer, "nome")
            : firstPlayer[sortColumn];
        const secondValue =
          sortColumn === "giocatore"
            ? getTextValue(secondPlayer, "nome")
            : secondPlayer[sortColumn];

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

    setNameSearch("");

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
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

  function getSortIndicator(columnName: string): string {
    if (sortColumn !== columnName) {
      return "";
    }

    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  return (
    <main className="fantawalter-page" style={pageStyle}>
      <style>{`
        .fantawalter-player-row td {
          background-color: var(--fw-table-row);
          color: var(--fw-text);
        }

        .fantawalter-player-row:nth-child(even) td {
          background-color: var(--fw-table-row-alt);
        }

        .fantawalter-player-row .fantawalter-actions-cell {
          background-color: var(--fw-table-row) !important;
        }

        .fantawalter-player-row:nth-child(even)
          .fantawalter-actions-cell {
          background-color: var(--fw-table-row-alt) !important;
        }

        .fantawalter-player-row:hover td {
          background-color: var(--fw-table-row-hover);
        }

        .fantawalter-player-row:hover
          .fantawalter-actions-cell {
          background-color: var(--fw-table-row-hover) !important;
        }

        .fantawalter-search-input::-webkit-search-cancel-button {
          cursor: pointer;
        }

        @media (max-width: 1100px) {
          .fantawalter-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .fantawalter-squad-panel {
            position: static !important;
            max-height: none !important;
          }
        }

        @media (max-width: 760px) {
          .fantawalter-filter-field {
            flex: 1 1 calc(50% - 8px) !important;
            min-width: 0 !important;
          }

          .fantawalter-search-field {
            flex-basis: 100% !important;
          }

          .fantawalter-filter-field select,
          .fantawalter-filter-field input {
            width: 100% !important;
            min-width: 0 !important;
          }

          .fantawalter-service-bar {
            flex-wrap: wrap !important;
          }

          .fantawalter-service-info {
            order: 3 !important;
            flex-basis: 100% !important;
            justify-content: flex-start !important;
          }
        }

        @media (max-width: 640px) {
          .fantawalter-page {
            padding: 8px !important;
          }

          .fantawalter-main-panel,
          .fantawalter-squad-panel {
            padding: 10px !important;
            border-radius: 8px !important;
          }

          .fantawalter-service-bar {
            align-items: center !important;
            padding: 8px !important;
          }

          .fantawalter-service-info {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 3px !important;
          }

          .fantawalter-service-divider {
            display: none !important;
          }

          .fantawalter-top-actions {
            margin-left: auto !important;
          }

          .fantawalter-filter-field {
            flex-basis: 100% !important;
          }

          .fantawalter-filter-bin {
            width: auto !important;
            margin-left: auto !important;
          }

          .fantawalter-role-filter {
            flex: 1 1 100% !important;
          }

        }
      `}</style>

      <section
        className="fantawalter-service-bar"
        style={serviceBarStyle}
      >
        <Link href="/configurazione" style={settingsLinkStyle}>
          <span aria-hidden="true">⚙️</span>
          <span>Configurazione</span>
        </Link>

        <div
          className="fantawalter-service-info"
          style={serviceInfoStyle}
        >
          <span>
            Giocatori disponibili: {" "}
            <strong>{availablePlayersCount}</strong>
          </span>

          <span
            className="fantawalter-service-divider"
            aria-hidden="true"
            style={serviceDividerStyle}
          >
            •
          </span>

          <span>
            Aggiornato: {" "}
            <strong>{formatLastUpdate(lastUpdate)}</strong>
          </span>
        </div>

        <div
          className="fantawalter-top-actions"
          style={topBarActionsStyle}
        >
          <PayPalSupportButton />
        </div>
      </section>

      <div className="fantawalter-layout" style={layoutStyle}>
        <section
          className="fantawalter-main-panel"
          style={containerStyle}
        >
          <div style={filtersStyle}>
            <div
              className="fantawalter-role-filter"
              style={roleFilterFieldStyle}
            >
              <span style={labelStyle}>Ruolo</span>

              <div
                role="group"
                aria-label="Filtra i giocatori per ruolo"
                style={roleFilterButtonsStyle}
              >
                <button
                  type="button"
                  aria-pressed={roleFilter === ""}
                  title="Tutti i ruoli"
                  onClick={() => setRoleFilter("")}
                  style={{
                    ...roleFilterButtonStyle,
                    ...allRolesFilterButtonStyle,
                    ...getRoleFilterButtonStyle(
                      null,
                      roleFilter === "",
                    ),
                  }}
                >
                  Tutti
                </button>

                {ROLE_ORDER.map((role) => {
                  const active = roleFilter === role;

                  return (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={active}
                      title={ROLE_PLURAL_LABELS[role]}
                      onClick={() => setRoleFilter(role)}
                      style={{
                        ...roleFilterButtonStyle,
                        ...getRoleFilterButtonStyle(
                          role,
                          active,
                        ),
                      }}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="fantawalter-filter-field">
              <span style={labelStyle}>Squadra</span>

              <select
                value={teamFilter}
                onChange={(event) =>
                  setTeamFilter(event.target.value)
                }
                style={{ ...controlStyle, minWidth: "150px" }}
              >
                <option value="">Tutte</option>

                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label className="fantawalter-filter-field fantawalter-search-field">
              <span style={labelStyle}>Cerca</span>

              <input
                ref={searchInputRef}
                className="fantawalter-search-input"
                type="search"
                list="fantawalter-player-names"
                value={nameSearch}
                placeholder="Nome o squadra..."
                autoComplete="off"
                onChange={(event) =>
                  setNameSearch(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setNameSearch("");
                  }
                }}
                style={{
                  ...controlStyle,
                  width: "100%",
                  minWidth: "250px",
                }}
              />

              <datalist id="fantawalter-player-names">
                {nameSuggestions.map((playerName) => (
                  <option key={playerName} value={playerName} />
                ))}
              </datalist>
            </label>

            <button
              className="fantawalter-filter-bin"
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

          <div style={tableWrapperStyle}>
            <table className="fantawalter-table" style={tableStyle}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...headerCellStyle,
                      ...actionsHeaderCellStyle,
                    }}
                    title="Aggiungi il giocatore alla rosa oppure spostalo nel cestino."
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
                            reorderColumn(
                              draggedColumnKey,
                              column.key,
                            );
                          }

                          setDraggedColumnKey(null);
                        }}
                        onDragEnd={() => setDraggedColumnKey(null)}
                        onClick={() => changeSorting(column.key)}
                        aria-sort={
                          sortable && sortColumn === column.key
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        title={getColumnHeaderTitle(column, sortable)}
                        style={{
                          ...headerCellStyle,
                          cursor: "grab",
                          opacity:
                            draggedColumnKey === column.key ? 0.55 : 1,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={columnDragHandleStyle}
                        >
                          ⋮⋮
                        </span>
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
                    <tr
                      key={rowKey}
                      className="fantawalter-player-row"
                    >
                      <td
                        className="fantawalter-actions-cell"
                        style={actionCellStyle}
                      >
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

                      {visibleColumns.map((column) => {
                        const isPlayerColumn =
                          column.key === "giocatore";

                        return (
                          <td
                            key={column.key}
                            onMouseEnter={
                              isPlayerColumn
                                ? (event) =>
                                    showPlayerTooltip(event, player)
                                : undefined
                            }
                            onMouseMove={
                              isPlayerColumn
                                ? updateTooltipPointer
                                : undefined
                            }
                            onMouseLeave={
                              isPlayerColumn
                                ? hidePlayerTooltip
                                : undefined
                            }
                            style={{
                              ...cellStyle,
                              ...(isPlayerColumn
                                ? playerColumnCellStyle
                                : {}),
                            }}
                          >
                            {isPlayerColumn ? (
                              <span style={playerIdentityStyle}>
                                <span
                                  aria-label={`Ruolo ${ruolo || "non disponibile"}`}
                                  title={`Ruolo ${ruolo || "-"}`}
                                  style={getPlayerRoleBadgeStyle(
                                    getPlayerRole(player),
                                  )}
                                >
                                  {ruolo || "-"}
                                </span>

                                <span style={playerTextStyle}>
                                  <span style={playerTeamStyle}>
                                    {getTextValue(player, "team") || "-"}
                                  </span>
                                  <strong style={playerNameStyle}>
                                    {getTextValue(player, "nome") || "-"}
                                  </strong>
                                </span>
                              </span>
                            ) : (
                              <PlayerCell
                                player={player}
                                columnName={column.key}
                                initialBudget={initialBudget}
                              />
                            )}
                          </td>
                        );
                      })}
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
  padding: "20px",
  background: "var(--fw-page-bg)",
  color: "var(--fw-text)",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
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
  padding: "18px",
  background: "var(--fw-panel-bg)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "12px",
  boxShadow: "var(--fw-shadow)",
};

const rightPanelStyle: CSSProperties = {
  position: "sticky",
  top: "20px",
  minWidth: 0,
  maxHeight: "calc(100vh - 40px)",
  overflowY: "auto",
  padding: "18px",
  background: "var(--fw-panel-bg)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "12px",
  boxShadow: "var(--fw-shadow)",
};

const serviceBarStyle: CSSProperties = {
  maxWidth: "1900px",
  minHeight: "46px",
  margin: "0 auto 12px",
  padding: "6px 8px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "10px",
  background: "var(--fw-panel-bg)",
  boxShadow: "var(--fw-shadow-soft)",
};

const serviceInfoStyle: CSSProperties = {
  minWidth: 0,
  flex: "1 1 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: "8px",
  color: "var(--fw-text-secondary)",
  fontSize: "0.88rem",
};

const serviceDividerStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
};

const settingsLinkStyle: CSSProperties = {
  minHeight: "36px",
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "0 11px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-heading)",
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
};

const topBarActionsStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
};

const roleFilterFieldStyle: CSSProperties = {
  minWidth: "270px",
};

const roleFilterButtonsStyle: CSSProperties = {
  minHeight: "36px",
  display: "flex",
  alignItems: "center",
  gap: "7px",
  padding: 0,
  background: "transparent",
};

const roleFilterButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "50%",
  fontSize: "0.82rem",
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
  transition:
    "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
};

const allRolesFilterButtonStyle: CSSProperties = {
  width: "auto",
  minWidth: "58px",
  padding: "0 11px",
  borderRadius: "999px",
  fontSize: "0.78rem",
};

const filterBinButtonStyle: CSSProperties = {
  position: "relative",
  minHeight: "36px",
  marginLeft: "auto",
  padding: "6px 11px",
  border: 0,
  borderRadius: "7px",
  background: "#7f8c8d",
  color: "var(--fw-table-head-text)",
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
  gap: "10px",
  alignItems: "end",
  padding: "10px",
  marginBottom: "10px",
  background: "var(--fw-panel-soft)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "8px",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "5px",
  fontWeight: 700,
};

const controlStyle: CSSProperties = {
  minHeight: "36px",
  padding: "6px 9px",
  border: "2px solid var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text)",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
  outline: "none",
  fontSize: "0.95rem",
};

const tableWrapperStyle: CSSProperties = {
  maxHeight: "68vh",
  overflow: "auto",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "8px",
  background: "var(--fw-panel-bg)",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "var(--fw-panel-bg)",
};

const headerCellStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  padding: "6px 7px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-table-head-border)",
  background: "var(--fw-table-head)",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
  userSelect: "none",
  transition: "opacity 0.15s ease",
};

const columnDragHandleStyle: CSSProperties = {
  display: "inline-block",
  marginRight: "5px",
  color: "var(--fw-text-muted)",
  fontSize: "0.78rem",
  letterSpacing: "-2px",
};

const cellStyle: CSSProperties = {
  padding: "3px 6px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-soft)",
  whiteSpace: "nowrap",
};

const playerColumnCellStyle: CSSProperties = {
  minWidth: "145px",
  cursor: "help",
};

const playerIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  lineHeight: 1.08,
};

const playerRoleBadgeStyle: CSSProperties = {
  width: "24px",
  height: "24px",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  color: "#ffffff",
  fontSize: "0.72rem",
  fontWeight: 900,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
};

const playerTextStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "1px",
};

const playerTeamStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
};

const playerNameStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.78rem",
};

const actionsHeaderCellStyle: CSSProperties = {
  left: 0,
  zIndex: 4,
  width: "60px",
  minWidth: "60px",
  textAlign: "center",
};

const actionCellStyle: CSSProperties = {
  ...cellStyle,
  position: "sticky",
  left: 0,
  zIndex: 1,
  width: "60px",
  minWidth: "60px",
  padding: "2px",
  background: "var(--fw-panel-bg)",
  boxShadow: "2px 0 4px rgba(15, 23, 42, 0.05)",
};

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
};

const buyIconButtonStyle: CSSProperties = {
  width: "25px",
  height: "24px",
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
  height: "24px",
  padding: 0,
  border: "1px solid var(--fw-border)",
  borderRadius: "5px",
  background: "var(--fw-panel-bg)",
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
  background: "var(--fw-panel-bg)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  paddingBottom: "10px",
  marginBottom: "10px",
  borderBottom: "1px solid var(--fw-border)",
};

const closeModalButtonStyle: CSSProperties = {
  padding: 0,
  border: 0,
  background: "transparent",
  color: "var(--fw-text-muted)",
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
  borderBottom: "1px solid var(--fw-border-soft)",
  color: "var(--fw-text-muted)",
  textDecoration: "line-through",
};

const deletedRoleBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  borderRadius: "4px",
  color: "var(--fw-text)",
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
