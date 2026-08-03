"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";

import PlayerCell from "@/components/player-cell";
import PlayerTooltip from "@/components/player-tooltip";
import SquadPanel from "@/components/squad-panel";

import { parseNumericValue } from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";

import {
  DEFAULT_ROLE_LIMITS,
  getPlayerKey,
  getPlayerRole,
  type PlayerRole,
  type RoleLimits,
} from "@/lib/squad";

interface AuctionAssistantProps {
  initialPlayers: PlayerRow[];
  strategyColumns: string[];
}

interface ColumnDefinition {
  key: string;
  label: string;
}

type SortDirection = "asc" | "desc";

interface PersistedAuctionState {
  initialBudget?: unknown;
  purchasedPlayerKeys?: unknown;
  deletedPlayerKeys?: unknown;
  roleLimits?: unknown;
  visibleColumnKeys?: unknown;
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
  { key: "media_strategie", label: "Media strategie" },
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

export default function AuctionAssistant({
  initialPlayers,
  strategyColumns,
}: AuctionAssistantProps) {
  const [roleFilter, setRoleFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [initialBudget, setInitialBudget] = useState(500);

  const [purchasedPlayerKeys, setPurchasedPlayerKeys] =
    useState<string[]>([]);

  const [deletedPlayerKeys, setDeletedPlayerKeys] =
    useState<string[]>([]);

  const [isBinOpen, setIsBinOpen] = useState(false);

  const [roleLimits, setRoleLimits] = useState<RoleLimits>(
    () => ({ ...DEFAULT_ROLE_LIMITS }),
  );

  const [sortColumn, setSortColumn] =
    useState<string>("nome");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const [visibleColumnKeys, setVisibleColumnKeys] =
    useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

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
      allColumns.filter((column) =>
        visibleColumnKeys.includes(column.key),
      ),
    [allColumns, visibleColumnKeys],
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
      allColumns.map((column) => column.key),
    );
  }

