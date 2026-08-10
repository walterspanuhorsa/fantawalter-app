// Versione 1.7
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import { parseNumericValue } from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";
import type { PlayerMode } from "@/lib/auction-settings";
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
  playerMode: PlayerMode;
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


type MantraDepartment = "P" | "D" | "C" | "A";

const MANTRA_DEPARTMENT_ROLES: Record<
  MantraDepartment,
  readonly string[]
> = {
  P: ["Por"],
  D: ["Ds", "Dc", "B", "Dd"],
  C: ["E", "M", "C"],
  A: ["W", "T", "A", "Pc"],
};

const MANTRA_DEPARTMENT_LABELS: Record<
  MantraDepartment,
  string
> = {
  P: "portieri",
  D: "difensivi",
  C: "centrocampisti",
  A: "offensivi",
};

const MANTRA_ROLE_ORDER = [
  "Por",
  "Ds",
  "Dc",
  "B",
  "Dd",
  "E",
  "M",
  "C",
  "W",
  "T",
  "A",
  "Pc",
] as const;

type MantraDisplayRole =
  (typeof MANTRA_ROLE_ORDER)[number];

const MANTRA_ROLE_COLORS: Record<
  MantraDisplayRole,
  string
> = {
  Por: "#d08617",
  Ds: "#158e4f",
  Dc: "#158e4f",
  B: "#158e4f",
  Dd: "#158e4f",
  E: "#2b90e8",
  M: "#2b90e8",
  C: "#2b90e8",
  W: "#5c2be8",
  T: "#5c2be8",
  A: "#a12d25",
  Pc: "#a12d25",
};

function getOrderedMantraRoles(
  player: PlayerRow,
): MantraDisplayRole[] {
  const playerRoles = new Set(
    getMantraRoles(player).map((role) =>
      role.toLocaleLowerCase("it"),
    ),
  );

  return MANTRA_ROLE_ORDER.filter((role) =>
    playerRoles.has(role.toLocaleLowerCase("it")),
  );
}

function getMantraRoles(player: PlayerRow): string[] {
  return String(player.ruolo_mantra ?? "")
    .split(";")
    .map((role) => role.trim())
    .filter(Boolean);
}

function getMantraDepartments(
  player: PlayerRow,
): MantraDepartment[] {
  const roles = new Set(getMantraRoles(player));

  return (["P", "D", "C", "A"] as MantraDepartment[]).filter(
    (department) =>
      MANTRA_DEPARTMENT_ROLES[department].some((role) =>
        roles.has(role),
      ),
  );
}

function playerBelongsToMantraDepartment(
  player: PlayerRow,
  department: MantraDepartment,
): boolean {
  return getMantraDepartments(player).includes(department);
}

function countMantraRoleCoverage(
  players: PlayerRow[],
  department: MantraDepartment,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const role of MANTRA_DEPARTMENT_ROLES[department]) {
    counts[role] = 0;
  }

  for (const player of players) {
    const playerRoles = new Set(getMantraRoles(player));

    for (const role of MANTRA_DEPARTMENT_ROLES[department]) {
      if (playerRoles.has(role)) {
        counts[role] += 1;
      }
    }
  }

  return counts;
}

function getMantraDepartmentPlayers(
  players: PlayerRow[],
  department: MantraDepartment,
): PlayerRow[] {
  return players.filter((player) =>
    playerBelongsToMantraDepartment(player, department),
  );
}

function isMantraMultiRole(player: PlayerRow): boolean {
  return getMantraRoles(player).length > 1;
}


interface MantraModulePosition {
  label: string;
  acceptedRoles: readonly string[];
}

interface MantraModuleDefinition {
  name: string;
  positions: readonly MantraModulePosition[];
}

/*
 * I moduli vengono usati solo come riepilogo della copertura della rosa.
 * Per le posizioni con ruoli alternativi il numero rappresenta i giocatori
 * che possono ricoprire almeno uno dei ruoli indicati.
 */
const MANTRA_MODULE_PREFERENCES_KEY = "fantaconsigliere-mantra-modules-v1";

