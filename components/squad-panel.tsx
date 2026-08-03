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
  getPlayerKey,
  getPlayerRole,
  sortSquadPlayers,
  type PlayerRole,
  type RoleLimits,
} from "@/lib/squad";

interface SquadPanelProps {
  purchasedPlayers: PlayerRow[];
  roleLimits: RoleLimits;
  onLimitChange: (
    role: PlayerRole,
    value: number,
  ) => void;
  onRemovePlayer: (
    player: PlayerRow,
  ) => void;
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

type AlertLevel =
  | "yellow"
  | "orange"
  | "red";

interface SquadAlert {
  id: string;
  level: AlertLevel;
  text: string;
  dismissible: boolean;
}

interface SquadAnalysis {
  roleStatistics: Record<
    PlayerRole,
    RoleStatistics
  >;
  totalStatistics: TotalStatistics;
  totalTeamCount: Record<string, number>;
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

function numericValue(
  value: unknown,
): number {
  return parseNumericValue(value) ?? 0;
}

function displayValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}

function normalizeText(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
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

  for (
    let index = 1;
    index <= 5;
    index += 1
  ) {
    const note = normalizeText(
      player[`nota_${index}`],
    );

    if (note === normalizedSearch) {
      return true;
    }
  }

  return false;
}

function calculateAverage(
  total: number,
  count: number,
): number {
  if (count === 0) {
    return 0;
  }

  return total / count;
}

function formatAverage(
  total: number,
  count: number,
): string {
  return calculateAverage(
    total,
    count,
  ).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getAverageColor(
  average: number,
): string {
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

  const totalTeamCount:
    Record<string, number> = {};

  /*
   * I portieri della stessa squadra vengono
   * conteggiati come un solo blocco nel totale,
   * come nella pagina originaria.
   */
  const goalkeeperTeams =
    new Set<string>();

  for (const player of players) {
    const role = getPlayerRole(player);

    if (!role) {
      continue;
    }

    const team = String(
      player.team ?? "",
    ).trim();

    const statistics =
      roleStatistics[role];

    statistics.count += 1;
    statistics.titolarita +=
      numericValue(
        player.titolarita,
      );
    statistics.affidabilita +=
      numericValue(
        player.affidabilita,
      );
    statistics.integrita +=
      numericValue(
        player.integrita,
      );
    statistics.fmvExp +=
      numericValue(
        player.fmv_exp,
      );

    if (team) {
      statistics.teams[team] =
        (
          statistics.teams[team] ??
          0
        ) + 1;
    }

    totalStatistics.count += 1;
    totalStatistics.titolarita +=
      numericValue(
        player.titolarita,
      );
    totalStatistics.affidabilita +=
      numericValue(
        player.affidabilita,
      );
    totalStatistics.integrita +=
      numericValue(
        player.integrita,
      );
    totalStatistics.fmvExp +=
      numericValue(
        player.fmv_exp,
      );

    if (!team) {
      continue;
    }

    if (role === "P") {
      if (
        !goalkeeperTeams.has(team)
      ) {
        totalTeamCount[team] =
          (
            totalTeamCount[team] ??
            0
          ) + 1;

        goalkeeperTeams.add(team);
      }
    } else {
      totalTeamCount[team] =
        (
          totalTeamCount[team] ??
          0
        ) + 1;
    }
  }

  const alerts: SquadAlert[] = [];

  for (const role of ROLE_ORDER) {
    const statistics =
      roleStatistics[role];

    if (statistics.count === 0) {
      continue;
    }

    const averageTitolarita =
      calculateAverage(
        statistics.titolarita,
        statistics.count,
      );

    const averageAffidabilita =
      calculateAverage(
        statistics.affidabilita,
        statistics.count,
      );

    const averageIntegrita =
      calculateAverage(
        statistics.integrita,
        statistics.count,
      );

    if (
      averageTitolarita < 3
    ) {
      alerts.push({
        id: `LOW_AVG_${role}_TIT`,
        level: "red",
        text:
          `Media TITOLARITÀ per i ${role} ` +
          `bassa: ${averageTitolarita.toFixed(2)}.`,
        dismissible: true,
      });
    }

    if (
      averageAffidabilita < 3
    ) {
      alerts.push({
        id: `LOW_AVG_${role}_AFF`,
        level: "red",
        text:
          `Media AFFIDABILITÀ per i ${role} ` +
          `bassa: ${averageAffidabilita.toFixed(2)}.`,
        dismissible: true,
      });
    }

    if (
      averageIntegrita < 3
    ) {
      alerts.push({
        id: `LOW_AVG_${role}_INT`,
        level: "red",
        text:
          `Media INTEGRITÀ per i ${role} ` +
          `bassa: ${averageIntegrita.toFixed(2)}.`,
        dismissible: true,
      });
    }

    if (role !== "P") {
      for (
        const [
          team,
          count,
        ] of Object.entries(
          statistics.teams,
        )
      ) {
        if (count >= 3) {
          alerts.push({
            id:
              `ROLE_TEAM_${role}_` +
              team,
            level: "red",
            text:
              `Hai ${count} giocatori del ` +
              `${team} nel ruolo ${role}.`,
            dismissible: true,
          });
        } else if (count === 2) {
          alerts.push({
            id:
              `ROLE_TEAM_${role}_` +
              team,
            level: "orange",
            text:
              `Hai ${count} giocatori del ` +
              `${team} nel ruolo ${role}.`,
            dismissible: true,
          });
        }
      }
    }
  }

  for (
    const [
      team,
      count,
    ] of Object.entries(
      totalTeamCount,
    )
  ) {
    if (count >= 5) {
      alerts.push({
        id: `TOTAL_TEAM_${team}`,
        level: "red",
        text:
          `Hai ${count} giocatori del ` +
          `${team} in rosa.`,
        dismissible: false,
      });
    } else if (count === 4) {
      alerts.push({
        id: `TOTAL_TEAM_${team}`,
        level: "orange",
        text:
          `Hai ${count} giocatori del ` +
          `${team} in rosa.`,
        dismissible: false,
      });
    } else if (count === 3) {
      alerts.push({
        id: `TOTAL_TEAM_${team}`,
        level: "yellow",
        text:
          `Hai ${count} giocatori del ` +
          `${team} in rosa.`,
        dismissible: false,
      });
    }
  }

  const coppaAfricaPlayers =
    players.filter((player) =>
      playerHasNote(
        player,
        "Coppa Africa",
      ),
    );

  const coppaAfricaCount =
    coppaAfricaPlayers.length;

  if (coppaAfricaCount >= 4) {
    alerts.push({
      id: "COPPA_AFRICA_TOTAL",
      level: "red",
      text:
        `Hai ${coppaAfricaCount} giocatori ` +
        `impegnati in Coppa d'Africa.`,
      dismissible: false,
    });
  } else if (
    coppaAfricaCount === 3
  ) {
    alerts.push({
      id: "COPPA_AFRICA_TOTAL",
      level: "orange",
      text:
        `Hai ${coppaAfricaCount} giocatori ` +
        `impegnati in Coppa d'Africa.`,
      dismissible: false,
    });
  } else if (
    coppaAfricaCount === 2
  ) {
    alerts.push({
      id: "COPPA_AFRICA_TOTAL",
      level: "yellow",
      text:
        `Hai ${coppaAfricaCount} giocatori ` +
        `impegnati in Coppa d'Africa.`,
      dismissible: false,
    });
  }

  const coppaAfricaByRole:
    Partial<
      Record<PlayerRole, number>
    > = {};

  for (
    const player of
      coppaAfricaPlayers
  ) {
    const role =
      getPlayerRole(player);

    if (!role) {
      continue;
    }

    coppaAfricaByRole[role] =
      (
        coppaAfricaByRole[role] ??
        0
      ) + 1;
  }

  for (
    const [
      role,
      count,
    ] of Object.entries(
      coppaAfricaByRole,
    )
  ) {
    if (
      typeof count === "number" &&
      count >= 2
    ) {
      alerts.push({
        id:
          `COPPA_AFRICA_ROLE_` +
          role,
        level: "orange",
        text:
          `Hai ${count} giocatori ` +
          `impegnati in Coppa d'Africa ` +
          `nel ruolo ${role}.`,
        dismissible: false,
      });
    }
  }

  return {
    roleStatistics,
    totalStatistics,
    totalTeamCount,
    alerts,
  };
}

function StatBars({
  value,
}: {
  value: unknown;
}) {
  const parsedValue =
    numericValue(value);

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
      {Array.from({
        length: barCount,
      }).map((_, index) => (
        <span
          key={index}
          style={{
            ...statBarStyle,
            background: color,
          }}
        />
      ))}
    </span>
  );
}

export default function SquadPanel({
  purchasedPlayers,
  roleLimits,
  onLimitChange,
  onRemovePlayer,
}: SquadPanelProps) {
  const [
    dismissedAlerts,
    setDismissedAlerts,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  const sortedPlayers = useMemo(
    () =>
      sortSquadPlayers(
        purchasedPlayers,
      ),
    [purchasedPlayers],
  );

  const analysis = useMemo(
    () =>
      buildSquadAnalysis(
        purchasedPlayers,
      ),
    [purchasedPlayers],
  );

  const roleCounts =
    useMemo(() => {
      const counts:
        Record<
          PlayerRole,
          number
        > = {
          P: 0,
          D: 0,
          C: 0,
          A: 0,
        };

      for (
        const player of
          purchasedPlayers
      ) {
        const role =
          getPlayerRole(player);

        if (role) {
          counts[role] += 1;
        }
      }

      return counts;
    }, [purchasedPlayers]);

  const visibleAlerts =
    analysis.alerts.filter(
      (alert) =>
        !dismissedAlerts.has(
          alert.id,
        ),
    );

  function dismissAlert(
    alertId: string,
  ): void {
    setDismissedAlerts(
      (currentAlerts) => {
        const nextAlerts =
          new Set(currentAlerts);

        nextAlerts.add(alertId);

        return nextAlerts;
      },
    );
  }

  const totalSlots =
    ROLE_ORDER.reduce(
      (total, role) =>
        total + roleLimits[role],
      0,
    );

  return (
    <>
      <h2 style={{ marginTop: 0 }}>
        La mia Rosa
      </h2>

      <p style={counterStyle}>
        Totale:{" "}
        {purchasedPlayers.length}
        {" | "}
        P: {roleCounts.P}/
        {roleLimits.P}
        {" | "}
        D: {roleCounts.D}/
        {roleLimits.D}
        {" | "}
        C: {roleCounts.C}/
        {roleLimits.C}
        {" | "}
        A: {roleCounts.A}/
        {roleLimits.A}
      </p>

      <div
        style={configurationStyle}
      >
        {ROLE_ORDER.map((role) => (
          <label key={role}>
            <span
              style={
                configurationLabelStyle
              }
            >
              {role}
            </span>

            <input
              type="number"
              min={0}
              step={1}
              value={
                roleLimits[role]
              }
              onChange={(event) => {
                const value =
                  event.currentTarget
                    .valueAsNumber;

                onLimitChange(
                  role,
                  Number.isFinite(
                    value,
                  )
                    ? Math.max(
                        0,
                        Math.trunc(
                          value,
                        ),
                      )
                    : 0,
                );
              }}
              style={limitInputStyle}
            />
          </label>
        ))}
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerStyle}>
                R
              </th>

              <th style={headerStyle}>
                Squadra
              </th>

              <th style={headerStyle}>
                Nome
              </th>

              <th
                style={headerStyle}
                title="Titolarità"
              >
                TIT
              </th>

              <th
                style={headerStyle}
                title="Affidabilità"
              >
                AFF
              </th>

              <th
                style={headerStyle}
                title="Integrità"
              >
                INT
              </th>

              <th
                style={headerStyle}
                title="Fanta media voto attesa"
              >
                FMV Exp
              </th>

              <th style={headerStyle}>
                Azione
              </th>
            </tr>
          </thead>

          <tbody>
            {sortedPlayers.map(
              (player) => {
                const role =
                  getPlayerRole(player);

                return (
                  <tr
                    key={getPlayerKey(
                      player,
                    )}
                  >
                    <td
                      style={{
                        ...cellStyle,
                        ...getRoleStyle(
                          role,
                        ),
                      }}
                    >
                      {role ?? "-"}
                    </td>

                    <td style={cellStyle}>
                      {displayValue(
                        player.team,
                      )}
                    </td>

                    <td style={cellStyle}>
                      {displayValue(
                        player.nome,
                      )}
                    </td>

                    <td style={cellStyle}>
                      <StatBars
                        value={
                          player.titolarita
                        }
                      />
                    </td>

                    <td style={cellStyle}>
                      <StatBars
                        value={
                          player.affidabilita
                        }
                      />
                    </td>

                    <td style={cellStyle}>
                      <StatBars
                        value={
                          player.integrita
                        }
                      />
                    </td>

                    <td style={cellStyle}>
                      {displayValue(
                        player.fmv_exp,
                      )}
                    </td>

                    <td style={cellStyle}>
                      <button
                        type="button"
                        onClick={() =>
                          onRemovePlayer(
                            player,
                          )
                        }
                        style={
                          removeButtonStyle
                        }
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                );
              },
            )}

            {sortedPlayers.length ===
              0 && (
              <tr>
                <td
                  colSpan={8}
                  style={emptyCellStyle}
                >
                  Nessun giocatore
                  acquistato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleAlerts.length > 0 && (
        <section style={alertsSectionStyle}>
          <h3>
            Avvisi strategici
          </h3>

          {visibleAlerts.map(
            (alert) => (
              <div
                key={alert.id}
                style={{
                  ...alertStyle,
                  ...getAlertStyle(
                    alert.level,
                  ),
                }}
              >
                <span>
                  {alert.level ===
                  "red"
                    ? "🔴 "
                    : alert.level ===
                        "orange"
                      ? "🟠 "
                      : "🟡 "}

                  {alert.text}
                </span>

                {alert.dismissible && (
                  <button
                    type="button"
                    title="Ignora avviso"
                    aria-label="Ignora avviso"
                    onClick={() =>
                      dismissAlert(
                        alert.id,
                      )
                    }
                    style={
                      dismissButtonStyle
                    }
                  >
                    ×
                  </button>
                )}
              </div>
            ),
          )}
        </section>
      )}

      {purchasedPlayers.length > 0 && (
        <section style={statisticsSectionStyle}>
          <h2>
            Statistiche Rosa
          </h2>

          <div style={statisticsGridStyle}>
            <StatisticsBlock
              title="Totale"
              count={
                analysis
                  .totalStatistics
                  .count
              }
              slotsRemaining={
                totalSlots -
                analysis
                  .totalStatistics
                  .count
              }
              titolarita={
                analysis
                  .totalStatistics
                  .titolarita
              }
              affidabilita={
                analysis
                  .totalStatistics
                  .affidabilita
              }
              integrita={
                analysis
                  .totalStatistics
                  .integrita
              }
              fmvExp={
                analysis
                  .totalStatistics
                  .fmvExp
              }
            />

            {ROLE_ORDER.map(
              (role) => {
                const statistics =
                  analysis
                    .roleStatistics[
                    role
                  ];

                if (
                  statistics.count ===
                  0
                ) {
                  return null;
                }

                return (
                  <StatisticsBlock
                    key={role}
                    title={role}
                    count={
                      statistics.count
                    }
                    slotsRemaining={
                      roleLimits[role] -
                      statistics.count
                    }
                    titolarita={
                      statistics.titolarita
                    }
                    affidabilita={
                      statistics.affidabilita
                    }
                    integrita={
                      statistics.integrita
                    }
                    fmvExp={
                      statistics.fmvExp
                    }
                    teams={
                      statistics.teams
                    }
                  />
                );
              },
            )}
          </div>
        </section>
      )}
    </>
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
  const averageTitolarita =
    calculateAverage(
      titolarita,
      count,
    );

  const averageAffidabilita =
    calculateAverage(
      affidabilita,
      count,
    );

  const averageIntegrita =
    calculateAverage(
      integrita,
      count,
    );

  const teamsText = teams
    ? Object.entries(teams)
        .sort(
          (
            [firstTeam],
            [secondTeam],
          ) =>
            firstTeam.localeCompare(
              secondTeam,
              "it",
            ),
        )
        .map(
          ([team, teamCount]) =>
            `${team}: ${teamCount}`,
        )
        .join(", ")
    : "";

  return (
    <details
      open
      style={statisticsBlockStyle}
    >
      <summary
        style={statisticsSummaryStyle}
      >
        {title} ({count})
      </summary>

      <div style={{ paddingTop: "8px" }}>
        {teamsText && (
          <p style={statisticLineStyle}>
            <strong>Squadre:</strong>{" "}
            {teamsText}
          </p>
        )}

        <p style={statisticLineStyle}>
          <strong>
            Slot rimanenti:
          </strong>{" "}
          {slotsRemaining}
        </p>

        <p style={statisticLineStyle}>
          <strong>
            Media TIT:
          </strong>{" "}
          <span
            style={{
              color:
                getAverageColor(
                  averageTitolarita,
                ),
              fontWeight: 700,
            }}
          >
            {formatAverage(
              titolarita,
              count,
            )}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>
            Media AFF:
          </strong>{" "}
          <span
            style={{
              color:
                getAverageColor(
                  averageAffidabilita,
                ),
              fontWeight: 700,
            }}
          >
            {formatAverage(
              affidabilita,
              count,
            )}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>
            Media INT:
          </strong>{" "}
          <span
            style={{
              color:
                getAverageColor(
                  averageIntegrita,
                ),
              fontWeight: 700,
            }}
          >
            {formatAverage(
              integrita,
              count,
            )}
          </span>
        </p>

        <p style={statisticLineStyle}>
          <strong>
            Media FMV Exp:
          </strong>{" "}
          {formatAverage(
            fmvExp,
            count,
          )}
        </p>
      </div>
    </details>
  );
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

const counterStyle: CSSProperties = {
  fontWeight: 700,
  color: "#2980b9",
};

const configurationStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  padding: "12px",
  marginBottom: "14px",
  background: "#f8f9fa",
  borderRadius: "8px",
};

const configurationLabelStyle: CSSProperties = {
  display: "inline-block",
  marginRight: "5px",
  fontWeight: 700,
};

const limitInputStyle: CSSProperties = {
  width: "48px",
  padding: "5px",
  textAlign: "center",
};

const tableWrapperStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #ddd",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const headerStyle: CSSProperties = {
  padding: "8px",
  border: "1px solid #ddd",
  background: "#34495e",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: CSSProperties = {
  padding: "7px",
  border: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const emptyCellStyle: CSSProperties = {
  padding: "24px",
  textAlign: "center",
};

const removeButtonStyle: CSSProperties = {
  padding: "5px 8px",
  border: 0,
  borderRadius: "5px",
  background: "#e74c3c",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const statBarsContainerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "2px",
};

const statBarStyle: CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "16px",
  borderRadius: "2px",
};

const alertsSectionStyle: CSSProperties = {
  marginTop: "18px",
};

const alertStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  padding: "9px 10px",
  marginBottom: "6px",
  borderLeft: "4px solid",
  borderRadius: "4px",
  fontSize: "0.88rem",
};

const dismissButtonStyle: CSSProperties = {
  flexShrink: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  color: "#777",
  fontSize: "1.3rem",
  lineHeight: 1,
  cursor: "pointer",
};

const statisticsSectionStyle: CSSProperties = {
  marginTop: "20px",
};

const statisticsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "10px",
};

const statisticsBlockStyle: CSSProperties = {
  padding: "10px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  background: "#fff",
};

const statisticsSummaryStyle: CSSProperties = {
  fontWeight: 700,
  cursor: "pointer",
};

const statisticLineStyle: CSSProperties = {
  margin: "5px 0",
  fontSize: "0.88rem",
};