  function restoreDefaultColumns(): void {
    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMNS);
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
    setInitialBudget(500);
    setRoleLimits({ ...DEFAULT_ROLE_LIMITS });
    setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMNS);
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

    setPurchasedPlayerKeys((currentKeys) => {
      if (currentKeys.includes(playerKey)) {
        return currentKeys;
      }

      return [...currentKeys, playerKey];
    });
  }

  function removePurchasedPlayer(player: PlayerRow): void {
    const playerKey = getPlayerKey(player);

    setPurchasedPlayerKeys((currentKeys) =>
      currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    );
  }

  function deletePlayer(player: PlayerRow): void {
    setHoveredPlayer(null);

    const playerKey = getPlayerKey(player);

    setPurchasedPlayerKeys((currentKeys) =>
      currentKeys.filter(
        (currentKey) => currentKey !== playerKey,
      ),
    );

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

  function getSortIndicator(columnName: string): string {
    if (sortColumn !== columnName) {
      return "";
    }

    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  return (
    <main style={pageStyle}>
      <div style={layoutStyle}>
        <section style={containerStyle}>
          <div style={titleRowStyle}>
            <h1 style={{ margin: 0 }}>Fantawalter</h1>

            <div style={titleActionsStyle}>
              <button
                type="button"
                onClick={() => {
                  setHoveredPlayer(null);
                  setIsBinOpen(true);
                }}
                style={binButtonStyle}
              >
                Cestino

                {deletedPlayers.length > 0 && (
                  <span style={binBadgeStyle}>
                    {deletedPlayers.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={resetAuction}
                style={resetAuctionButtonStyle}
              >
                Reimposta asta
              </button>
            </div>
          </div>

          <div style={filtersStyle}>
            <label>
              <span style={labelStyle}>Ruolo</span>

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                style={{ minWidth: "110px", padding: "8px" }}
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
                style={{ minWidth: "180px", padding: "8px" }}
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
                value={nameSearch}
                placeholder="Cerca un giocatore..."
                onChange={(event) =>
                  setNameSearch(event.target.value)
                }
                style={{ minWidth: "240px", padding: "8px" }}
              />
            </label>

            <label>
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
                style={{ width: "130px", padding: "8px" }}
              />
            </label>

            <button
              type="button"
              onClick={resetFilters}
              style={secondaryButtonStyle}
            >
              Azzera filtri
            </button>
          </div>

          <div style={columnsPanelStyle}>
            <div style={columnsPanelHeaderStyle}>
              <strong>Visibilità colonne</strong>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
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

            <div style={columnButtonsStyle}>
              {allColumns.map((column) => {
                const isVisible = visibleColumnKeys.includes(
                  column.key,
                );

                return (
                  <button
                    key={column.key}
                    type="button"
                    onClick={() => toggleColumn(column.key)}
                    style={{
                      ...columnButtonStyle,
                      background: isVisible
                        ? "#f1c40f"
                        : "#bdc3c7",
                      borderColor: isVisible
                        ? "#f39c12"
                        : "#95a5a6",
                      color: isVisible ? "#222" : "#555",
                    }}
                  >
                    {column.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={summaryStyle}>
            <span>
              Budget iniziale: <strong>{initialBudget} crediti</strong>
            </span>

            <span>
              Giocatori visualizzati: {" "}
              <strong>{displayedPlayers.length}</strong> su {" "}
              {availablePlayersCount} disponibili
            </span>

            <span>
              Giocatori acquistati: {" "}
              <strong>{purchasedPlayers.length}</strong>
            </span>

            <span>
              Giocatori eliminati: {" "}
              <strong>{deletedPlayers.length}</strong>
            </span>

            <span>
              Strategie rilevate: {" "}
              <strong>{strategyColumns.length}</strong>
            </span>

            <span>
              Ordinamento: {" "}
              <strong>
                {
                  allColumns.find(
                    (column) => column.key === sortColumn,
                  )?.label
                }{" "}
                {sortDirection === "asc"
                  ? "crescente"
                  : "decrescente"}
              </strong>
            </span>
          </div>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
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

                  <th style={headerCellStyle}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {displayedPlayers.map((player) => {
                  const ruolo = getTextValue(player, "ruolo");
                  const rowKey = getPlayerKey(player);

                  return (
                    <tr key={rowKey}>
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

                      <td style={cellStyle}>
                        <div style={actionButtonsStyle}>
                          <button
                            type="button"
                            onClick={() => deletePlayer(player)}
                            style={deleteButtonStyle}
                          >
                            Elimina
                          </button>

                          <button
                            type="button"
                            onClick={() => purchasePlayer(player)}
                            style={buyButtonStyle}
                          >
                            Acquista
                          </button>
                        </div>
                      </td>
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

        <aside style={rightPanelStyle}>
          <SquadPanel
            purchasedPlayers={purchasedPlayers}
            roleLimits={roleLimits}
            onLimitChange={changeRoleLimit}
            onRemovePlayer={removePurchasedPlayer}
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

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "16px",
};

const titleActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const binButtonStyle: CSSProperties = {
  position: "relative",
  padding: "8px 12px",
  border: 0,
  borderRadius: "5px",
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

const columnsPanelStyle: CSSProperties = {
  padding: "14px",
  marginBottom: "14px",
  background: "#fdfdfd",
  border: "1px solid #ddd",
  borderRadius: "8px",
};

const columnsPanelHeaderStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginBottom: "10px",
};

const columnButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const columnButtonStyle: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid",
  borderRadius: "5px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "9px 14px",
  border: 0,
  borderRadius: "5px",
  background: "#7f8c8d",
  color: "#fff",
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

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
};

const deleteButtonStyle: CSSProperties = {
  padding: "5px 9px",
  border: 0,
  borderRadius: "5px",
  background: "#e74c3c",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const buyButtonStyle: CSSProperties = {
  padding: "5px 9px",
  border: 0,
  borderRadius: "5px",
  background: "#f39c12",
  color: "#fff",
  fontWeight: 700,
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
