"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { parseNumericValue } from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";
import {
  ROLE_ORDER,
  ROLE_PLURAL_LABELS,
  getPlayerKey,
  getPlayerRole,
  sortSquadPlayers,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

interface SquadPanelProps {
  purchasedPlayers: PlayerRow[];
  roleLimits: RoleLimits;
  onRemovePlayer: (
    player: PlayerRow,
  ) => void;
  onDeletePlayer: (
    player: PlayerRow,
  ) => void;
  recordPurchasePrice: boolean;
  purchasePrices: Record<string, number>;
  initialBudget: number;
  roleBudgets: RoleBudgets;
}

interface RoleStatistics {
  count: number;
  titolarita: number;
  affidabilita: number;
  integrita: number;
  fmvExp: number;
  teams: Record<string, number>;
}

interface TotalStatistics {
  count: number;
  titolarita: number;
  affidabilita: number;
  integrita: number;
  fmvExp: number;
}

type AlertLevel = "yellow" | "orange" | "red";

interface SquadAlert {
  id: string;
  level: AlertLevel;
  text: string;
  dismissible: boolean;
}

interface SquadAnalysis {
  roleStatistics: Record<PlayerRole, RoleStatistics>;
  totalStatistics: TotalStatistics;
  alerts: SquadAlert[];
}

function createEmptyRoleStatistics():
  Record<PlayerRole, RoleStatistics> {
  return {
    P: {
      count: 0,
      titolarita: 0,
      affidabilita: 0,
      integrita: 0,
      fmvExp: 0,
      teams: {},
    },
    D: {
      count: 0,
      titolarita: 0,
      affidabilita: 0,
      integrita: 0,
      fmvExp: 0,
      teams: {},
    },
    C: {
      count: 0,
      titolarita: 0,
      affidabilita: 0,
      integrita: 0,
      fmvExp: 0,
      teams: {},
    },
    A: {
      count: 0,
      titolarita: 0,
      affidabilita: 0,
      integrita: 0,
      fmvExp: 0,
      teams: {},
    },
  };
}

function numericValue(value: unknown): number {
  return parseNumericValue(value) ?? 0;
}

function displayValue(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .toLocaleLowerCase("it");
}

function playerHasNote(
  player: PlayerRow,
  searchedNote: string,
): boolean {
  const normalizedSearch =
    searchedNote.toLocaleLowerCase("it");

  for (let index = 1; index <= 5; index += 1) {
    if (
      normalizeText(player[`nota_${index}`]) ===
      normalizedSearch
    ) {
      return true;
    }
  }

  return false;
}

function calculateAverage(
  total: number,
  count: number,
): number {
  return count > 0 ? total / count : 0;
}

function formatAverage(
  total: number,
  count: number,
): string {
  return calculateAverage(total, count).toLocaleString(
    "it-IT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

function getAverageColor(average: number): string {
  if (average >= 4) {
    return "#27ae60";
  }

  if (average >= 3) {
    return "#f39c12";
  }

  return "#c0392b";
}

function buildSquadAnalysis(
  players: PlayerRow[],
  recordPurchasePrice: boolean,
  purchasePrices: Record<string, number>,
  roleBudgets: RoleBudgets,
): SquadAnalysis {
  const roleStatistics =
    createEmptyRoleStatistics();

  const totalStatistics: TotalStatistics = {
    count: 0,
    titolarita: 0,
    affidabilita: 0,
    integrita: 0,
    fmvExp: 0,
  };

  const totalTeamCount: Record<string, number> = {};
  const goalkeeperTeams = new Set<string>();

  for (const player of players) {
    const role = getPlayerRole(player);

    if (!role) {
      continue;
    }

    const team = String(player.team ?? "").trim();
    const statistics = roleStatistics[role];

    statistics.count += 1;
    statistics.titolarita += numericValue(
      player.titolarita,
    );
    statistics.affidabilita += numericValue(
      player.affidabilita,
    );
    statistics.integrita += numericValue(
      player.integrita,
    );
    statistics.fmvExp += numericValue(player.fmv_exp);

    if (team) {
      statistics.teams[team] =
        (statistics.teams[team] ?? 0) + 1;
    }

    totalStatistics.count += 1;
    totalStatistics.titolarita += numericValue(
      player.titolarita,
    );
    totalStatistics.affidabilita += numericValue(
      player.affidabilita,
    );
    totalStatistics.integrita += numericValue(
      player.integrita,
    );
    totalStatistics.fmvExp += numericValue(
      player.fmv_exp,
    );

    if (!team) {
      continue;
    }

    if (role === "P") {
      if (!goalkeeperTeams.has(team)) {
        totalTeamCount[team] =
          (totalTeamCount[team] ?? 0) + 1;
        goalkeeperTeams.add(team);
      }
    } else {
      totalTeamCount[team] =
        (totalTeamCount[team] ?? 0) + 1;
    }
  }

  const alerts: SquadAlert[] = [];

  for (const role of ROLE_ORDER) {
    const statistics = roleStatistics[role];

    /*
     * Gli avvisi riferiti al singolo ruolo iniziano
     * soltanto dal secondo giocatore acquistato.
     */
    if (statistics.count < 2) {
      continue;
    }

    const averageTitolarita = calculateAverage(
      statistics.titolarita,
      statistics.count,
    );
    const averageAffidabilita = calculateAverage(
      statistics.affidabilita,
      statistics.count,
    );
    const averageIntegrita = calculateAverage(
      statistics.integrita,
      statistics.count,
    );

    if (averageTitolarita < 3) {
      alerts.push({
        id: `LOW_AVG_${role}_TIT`,
        level: "red",
        text:
          `Titolarità bassa nel ruolo ${role}: ` +
          `${averageTitolarita.toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}.`,
        dismissible: true,
      });
    }

    if (averageAffidabilita < 3) {
      alerts.push({
        id: `LOW_AVG_${role}_AFF`,
        level: "red",
        text:
          `Affidabilità bassa nel ruolo ${role}: ` +
          `${averageAffidabilita.toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}.`,
        dismissible: true,
      });
    }

    if (averageIntegrita < 3) {
      alerts.push({
        id: `LOW_AVG_${role}_INT`,
        level: "red",
        text:
          `Integrità bassa nel ruolo ${role}: ` +
          `${averageIntegrita.toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}.`,
        dismissible: true,
      });
    }

    if (role !== "P") {
      for (const [team, count] of Object.entries(
        statistics.teams,
      )) {
        if (count >= 3) {
          alerts.push({
            id: `ROLE_TEAM_${role}_${team}`,
            level: "red",
            text:
              `Hai ${count} giocatori del ${team} ` +
              `nel ruolo ${role}.`,
            dismissible: true,
          });
        } else if (count === 2) {
          alerts.push({
            id: `ROLE_TEAM_${role}_${team}`,
            level: "orange",
            text:
              `Hai ${count} giocatori del ${team} ` +
              `nel ruolo ${role}.`,
            dismissible: true,
          });
        }
      }
    }
  }

  /*
   * Gli avvisi riferiti all'intera rosa iniziano
   * soltanto dal quarto giocatore acquistato.
   */
  if (totalStatistics.count >= 4) {
    for (const [team, count] of Object.entries(
      totalTeamCount,
    )) {
      if (count >= 5) {
        alerts.push({
          id: `TOTAL_TEAM_${team}`,
          level: "red",
          text: `Hai ${count} giocatori del ${team} in rosa.`,
          dismissible: false,
        });
      } else if (count === 4) {
        alerts.push({
          id: `TOTAL_TEAM_${team}`,
          level: "orange",
          text: `Hai ${count} giocatori del ${team} in rosa.`,
          dismissible: false,
        });
      } else if (count === 3) {
        alerts.push({
          id: `TOTAL_TEAM_${team}`,
          level: "yellow",
          text: `Hai ${count} giocatori del ${team} in rosa.`,
          dismissible: false,
        });
      }
    }

    const coppaAfricaPlayers = players.filter((player) =>
      playerHasNote(player, "Coppa Africa"),
    );
    const coppaAfricaCount = coppaAfricaPlayers.length;

    if (coppaAfricaCount >= 4) {
      alerts.push({
        id: "COPPA_AFRICA_TOTAL",
        level: "red",
        text:
          `Hai ${coppaAfricaCount} giocatori impegnati ` +
          `in Coppa d'Africa.`,
        dismissible: false,
      });
    } else if (coppaAfricaCount === 3) {
      alerts.push({
        id: "COPPA_AFRICA_TOTAL",
        level: "orange",
        text:
          `Hai ${coppaAfricaCount} giocatori impegnati ` +
          `in Coppa d'Africa.`,
        dismissible: false,
      });
    } else if (coppaAfricaCount === 2) {
      alerts.push({
        id: "COPPA_AFRICA_TOTAL",
        level: "yellow",
        text:
          `Hai ${coppaAfricaCount} giocatori impegnati ` +
          `in Coppa d'Africa.`,
        dismissible: false,
      });
    }
  }

  const coppaAfricaByRole:
    Partial<Record<PlayerRole, number>> = {};

  for (const player of players) {
    if (!playerHasNote(player, "Coppa Africa")) {
      continue;
    }

    const role = getPlayerRole(player);

    if (role) {
      coppaAfricaByRole[role] =
        (coppaAfricaByRole[role] ?? 0) + 1;
    }
  }

  for (const [role, count] of Object.entries(
    coppaAfricaByRole,
  )) {
    if (typeof count === "number" && count >= 2) {
      alerts.push({
        id: `COPPA_AFRICA_ROLE_${role}`,
        level: "orange",
        text:
          `Hai ${count} giocatori impegnati in ` +
          `Coppa d'Africa nel ruolo ${role}.`,
        dismissible: false,
      });
    }
  }

  if (recordPurchasePrice) {
    for (const role of ROLE_ORDER) {
      const statistics = roleStatistics[role];
      const plannedBudget = roleBudgets[role];

      /*
       * Anche gli avvisi economici per ruolo iniziano dal
       * secondo giocatore acquistato nel ruolo.
       */
      if (statistics.count < 2 || plannedBudget <= 0) {
        continue;
      }

      const roleSpent = players.reduce((total, player) => {
        if (getPlayerRole(player) !== role) {
          return total;
        }

        return total + (purchasePrices[getPlayerKey(player)] ?? 0);
      }, 0);

      if (roleSpent > plannedBudget) {
        const overrun = roleSpent - plannedBudget;
        const roleLabel = ROLE_PLURAL_LABELS[role];

        alerts.push({
          id: `ROLE_BUDGET_${role}`,
          level: "red",
          text:
            `La spesa per i ${roleLabel} è di ${roleSpent} crediti: ` +
            `${overrun} oltre il budget previsto di ${plannedBudget} crediti.`,
          dismissible: false,
        });
      }
    }
  }

  return {
    roleStatistics,
    totalStatistics,
    alerts,
  };
}

function StatBars({ value }: { value: unknown }) {
  const parsedValue = numericValue(value);
  const barCount = Math.max(
    0,
    Math.trunc(parsedValue),
  );

  if (barCount < 1) {
    return <span>-</span>;
  }

  const color =
    barCount >= 4
      ? "#2ecc71"
      : barCount === 3
        ? "#f39c12"
        : "#e74c3c";

  return (
    <span style={statBarsContainerStyle}>
      {Array.from({ length: barCount }).map(
        (_, index) => (
          <span
            key={index}
            style={{
              ...statBarStyle,
              background: color,
            }}
          />
        ),
      )}
    </span>
  );
}

export default function SquadPanel({
  purchasedPlayers,
  roleLimits,
  onRemovePlayer,
  onDeletePlayer,
  recordPurchasePrice,
  purchasePrices,
  initialBudget,
  roleBudgets,
}: SquadPanelProps) {
  const [dismissedAlerts, setDismissedAlerts] =
    useState<Set<string>>(() => new Set());

  const sortedPlayers = useMemo(
    () => sortSquadPlayers(purchasedPlayers),
    [purchasedPlayers],
  );

  const analysis = useMemo(
    () =>
      buildSquadAnalysis(
        purchasedPlayers,
        recordPurchasePrice,
        purchasePrices,
        roleBudgets,
      ),
    [
      purchasedPlayers,
      recordPurchasePrice,
      purchasePrices,
      roleBudgets,
    ],
  );

  const roleCounts = useMemo(() => {
    const counts: Record<PlayerRole, number> = {
      P: 0,
      D: 0,
      C: 0,
      A: 0,
    };

    for (const player of purchasedPlayers) {
      const role = getPlayerRole(player);

      if (role) {
        counts[role] += 1;
      }
    }

    return counts;
  }, [purchasedPlayers]);

  const visibleAlerts = analysis.alerts.filter(
    (alert) => !dismissedAlerts.has(alert.id),
  );

  function dismissAlert(alertId: string): void {
    setDismissedAlerts((currentAlerts) => {
      const nextAlerts = new Set(currentAlerts);
      nextAlerts.add(alertId);
      return nextAlerts;
    });
  }

  const totalSlots = ROLE_ORDER.reduce(
    (total, role) => total + roleLimits[role],
    0,
  );

  const totalSpent = purchasedPlayers.reduce(
    (total, player) =>
      total + (purchasePrices[getPlayerKey(player)] ?? 0),
    0,
  );

  const remainingBudget = initialBudget - totalSpent;

  return (
    <section
      className="fantawalter-squad-root"
      style={squadRootStyle}
    >
      <style>{`
        .fantawalter-squad-table tbody tr > td {
          transition:
            box-shadow 0.15s ease,
            background-color 0.15s ease;
        }

        .fantawalter-squad-table tbody tr:nth-child(even) > td {
          box-shadow: inset 0 0 0 9999px rgba(44, 62, 80, 0.025);
        }

        .fantawalter-squad-table tbody tr:hover > td {
          box-shadow: inset 0 0 0 9999px rgba(41, 128, 185, 0.085);
        }

        @media (max-width: 640px) {
          .fantawalter-role-counters {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .fantawalter-squad-table-wrapper {
            max-height: none !important;
          }
        }
      `}</style>

      <div style={squadTitleContainerStyle}>
        <h2 style={squadTitleStyle}>La tua rosa</h2>
        <span style={squadTitleBadgeStyle}>
          {purchasedPlayers.length}/{totalSlots}
        </span>
      </div>

      <div
        className="fantawalter-role-counters"
        style={roleCountersStyle}
        aria-label="Composizione della rosa per ruolo"
      >
        {ROLE_ORDER.map((role) => (
          <div
            key={role}
            style={{
              ...roleCounterCardStyle,
              ...getRoleCounterStyle(role),
            }}
          >
            <span style={roleCounterLabelStyle}>
              {role} · {ROLE_PLURAL_LABELS[role]}
            </span>

            <strong style={roleCounterValueStyle}>
              {roleCounts[role]}/{roleLimits[role]}
            </strong>
          </div>
        ))}
      </div>

      {recordPurchasePrice && (
        <div style={purchaseBudgetSummaryStyle}>
          <span>
            Speso: <strong>{totalSpent}</strong>
          </span>

          <span>
            Residuo:{" "}
            <strong
              style={{
                color:
                  remainingBudget < 0
                    ? "#c0392b"
                    : "#2471a3",
              }}
            >
              {remainingBudget}
            </strong>
          </span>
        </div>
      )}

      <div
        className="fantawalter-squad-table-wrapper"
        style={tableWrapperStyle}
      >
        <table
          className="fantawalter-squad-table"
          style={tableStyle}
        >
          <thead>
            <tr>
              <th
                style={{
                  ...headerStyle,
                  ...actionsHeaderStyle,
                }}
              >
                Azioni
              </th>
              <th style={headerStyle}>R</th>
              <th style={headerStyle}>Squadra</th>
              <th style={headerStyle}>Nome</th>
              <th style={headerStyle} title="Titolarità">
                TIT
              </th>
              <th style={headerStyle} title="Affidabilità">
                AFF
              </th>
              <th style={headerStyle} title="Integrità">
                INT
              </th>
              <th
                style={headerStyle}
                title="Fanta media voto attesa"
              >
                FMV Exp
              </th>

              {recordPurchasePrice && (
                <th style={headerStyle}>Prezzo</th>
              )}
            </tr>
          </thead>

          <tbody>
            {sortedPlayers.map((player) => {
              const role = getPlayerRole(player);

              return (
                <tr key={getPlayerKey(player)}>
                  <td style={actionsCellStyle}>
                    <div style={rowActionsStyle}>
                      <button
                        type="button"
                        aria-label="Riporta il giocatore nella lista"
                        title="Riporta nella lista dei giocatori disponibili"
                        onClick={() => onRemovePlayer(player)}
                        style={returnToListButtonStyle}
                      >
                        ↩
                      </button>

                      <button
                        type="button"
                        aria-label="Sposta il giocatore nel cestino"
                        title="Sposta nel cestino"
                        onClick={() => onDeletePlayer(player)}
                        style={moveToBinButtonStyle}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>

                  <td
                    style={{
                      ...cellStyle,
                      ...getRoleStyle(role),
                    }}
                  >
                    {role ?? "-"}
                  </td>
                  <td style={cellStyle}>
                    {displayValue(player.team)}
                  </td>
                  <td style={cellStyle}>
                    {displayValue(player.nome)}
                  </td>
                  <td style={cellStyle}>
                    <StatBars value={player.titolarita} />
                  </td>
                  <td style={cellStyle}>
                    <StatBars value={player.affidabilita} />
                  </td>
                  <td style={cellStyle}>
                    <StatBars value={player.integrita} />
                  </td>
                  <td style={cellStyle}>
                    {displayValue(player.fmv_exp)}
                  </td>

                  {recordPurchasePrice && (
                    <td style={priceCellStyle}>
                      {purchasePrices[getPlayerKey(player)] ?? "-"}
                    </td>
                  )}
                </tr>
              );
            })}

            {sortedPlayers.length === 0 && (
              <tr>
                <td
                  colSpan={recordPurchasePrice ? 9 : 8}
                  style={emptyCellStyle}
                >
                  Nessun giocatore acquistato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleAlerts.length > 0 && (
        <section style={alertsSectionStyle}>
          <div style={sectionTitleRowStyle}>
            <h3 style={sectionTitleStyle}>Avvisi strategici</h3>
            <span style={sectionCountBadgeStyle}>
              {visibleAlerts.length}
            </span>
          </div>

          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                ...alertStyle,
                ...getAlertStyle(alert.level),
              }}
            >
              <span>
                {alert.level === "red"
                  ? "🔴 "
                  : alert.level === "orange"
                    ? "🟠 "
                    : "🟡 "}
                {alert.text}
              </span>

              {alert.dismissible && (
                <button
                  type="button"
                  title="Ignora avviso"
                  aria-label="Ignora avviso"
                  onClick={() => dismissAlert(alert.id)}
                  style={dismissButtonStyle}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {purchasedPlayers.length > 0 && (
        <section style={statisticsSectionStyle}>
          <div style={sectionTitleRowStyle}>
            <h2 style={sectionTitleStyle}>Statistiche rosa</h2>
          </div>

          <div style={statisticsGridStyle}>
            <StatisticsBlock
              title="Totale"
              count={analysis.totalStatistics.count}
              slotsRemaining={
                totalSlots - analysis.totalStatistics.count
              }
              titolarita={
                analysis.totalStatistics.titolarita
              }
              affidabilita={
                analysis.totalStatistics.affidabilita
              }
              integrita={analysis.totalStatistics.integrita}
              fmvExp={analysis.totalStatistics.fmvExp}
            />

            {ROLE_ORDER.map((role) => {
              const statistics =
                analysis.roleStatistics[role];

              if (statistics.count === 0) {
                return null;
              }

              return (
                <StatisticsBlock
                  key={role}
                  title={role}
                  count={statistics.count}
                  slotsRemaining={
                    roleLimits[role] - statistics.count
                  }
                  titolarita={statistics.titolarita}
                  affidabilita={statistics.affidabilita}
                  integrita={statistics.integrita}
                  fmvExp={statistics.fmvExp}
                  teams={statistics.teams}
                />
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

interface StatisticsBlockProps {
  title: string;
  count: number;
  slotsRemaining: number;
  titolarita: number;
  affidabilita: number;
  integrita: number;
  fmvExp: number;
  teams?: Record<string, number>;
}

function StatisticsBlock({
  title,
  count,
  slotsRemaining,
  titolarita,
  affidabilita,
  integrita,
  fmvExp,
  teams,
}: StatisticsBlockProps) {
  const averageTitolarita = calculateAverage(
    titolarita,
    count,
  );
  const averageAffidabilita = calculateAverage(
    affidabilita,
    count,
  );
  const averageIntegrita = calculateAverage(
    integrita,
    count,
  );

  const teamsText = teams
    ? Object.entries(teams)
        .sort(([firstTeam], [secondTeam]) =>
          firstTeam.localeCompare(secondTeam, "it"),
        )
        .map(
          ([team, teamCount]) =>
            `${team}: ${teamCount}`,
        )
        .join(", ")
    : "";

  return (
    <details
      open={title === "Totale"}
      style={statisticsBlockStyle}
    >
      <summary style={statisticsSummaryStyle}>
        {title} ({count})
      </summary>

      <div style={{ paddingTop: "8px" }}>
        {teamsText && (
          <p style={statisticLineStyle}>
            <strong>Squadre:</strong> {teamsText}
          </p>
        )}

        <p style={statisticLineStyle}>
          <strong>Slot rimanenti:</strong>{" "}
          {slotsRemaining}
        </p>

        <p style={statisticLineStyle}>
          <strong>Media TIT:</strong>{" "}
          <span
            style={{
              color: getAverageColor(averageTitolarita),
              fontWeight: 700,
            }}
          >
            {formatAverage(titolarita, count)}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>Media AFF:</strong>{" "}
          <span
            style={{
              color: getAverageColor(averageAffidabilita),
              fontWeight: 700,
            }}
          >
            {formatAverage(affidabilita, count)}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>Media INT:</strong>{" "}
          <span
            style={{
              color: getAverageColor(averageIntegrita),
              fontWeight: 700,
            }}
          >
            {formatAverage(integrita, count)}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>Media FMV Exp:</strong>{" "}
          {formatAverage(fmvExp, count)}
        </p>
      </div>
    </details>
  );
}

function getRoleCounterStyle(
  role: PlayerRole,
): CSSProperties {
  switch (role) {
    case "P":
      return {
        borderColor: "#f0c27b",
        background: "#fff8ed",
      };
    case "D":
      return {
        borderColor: "#9fd4a7",
        background: "#f1faf2",
      };
    case "C":
      return {
        borderColor: "#8fcce6",
        background: "#f0f9fd",
      };
    case "A":
      return {
        borderColor: "#e8a2aa",
        background: "#fff4f5",
      };
  }
}

function getRoleStyle(
  role: PlayerRole | null,
): CSSProperties {
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

function getAlertStyle(
  level: AlertLevel,
): CSSProperties {
  switch (level) {
    case "red":
      return {
        background: "#ffebee",
        borderLeftColor: "#d32f2f",
      };
    case "orange":
      return {
        background: "#fff3e0",
        borderLeftColor: "#f57c00",
      };
    case "yellow":
      return {
        background: "#fffde7",
        borderLeftColor: "#fbc02d",
      };
  }
}

const squadRootStyle: CSSProperties = {
  minWidth: 0,
};

const squadTitleContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "12px 14px",
  marginBottom: "10px",
  borderRadius: "9px",
  background: "linear-gradient(135deg, #263746, #3f5870)",
  color: "#fff",
  boxShadow: "0 4px 12px rgba(38, 55, 70, 0.18)",
};

const squadTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.18rem",
  letterSpacing: "0.01em",
};

const squadTitleBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "56px",
  padding: "5px 9px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.28)",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.14)",
  fontWeight: 800,
};

const roleCountersStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "7px",
  marginBottom: "12px",
};

const roleCounterCardStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "8px 9px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "7px",
};

const roleCounterLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "#4d5d6c",
  fontSize: "0.74rem",
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleCounterValueStyle: CSSProperties = {
  flexShrink: 0,
  color: "#243746",
  fontSize: "0.88rem",
};

const purchaseBudgetSummaryStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "10px 16px",
  padding: "9px 11px",
  marginBottom: "12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#d6e4ef",
  borderRadius: "7px",
  background: "#f4f9fd",
  color: "#2c3e50",
  fontSize: "0.9rem",
};

const priceCellStyle: CSSProperties = {
  padding: "8px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "#dfe5ea",
  background: "#fff",
  whiteSpace: "nowrap",
  textAlign: "right",
  fontWeight: 700,
};

const tableWrapperStyle: CSSProperties = {
  maxHeight: "52vh",
  overflow: "auto",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#d7dee5",
  borderRadius: "8px",
  background: "#fff",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "760px",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "#fff",
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  padding: "9px 8px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "#52697d",
  background: "#34495e",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 5px rgba(0,0,0,0.10)",
};

const actionsHeaderStyle: CSSProperties = {
  left: 0,
  zIndex: 5,
  minWidth: "76px",
  textAlign: "center",
};

const cellStyle: CSSProperties = {
  padding: "8px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "#dfe5ea",
  background: "#fff",
  whiteSpace: "nowrap",
};

const actionsCellStyle: CSSProperties = {
  ...cellStyle,
  position: "sticky",
  left: 0,
  zIndex: 2,
  width: "76px",
  minWidth: "76px",
  padding: "5px",
  background: "#fff",
  boxShadow: "2px 0 4px rgba(44, 62, 80, 0.06)",
};

const emptyCellStyle: CSSProperties = {
  padding: "28px",
  color: "#6b7b88",
  textAlign: "center",
};

const rowActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
};

const returnToListButtonStyle: CSSProperties = {
  width: "30px",
  height: "29px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#7fb9df",
  borderRadius: "5px",
  background: "#eaf5fc",
  color: "#2471a3",
  fontSize: "1rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};

const moveToBinButtonStyle: CSSProperties = {
  width: "30px",
  height: "29px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#e0b4b4",
  borderRadius: "5px",
  background: "#fff5f5",
  color: "#c0392b",
  fontSize: "0.82rem",
  lineHeight: 1,
  cursor: "pointer",
};

const statBarsContainerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "2px",
};

const statBarStyle: CSSProperties = {
  display: "inline-block",
  width: "7px",
  height: "15px",
  borderRadius: "2px",
};

const alertsSectionStyle: CSSProperties = {
  marginTop: "18px",
};

const sectionTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "9px",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#2c3e50",
  fontSize: "1rem",
};

const sectionCountBadgeStyle: CSSProperties = {
  minWidth: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 6px",
  borderRadius: "999px",
  background: "#eef2f5",
  color: "#4d5d6c",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const alertStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px",
  padding: "9px 10px",
  marginBottom: "6px",
  borderWidth: "1px 1px 1px 4px",
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: "6px",
  fontSize: "0.86rem",
  lineHeight: 1.35,
};

const dismissButtonStyle: CSSProperties = {
  flexShrink: 0,
  width: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: 0,
  borderRadius: "4px",
  background: "rgba(255,255,255,0.55)",
  color: "#66737f",
  fontSize: "1.15rem",
  lineHeight: 1,
  cursor: "pointer",
};

const statisticsSectionStyle: CSSProperties = {
  marginTop: "20px",
};

const statisticsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(185px, 1fr))",
  gap: "9px",
};

const statisticsBlockStyle: CSSProperties = {
  padding: "10px 11px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#dfe5ea",
  borderRadius: "8px",
  background: "#fff",
  boxShadow: "0 2px 6px rgba(44, 62, 80, 0.05)",
};

const statisticsSummaryStyle: CSSProperties = {
  color: "#2c3e50",
  fontWeight: 800,
  cursor: "pointer",
};

const statisticLineStyle: CSSProperties = {
  margin: "5px 0",
  color: "#4d5d6c",
  fontSize: "0.86rem",
};