const MANTRA_MODULES: readonly MantraModuleDefinition[] = [
  {
    name: "3-4-3",
    positions: [
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "W/A", acceptedRoles: ["W", "A"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
      { label: "W/A", acceptedRoles: ["W", "A"] },
    ],
  },
  {
    name: "3-4-1-2",
    positions: [
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "T", acceptedRoles: ["T"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
    ],
  },
  {
    name: "3-4-2-1",
    positions: [
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "E", acceptedRoles: ["E"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
    ],
  },
  {
    name: "3-5-2",
    positions: [
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M", acceptedRoles: ["M"] },
      { label: "C", acceptedRoles: ["C"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
    ],
  },
  {
    name: "3-5-1-1",
    positions: [
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc/B", acceptedRoles: ["Dc", "B"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M", acceptedRoles: ["M"] },
      { label: "C", acceptedRoles: ["C"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
    ],
  },
  {
    name: "4-3-3",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "C", acceptedRoles: ["C"] },
      { label: "W/A", acceptedRoles: ["W", "A"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
      { label: "W/A", acceptedRoles: ["W", "A"] },
    ],
  },
  {
    name: "4-3-1-2",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "C", acceptedRoles: ["C"] },
      { label: "T", acceptedRoles: ["T"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
    ],
  },
  {
    name: "4-3-2-1",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "C", acceptedRoles: ["C"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
    ],
  },
  {
    name: "4-4-2",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
      { label: "A/Pc", acceptedRoles: ["A", "Pc"] },
    ],
  },
  {
    name: "4-1-4-1",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "M", acceptedRoles: ["M"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "C/T", acceptedRoles: ["C", "T"] },
      { label: "C/T", acceptedRoles: ["C", "T"] },
      { label: "E/W", acceptedRoles: ["E", "W"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
    ],
  },
  {
    name: "4-2-3-1",
    positions: [
      { label: "Dd/B", acceptedRoles: ["Dd", "B"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Dc", acceptedRoles: ["Dc"] },
      { label: "Ds/B", acceptedRoles: ["Ds", "B"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "M/C", acceptedRoles: ["M", "C"] },
      { label: "W/T", acceptedRoles: ["W", "T"] },
      { label: "T/A", acceptedRoles: ["T", "A"] },
      { label: "W/T", acceptedRoles: ["W", "T"] },
      { label: "Pc", acceptedRoles: ["Pc"] },
    ],
  },
];

function getPlayersForMantraPosition(
  players: PlayerRow[],
  acceptedRoles: readonly string[],
): PlayerRow[] {
  return players.filter((player) => {
    const roles = getMantraRoles(player);

    if (roles.includes("Por")) {
      return false;
    }

    return acceptedRoles.some((role) =>
      roles.includes(role),
    );
  });
}

function getMantraCoverageCountStyle(
  count: number,
): CSSProperties {
  if (count === 0) {
    return {
      background: "#fde2e2",
      color: "#a12d25",
      borderColor: "#e9a8a3",
    };
  }

  if (count === 1) {
    return {
      background: "#fff0d8",
      color: "#9a6700",
      borderColor: "#efc46f",
    };
  }

  if (count === 2) {
    return {
      background: "#fff8cf",
      color: "#7a6500",
      borderColor: "#e5d56d",
    };
  }

  return {
    background: "#dff3e7",
    color: "#166534",
    borderColor: "#9fd2b3",
  };
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
  playerMode: PlayerMode,
  roleLimits: RoleLimits,
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

    if (playerMode === "classic" && role !== "P") {
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


  if (playerMode === "mantra") {
    /*
     * MANTRA - concentrazione per macro-ruolo.
     *
     * Un giocatore multiruolo può appartenere a più reparti:
     * D = Ds/Dc/B/Dd
     * C = E/M/C
     * A = W/T/A/Pc
     *
     * L'avviso parte soltanto quando nel reparto sono presenti
     * almeno 2 giocatori: niente segnalazioni premature.
     */
    for (const department of ["D", "C", "A"] as MantraDepartment[]) {
      const departmentPlayers = getMantraDepartmentPlayers(
        players,
        department,
      );

      if (departmentPlayers.length < 2) {
        continue;
      }

      const teamCounts: Record<string, number> = {};

      for (const player of departmentPlayers) {
        const team = String(player.team ?? "").trim();

        if (team) {
          teamCounts[team] = (teamCounts[team] ?? 0) + 1;
        }
      }

      for (const [team, count] of Object.entries(teamCounts)) {
        if (count >= 3) {
          alerts.push({
            id: `MANTRA_TEAM_${department}_${team}`,
            level: "red",
            text:
              `Hai ${count} giocatori del ${team} tra i ` +
              `${MANTRA_DEPARTMENT_LABELS[department]}.`,
            dismissible: true,
          });
        } else if (count === 2) {
          alerts.push({
            id: `MANTRA_TEAM_${department}_${team}`,
            level: "orange",
            text:
              `Hai ${count} giocatori del ${team} tra i ` +
              `${MANTRA_DEPARTMENT_LABELS[department]}.`,
            dismissible: true,
          });
        }
      }
    }

    /*
     * MANTRA - copertura e saturazione dei ruoli specifici.
     *
     * Questi avvisi NON partono appena si compra il primo giocatore:
     * il reparto deve essere almeno al 60% del limite configurato
     * e devono esserci almeno 3 giocatori nel reparto.
     */
    for (const department of ["D", "C", "A"] as MantraDepartment[]) {
      const departmentPlayers = getMantraDepartmentPlayers(
        players,
        department,
      );
      const configuredLimit = roleLimits[department];

      if (configuredLimit <= 0 || departmentPlayers.length < 3) {
        continue;
      }

      const progress =
        departmentPlayers.length / configuredLimit;

      if (progress < 0.6) {
        continue;
      }

      const coverage = countMantraRoleCoverage(
        departmentPlayers,
        department,
      );

      const uncoveredRoles = MANTRA_DEPARTMENT_ROLES[
        department
      ].filter((role) => (coverage[role] ?? 0) === 0);

      const weakRoles = MANTRA_DEPARTMENT_ROLES[
        department
      ].filter((role) => (coverage[role] ?? 0) === 1);

      const saturatedRoles = MANTRA_DEPARTMENT_ROLES[
        department
      ].filter((role) => (coverage[role] ?? 0) >= 3);

      const nearCompletion =
        progress >= 0.8 ||
        configuredLimit - departmentPlayers.length <= 2;

      if (nearCompletion && uncoveredRoles.length > 0) {
        alerts.push({
          id: `MANTRA_COVERAGE_${department}_ZERO`,
          level: progress >= 0.9 ? "red" : "orange",
          text:
            `Flessibilità Mantra ridotta tra i ` +
            `${MANTRA_DEPARTMENT_LABELS[department]}: non hai ancora ` +
            `copertura naturale per ${uncoveredRoles.join(", ")}. ` +
            `Valuta questi ruoli se vuoi mantenere più alternative tattiche.`,
          dismissible: true,
        });
      } else if (
        nearCompletion &&
        uncoveredRoles.length === 0 &&
        weakRoles.length > 0
      ) {
        alerts.push({
          id: `MANTRA_COVERAGE_${department}_WEAK`,
          level: "yellow",
          text:
            `Copertura Mantra poco profonda tra i ` +
            `${MANTRA_DEPARTMENT_LABELS[department]}: hai una sola ` +
            `soluzione per ${weakRoles.join(", ")}.`,
          dismissible: true,
        });
      }

      if (
        saturatedRoles.length > 0 &&
        (uncoveredRoles.length > 0 || weakRoles.length > 0)
      ) {
        alerts.push({
          id: `MANTRA_SATURATION_${department}`,
          level: "yellow",
          text:
            `Reparto Mantra sbilanciato: hai molte soluzioni per ` +
            `${saturatedRoles.join(", ")} mentre altri ruoli del reparto ` +
            `sono ancora poco coperti.`,
          dismissible: true,
        });
      }
    }

    /*
     * MANTRA - polivalenza.
     *
     * Si valuta soltanto quando sono già stati acquistati almeno
     * 8 giocatori di movimento, quindi non nei primi acquisti.
     */
    const outfieldPlayers = players.filter(
      (player) => !getMantraRoles(player).includes("Por"),
    );

    if (outfieldPlayers.length >= 8) {
      const multiRoleCount = outfieldPlayers.filter(
        isMantraMultiRole,
      ).length;
      const multiRoleRatio =
        multiRoleCount / outfieldPlayers.length;

      if (multiRoleRatio < 0.2 && outfieldPlayers.length >= 12) {
        alerts.push({
          id: "MANTRA_LOW_FLEXIBILITY_RED",
          level: "orange",
          text:
            `Polivalenza Mantra bassa: solo ${multiRoleCount} su ` +
            `${outfieldPlayers.length} giocatori di movimento coprono ` +
            `più ruoli. La rosa rischia di diventare tatticamente rigida.`,
          dismissible: true,
        });
      } else if (multiRoleRatio < 0.25) {
        alerts.push({
          id: "MANTRA_LOW_FLEXIBILITY",
          level: "yellow",
          text:
            `Polivalenza Mantra contenuta: solo ${multiRoleCount} su ` +
            `${outfieldPlayers.length} giocatori di movimento coprono ` +
            `più ruoli.`,
          dismissible: true,
        });
      }
    }

    /*
     * MANTRA - equilibrio delle fasce difensive.
     * Parte solo dopo almeno 4 giocatori con ruoli difensivi.
     */
    const defensivePlayers = getMantraDepartmentPlayers(
      players,
      "D",
    );

    if (defensivePlayers.length >= 4) {
      const defensiveCoverage = countMantraRoleCoverage(
        defensivePlayers,
        "D",
      );
      const ds = defensiveCoverage.Ds ?? 0;
      const dd = defensiveCoverage.Dd ?? 0;
      const defensiveLimit = roleLimits.D;
      const defensiveProgress =
        defensiveLimit > 0
          ? defensivePlayers.length / defensiveLimit
          : 0;

      if (ds === 0 && dd >= 2) {
        alerts.push({
          id: "MANTRA_SIDE_DS",
          level: defensiveProgress >= 0.75 ? "orange" : "yellow",
          text:
            "Fasce difensive sbilanciate: hai più soluzioni a destra " +
            "ma nessuna copertura naturale Ds.",
          dismissible: true,
        });
      } else if (dd === 0 && ds >= 2) {
        alerts.push({
          id: "MANTRA_SIDE_DD",
          level: defensiveProgress >= 0.75 ? "orange" : "yellow",
          text:
            "Fasce difensive sbilanciate: hai più soluzioni a sinistra " +
            "ma nessuna copertura naturale Dd.",
          dismissible: true,
        });
      }
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
  playerMode,
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

  const [mantraModuleOrder, setMantraModuleOrder] =
    useState<string[]>(() =>
      MANTRA_MODULES.map((module) => module.name),
    );

  const [hiddenMantraModules, setHiddenMantraModules] =
    useState<string[]>([]);

  const [draggedMantraModule, setDraggedMantraModule] =
    useState<string | null>(null);

  const [mantraPreferencesReady, setMantraPreferencesReady] =
    useState(false);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      try {
        const savedValue = window.localStorage.getItem(
          MANTRA_MODULE_PREFERENCES_KEY,
        );

        if (!savedValue) {
          return;
        }

        const parsedValue = JSON.parse(savedValue) as {
          order?: unknown;
          hidden?: unknown;
        };

        const validModuleNames = new Set(
          MANTRA_MODULES.map((module) => module.name),
        );

        if (Array.isArray(parsedValue.order)) {
          const savedOrder = Array.from(
            new Set(
              parsedValue.order.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  validModuleNames.has(value),
              ),
            ),
          );

          for (const module of MANTRA_MODULES) {
            if (!savedOrder.includes(module.name)) {
              savedOrder.push(module.name);
            }
          }

          setMantraModuleOrder(savedOrder);
        }

        if (Array.isArray(parsedValue.hidden)) {
          setHiddenMantraModules(
            Array.from(
              new Set(
                parsedValue.hidden.filter(
                  (value): value is string =>
                    typeof value === "string" &&
                    validModuleNames.has(value),
                ),
              ),
            ),
          );
        }
      } catch (error) {
        console.error(
          "Impossibile leggere le preferenze dei moduli Mantra.",
          error,
        );
      } finally {
        setMantraPreferencesReady(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (!mantraPreferencesReady) {
      return;
    }

    try {
      window.localStorage.setItem(
        MANTRA_MODULE_PREFERENCES_KEY,
        JSON.stringify({
          order: mantraModuleOrder,
          hidden: hiddenMantraModules,
        }),
      );
    } catch (error) {
      console.error(
        "Impossibile salvare le preferenze dei moduli Mantra.",
        error,
      );
    }
  }, [
    hiddenMantraModules,
    mantraModuleOrder,
    mantraPreferencesReady,
  ]);

  const orderedMantraModules = useMemo(() => {
    const moduleByName = new Map(
      MANTRA_MODULES.map((module) => [
        module.name,
        module,
      ]),
    );

    return mantraModuleOrder
      .map((moduleName) => moduleByName.get(moduleName))
      .filter(
        (
          module,
        ): module is MantraModuleDefinition =>
          module !== undefined,
      );
  }, [mantraModuleOrder]);

  const visibleMantraModules = useMemo(
    () =>
      orderedMantraModules.filter(
        (module) =>
          !hiddenMantraModules.includes(module.name),
      ),
    [hiddenMantraModules, orderedMantraModules],
  );

  const hiddenOrderedMantraModules = useMemo(
    () =>
      orderedMantraModules.filter((module) =>
        hiddenMantraModules.includes(module.name),
      ),
    [hiddenMantraModules, orderedMantraModules],
  );

  function hideMantraModule(moduleName: string): void {
    setHiddenMantraModules((currentModules) =>
      currentModules.includes(moduleName)
        ? currentModules
        : [...currentModules, moduleName],
    );
  }

  function showMantraModule(moduleName: string): void {
    setHiddenMantraModules((currentModules) =>
      currentModules.filter(
        (currentName) => currentName !== moduleName,
      ),
    );
  }

  function reorderMantraModule(
    sourceModuleName: string,
    targetModuleName: string,
  ): void {
    if (sourceModuleName === targetModuleName) {
      return;
    }

    setMantraModuleOrder((currentOrder) => {
      const nextOrder = [...currentOrder];
      const sourceIndex = nextOrder.indexOf(sourceModuleName);
      const targetIndex = nextOrder.indexOf(targetModuleName);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentOrder;
      }

      nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, sourceModuleName);

      return nextOrder;
    });
  }

  const sortedPlayers = useMemo(
    () => sortSquadPlayers(purchasedPlayers),
    [purchasedPlayers],
  );

  const analysis = useMemo(
    () =>
      buildSquadAnalysis(
        purchasedPlayers,
        playerMode,
        roleLimits,
        recordPurchasePrice,
        purchasePrices,
        roleBudgets,
      ),
    [
      purchasedPlayers,
      playerMode,
      roleLimits,
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

      {playerMode === "classic" && (
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
      )}

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
                title="Azioni"
              >
                Az.
              </th>
              <th
                style={{
                  ...headerStyle,
                  ...playerHeaderStyle,
                }}
                title="Squadra e nome del giocatore"
              >
                Giocatore
              </th>
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

                  <td style={playerCellStyle}>
                    <span style={playerIdentityStyle}>
                      {playerMode === "mantra" ? (
                        <span
                          aria-label={`Ruoli ${getOrderedMantraRoles(player).join(", ") || "non disponibili"}`}
                          title={`Ruoli ${getOrderedMantraRoles(player).join(", ") || "-"}`}
                          style={mantraSquadRoleAreaStyle}
                        >
                          {getOrderedMantraRoles(player).map(
                            (mantraRole) => (
                              <span
                                key={mantraRole}
                                style={{
                                  ...mantraSquadRoleBadgeStyle,
                                  background:
                                    MANTRA_ROLE_COLORS[mantraRole],
                                }}
                              >
                                {mantraRole}
                              </span>
                            ),
                          )}
                        </span>
                      ) : (
                        <span
                          title={`Ruolo ${role ?? "-"}`}
                          style={{
                            ...squadPlayerRoleBadgeStyle,
                            ...getRoleStyle(role),
                          }}
                        >
                          {role ?? "-"}
                        </span>
                      )}

                      <span style={playerTextStyle}>
                        <span style={playerTeamStyle}>
                          {displayValue(player.team)}
                        </span>
                        <strong style={playerNameStyle}>
                          {displayValue(player.nome)}
                        </strong>
                      </span>
                    </span>
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
                  colSpan={recordPurchasePrice ? 7 : 6}
                  style={emptyCellStyle}
                >
                  Nessun giocatore acquistato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {playerMode === "mantra" && (
        <section style={mantraCoveragePanelStyle}>
          <div style={mantraCoverageHeaderStyle}>
            <div>
              <strong style={mantraCoverageTitleStyle}>
                Copertura moduli Mantra
              </strong>

              <div style={mantraCoverageHintStyle}>
                Sono considerati solo i giocatori di movimento.
                Il numero indica quanti giocatori della rosa possono
                ricoprire quella posizione. Un giocatore multiruolo viene
                conteggiato in tutte le posizioni compatibili. Passa il
                mouse sul numero per vedere i nomi. Trascina i moduli per
                cambiarne l&apos;ordine.
              </div>
            </div>
          </div>

          <div style={mantraModulesGridStyle}>
            {visibleMantraModules.map((module) => (
              <div
                key={module.name}
                draggable
                onDragStart={(event) => {
                  setDraggedMantraModule(module.name);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (draggedMantraModule) {
                    reorderMantraModule(
                      draggedMantraModule,
                      module.name,
                    );
                  }

                  setDraggedMantraModule(null);
                }}
                onDragEnd={() =>
                  setDraggedMantraModule(null)
                }
                style={{
                  ...mantraModuleCardStyle,
                  opacity:
                    draggedMantraModule === module.name
                      ? 0.55
                      : 1,
                }}
              >
                <div style={mantraModuleHeaderStyle}>
                  <span
                    aria-hidden="true"
                    title="Trascina per spostare il modulo"
                    style={mantraModuleDragHandleStyle}
                  >
                    ⋮⋮
                  </span>

                  <strong style={mantraModuleNameStyle}>
                    {module.name}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      hideMantraModule(module.name)
                    }
                    title={`Nascondi modulo ${module.name}`}
                    aria-label={`Nascondi modulo ${module.name}`}
                    style={mantraModuleHideButtonStyle}
                  >
                    −
                  </button>
                </div>

                <div style={mantraModulePositionsStyle}>
                  {module.positions.map((position, index) => {
                    const compatiblePlayers =
                      getPlayersForMantraPosition(
                        purchasedPlayers,
                        position.acceptedRoles,
                      );

                    const tooltipText =
                      compatiblePlayers.length > 0
                        ? compatiblePlayers
                            .map((candidate) => {
                              const name = String(
                                candidate.nome ?? "",
                              ).trim();
                              const team = String(
                                candidate.team ?? "",
                              ).trim();
                              const roles =
                                getOrderedMantraRoles(
                                  candidate,
                                ).join(";");

                              return [
                                name,
                                team ? `(${team})` : "",
                                roles ? `· ${roles}` : "",
                              ]
                                .filter(Boolean)
                                .join(" ");
                            })
                            .join("\n")
                        : "Nessun giocatore disponibile";

                    return (
                      <span
                        key={`${module.name}-${position.label}-${index}`}
                        style={mantraPositionStyle}
                      >
                        <span style={mantraPositionLabelStyle}>
                          {position.label}
                        </span>

                        <span
                          title={tooltipText}
                          aria-label={`${compatiblePlayers.length} giocatori utilizzabili come ${position.label}`}
                          style={{
                            ...mantraCoverageCountStyle,
                            ...getMantraCoverageCountStyle(
                              compatiblePlayers.length,
                            ),
                          }}
                        >
                          ({compatiblePlayers.length})
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {hiddenOrderedMantraModules.length > 0 && (
            <div style={hiddenMantraModulesStyle}>
              <span style={hiddenMantraModulesLabelStyle}>
                Moduli nascosti:
              </span>

              <div style={hiddenMantraModulesButtonsStyle}>
                {hiddenOrderedMantraModules.map((module) => (
                  <button
                    key={module.name}
                    type="button"
                    onClick={() =>
                      showMantraModule(module.name)
                    }
                    title={`Mostra di nuovo il modulo ${module.name}`}
                    style={restoreMantraModuleButtonStyle}
                  >
                    + {module.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}


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

      {playerMode === "classic" &&
        purchasedPlayers.length > 0 && (
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
        borderColor: "var(--fw-warning-border)",
        background: "var(--fw-warning-soft)",
      };
    case "D":
      return {
        borderColor: "var(--fw-success-border)",
        background: "var(--fw-success-soft)",
      };
    case "C":
      return {
        borderColor: "var(--fw-accent-border)",
        background: "var(--fw-info-soft)",
      };
    case "A":
      return {
        borderColor: "var(--fw-danger-border)",
        background: "var(--fw-danger-soft)",
      };
  }
}

function getRoleStyle(
  role: PlayerRole | null,
): CSSProperties {
  switch (role) {
    case "P":
      return {
        background: "#d99000",
        color: "#ffffff",
      };
    case "D":
      return {
        background: "#219653",
        color: "#ffffff",
      };
    case "C":
      return {
        background: "#2d9cdb",
        color: "#ffffff",
      };
    case "A":
      return {
        background: "#c44536",
        color: "#ffffff",
      };
    default:
      return {
        background: "#7f8c8d",
        color: "#ffffff",
      };
  }
}

function getAlertStyle(
  level: AlertLevel,
): CSSProperties {
  switch (level) {
    case "red":
      return {
        background: "var(--fw-role-a-soft)",
        borderLeftColor: "#d32f2f",
      };
    case "orange":
      return {
        background: "var(--fw-role-p-soft)",
        borderLeftColor: "#f57c00",
      };
    case "yellow":
      return {
        background: "var(--fw-warning-soft)",
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
  gap: "8px",
  padding: "9px 11px",
  marginBottom: "7px",
  borderRadius: "7px",
  background: "linear-gradient(135deg, #263746, #3f5870)",
  color: "#fff",
  boxShadow: "0 3px 9px rgba(38, 55, 70, 0.16)",
};

const squadTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.04rem",
  letterSpacing: "0.01em",
};

const squadTitleBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "48px",
  padding: "3px 7px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.28)",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.14)",
  fontSize: "0.82rem",
  fontWeight: 800,
};


const mantraCoveragePanelStyle: CSSProperties = {
  marginBottom: "10px",
  padding: "10px",
  border: "1px solid var(--fw-border)",
  borderRadius: "8px",
  background: "var(--fw-panel-soft)",
};

const mantraCoverageHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "8px",
};

const mantraCoverageTitleStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.88rem",
};

const mantraCoverageHintStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.68rem",
  lineHeight: 1.35,
};

const mantraModulesGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(245px, 1fr))",
  gap: "6px",
};

const mantraModuleCardStyle: CSSProperties = {
  padding: "7px",
  border: "1px solid var(--fw-border)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
};


const mantraModuleHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  marginBottom: "5px",
};

const mantraModuleDragHandleStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.8rem",
  letterSpacing: "-2px",
  cursor: "grab",
  userSelect: "none",
};

const mantraModuleHideButtonStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  marginLeft: "auto",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--fw-border)",
  borderRadius: "5px",
  background: "var(--fw-panel-soft)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.9rem",
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
};

const hiddenMantraModulesStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  flexWrap: "wrap",
  marginTop: "9px",
  paddingTop: "8px",
  borderTop: "1px solid var(--fw-border-soft)",
};

const hiddenMantraModulesLabelStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.7rem",
  fontWeight: 700,
};

const hiddenMantraModulesButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "5px",
};

const restoreMantraModuleButtonStyle: CSSProperties = {
  minHeight: "26px",
  padding: "3px 8px",
  border: "1px solid var(--fw-border)",
  borderRadius: "999px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.68rem",
  fontWeight: 800,
  cursor: "pointer",
};

const mantraModuleNameStyle: CSSProperties = {
  display: "block",
  marginBottom: "5px",
  color: "var(--fw-heading)",
  fontSize: "0.78rem",
};

const mantraModulePositionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "4px 6px",
};

const mantraPositionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "2px",
  whiteSpace: "nowrap",
  fontSize: "0.66rem",
};

const mantraPositionLabelStyle: CSSProperties = {
  color: "var(--fw-text-secondary)",
  fontWeight: 800,
};

const mantraCoverageCountStyle: CSSProperties = {
  minWidth: "23px",
  height: "18px",
  padding: "0 4px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "999px",
  fontSize: "0.62rem",
  fontWeight: 900,
  cursor: "help",
};

const roleCountersStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "5px",
  marginBottom: "8px",
};

const roleCounterCardStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "5px",
  padding: "5px 6px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "6px",
};

const roleCounterLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  color: "var(--fw-text-secondary)",
  fontSize: "0.68rem",
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleCounterValueStyle: CSSProperties = {
  flexShrink: 0,
  color: "var(--fw-heading)",
  fontSize: "0.78rem",
};

const purchaseBudgetSummaryStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: "6px 12px",
  padding: "6px 8px",
  marginBottom: "8px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "6px",
  background: "var(--fw-panel-soft)",
  color: "var(--fw-heading)",
  fontSize: "0.8rem",
};

const priceCellStyle: CSSProperties = {
  padding: "4px 5px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-soft)",
  background: "var(--fw-panel-bg)",
  whiteSpace: "nowrap",
  textAlign: "right",
  fontSize: "0.76rem",
  fontWeight: 700,
};

const tableWrapperStyle: CSSProperties = {
  maxHeight: "56vh",
  overflow: "auto",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "6px",
  background: "var(--fw-panel-bg)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: "500px",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "var(--fw-panel-bg)",
  fontSize: "0.76rem",
};

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 3,
  padding: "6px 5px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "var(--fw-table-head-border)",
  background: "var(--fw-table-head)",
  color: "#fff",
  textAlign: "left",
  whiteSpace: "nowrap",
  fontSize: "0.72rem",
  lineHeight: 1.1,
  boxShadow: "0 2px 4px rgba(0,0,0,0.09)",
};

const actionsHeaderStyle: CSSProperties = {
  left: 0,
  zIndex: 5,
  width: "54px",
  minWidth: "54px",
  textAlign: "center",
};

const playerHeaderStyle: CSSProperties = {
  minWidth: "118px",
};

const cellStyle: CSSProperties = {
  padding: "4px 5px",
  borderWidth: "0 0 1px 1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-soft)",
  background: "var(--fw-panel-bg)",
  whiteSpace: "nowrap",
  fontSize: "0.76rem",
  lineHeight: 1.15,
};

const playerCellStyle: CSSProperties = {
  ...cellStyle,
  minWidth: "132px",
  paddingTop: "2px",
  paddingBottom: "2px",
};

const playerIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  lineHeight: 1.08,
};

const squadPlayerRoleBadgeStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  color: "var(--fw-heading)",
  fontSize: "0.68rem",
  fontWeight: 900,
};

const mantraSquadRoleAreaStyle: CSSProperties = {
  width: "66px",
  minWidth: "66px",
  flexShrink: 0,
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "2px",
};

const mantraSquadRoleBadgeStyle: CSSProperties = {
  width: "20px",
  minWidth: "20px",
  height: "20px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  color: "#ffffff",
  fontSize: "0.48rem",
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: "-0.04em",
  boxShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.48)",
};


const playerTextStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "1px",
};

const playerTeamStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.59rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
};

const playerNameStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.72rem",
};

const actionsCellStyle: CSSProperties = {
  ...cellStyle,
  position: "sticky",
  left: 0,
  zIndex: 2,
  width: "54px",
  minWidth: "54px",
  padding: "2px",
  background: "var(--fw-panel-bg)",
  boxShadow: "2px 0 3px rgba(44, 62, 80, 0.05)",
};

const emptyCellStyle: CSSProperties = {
  padding: "18px",
  color: "var(--fw-text-muted)",
  textAlign: "center",
  fontSize: "0.8rem",
};

const rowActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
};

const returnToListButtonStyle: CSSProperties = {
  width: "24px",
  height: "23px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-accent-border)",
  borderRadius: "4px",
  background: "var(--fw-accent-soft)",
  color: "var(--fw-accent-text)",
  fontSize: "0.82rem",
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
};

const moveToBinButtonStyle: CSSProperties = {
  width: "24px",
  height: "23px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-danger-border)",
  borderRadius: "4px",
  background: "var(--fw-danger-soft)",
  color: "var(--fw-danger-text)",
  fontSize: "0.68rem",
  lineHeight: 1,
  cursor: "pointer",
};

const statBarsContainerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "1px",
};

const statBarStyle: CSSProperties = {
  display: "inline-block",
  width: "5px",
  height: "12px",
  borderRadius: "1px",
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
  color: "var(--fw-heading)",
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
  background: "var(--fw-panel-muted)",
  color: "var(--fw-text-secondary)",
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
  color: "var(--fw-text-muted)",
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
  borderColor: "var(--fw-border-soft)",
  borderRadius: "8px",
  background: "var(--fw-panel-bg)",
  boxShadow: "0 2px 6px rgba(44, 62, 80, 0.05)",
};

const statisticsSummaryStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontWeight: 800,
  cursor: "pointer",
};

const statisticLineStyle: CSSProperties = {
  margin: "5px 0",
  color: "var(--fw-text-secondary)",
  fontSize: "0.86rem",
};
