// Versione 1.20
"use client";

// TOOLTIP_LAYOUT_V7: rimossi i separatori ridondanti tra dati anagrafici e suggerimenti; layout compatto invariato.

import type { CSSProperties } from "react";

import {
  calculateCredits,
  formatPlayerValue,
  parseNumericValue,
} from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";
import {
  getStrategyShortLabel,
  type PlayerMode,
  type StrategyColumnMeta,
} from "@/lib/auction-settings";
import {
  ROLE_PLURAL_LABELS,
  getPlayerKey,
  getPlayerRole,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

interface PlayerTooltipProps {
  playerMode: PlayerMode;
  player: PlayerRow | null;
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  initialBudget: number;
  strategyColumns: string[];
  strategyColumnMeta: StrategyColumnMeta[];
  purchasedPlayers: PlayerRow[];
  roleLimits: RoleLimits;
  recordPurchasePrice: boolean;
  purchasePrices: Record<string, number>;
  roleBudgets: RoleBudgets;
}

type AlertLevel = "yellow" | "orange" | "red";

interface PurchaseAlert {
  level: AlertLevel;
  text: string;
  critical?: boolean;
}

interface DetailItem {
  label: string;
  value: string;
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

const MANTRA_PACKAGE_LABELS: Record<
  Exclude<MantraDepartment, "P">,
  string
> = {
  D: "pacchetto difensivo",
  C: "pacchetto di centrocampo",
  A: "pacchetto offensivo",
};

function getAverageTrendWord(
  before: number,
  after: number,
): "salirebbe" | "scenderebbe" | "resterebbe" {
  const difference = after - before;

  if (difference > 0.005) {
    return "salirebbe";
  }

  if (difference < -0.005) {
    return "scenderebbe";
  }

  return "resterebbe";
}

function buildMantraAverageAlert(
  metricLabel: "TIT" | "AFF" | "INT",
  columnName: "titolarita" | "affidabilita" | "integrita",
  department: Exclude<MantraDepartment, "P">,
  currentPlayers: PlayerRow[],
  projectedPlayers: PlayerRow[],
): PurchaseAlert | null {
  /*
   * Evita avvisi prematuri: il pacchetto deve contenere almeno
   * un giocatore già acquistato e almeno due giocatori dopo
   * l'ipotetico acquisto.
   */
  if (
    currentPlayers.length < 1 ||
    projectedPlayers.length < 2
  ) {
    return null;
  }

  const currentAverage = calculateAverage(
    currentPlayers,
    columnName,
  );
  const projectedAverage = calculateAverage(
    projectedPlayers,
    columnName,
  );

  if (projectedAverage >= 3) {
    return null;
  }

  const trend = getAverageTrendWord(
    currentAverage,
    projectedAverage,
  );

  return {
    level: "red",
    text:
      `La media ${metricLabel} del ${MANTRA_PACKAGE_LABELS[department]} ` +
      `${trend} a ${projectedAverage.toFixed(2)}` +
      (trend === "scenderebbe"
        ? "."
        : ", ma sarebbe ancora bassa."),
  };
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

const ROLE_LABELS: Record<PlayerRole, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

function hasValue(value: unknown): boolean {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function plainValue(value: unknown): string {
  if (!hasValue(value)) {
    return "-";
  }

  const numericValue = parseNumericValue(value);

  if (numericValue !== null) {
    return numericValue.toLocaleString("it-IT", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return String(value);
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLocaleLowerCase("it");
}

function getPlayerNotes(player: PlayerRow): string[] {
  const notes: string[] = [];

  for (let index = 1; index <= 5; index += 1) {
    const value = player[`nota_${index}`];

    if (hasValue(value)) {
      notes.push(String(value).trim());
    }
  }

  return notes;
}

function playerHasNote(player: PlayerRow, searchedNote: string): boolean {
  const normalizedSearch = searchedNote.toLocaleLowerCase("it");

  return getPlayerNotes(player).some(
    (note) => normalizeText(note) === normalizedSearch,
  );
}

function numericValue(value: unknown): number {
  return parseNumericValue(value) ?? 0;
}

function calculateAverage(
  players: PlayerRow[],
  columnName: string,
): number {
  if (players.length === 0) {
    return 0;
  }

  const total = players.reduce(
    (sum, player) => sum + numericValue(player[columnName]),
    0,
  );

  return total / players.length;
}

function getPotentialPurchaseAlerts(
  playerMode: PlayerMode,
  playerToAdd: PlayerRow,
  purchasedPlayers: PlayerRow[],
  roleLimits: RoleLimits,
  initialBudget: number,
  recordPurchasePrice: boolean,
  purchasePrices: Record<string, number>,
  roleBudgets: RoleBudgets,
): PurchaseAlert[] {
  const alerts: PurchaseAlert[] = [];
  const role = getPlayerRole(playerToAdd);

  if (!role) {
    return [
      {
        level: "red",
        text: "Il giocatore non ha un ruolo valido.",
      },
    ];
  }

  const temporarySquad = [...purchasedPlayers, playerToAdd];
  const purchasedInRole = purchasedPlayers.filter(
    (player) => getPlayerRole(player) === role,
  ).length;

  if (purchasedInRole >= roleLimits[role]) {
    alerts.push({
      level: "red",
      critical: true,
      text:
        `Hai già raggiunto il limite massimo per il ruolo ${role}: ` +
        `${purchasedInRole}/${roleLimits[role]}.`,
    });
  }

  if (recordPurchasePrice && roleBudgets[role] > 0) {
    const expectedPercentage =
      parseNumericValue(playerToAdd.media_strategie) ??
      parseNumericValue(playerToAdd.pma);

    if (expectedPercentage !== null && expectedPercentage > 0) {
      const expectedPrice = calculateCredits(
        expectedPercentage,
        initialBudget,
      );

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
        currentRoleSpent + expectedPrice;
      const plannedRoleBudget = roleBudgets[role];

      if (projectedRoleSpent > plannedRoleBudget) {
        const projectedOverrun =
          projectedRoleSpent - plannedRoleBudget;
        const roleLabel = ROLE_PLURAL_LABELS[role];

        if (currentRoleSpent > plannedRoleBudget) {
          const currentOverrun =
            currentRoleSpent - plannedRoleBudget;

          alerts.push({
            level: "red",
            text:
              `Il budget previsto per i ${roleLabel} è già stato ` +
              `superato di ${currentOverrun} crediti. Acquistando ` +
              `questo giocatore al prezzo stimato dalla Media ` +
              `(${expectedPrice} crediti), lo scostamento salirebbe ` +
              `a ${projectedOverrun} crediti.`,
          });
        } else {
          alerts.push({
            level: "red",
            text:
              `Acquistando questo giocatore al prezzo stimato ` +
              `dalla Media (${expectedPrice} crediti), la spesa per ` +
              `i ${roleLabel} salirebbe a ${projectedRoleSpent} ` +
              `crediti, superando di ${projectedOverrun} il budget ` +
              `previsto di ${plannedRoleBudget} crediti.`,
          });
        }
      }
    }
  }

  const temporaryRolePlayers = temporarySquad.filter(
    (player) => getPlayerRole(player) === role,
  );

  if (
    playerMode === "classic" &&
    temporaryRolePlayers.length >= 2
  ) {
    const currentRolePlayers = purchasedPlayers.filter(
      (player) => getPlayerRole(player) === role,
    );

    const averageTitolarita = calculateAverage(
      temporaryRolePlayers,
      "titolarita",
    );
    const averageAffidabilita = calculateAverage(
      temporaryRolePlayers,
      "affidabilita",
    );
    const averageIntegrita = calculateAverage(
      temporaryRolePlayers,
      "integrita",
    );

    const currentTitolarita = calculateAverage(
      currentRolePlayers,
      "titolarita",
    );
    const currentAffidabilita = calculateAverage(
      currentRolePlayers,
      "affidabilita",
    );
    const currentIntegrita = calculateAverage(
      currentRolePlayers,
      "integrita",
    );

    if (averageTitolarita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media TIT dei ${role} ${getAverageTrendWord(
            currentTitolarita,
            averageTitolarita,
          )} a ${averageTitolarita.toFixed(2)}.`,
      });
    }

    if (averageAffidabilita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media AFF dei ${role} ${getAverageTrendWord(
            currentAffidabilita,
            averageAffidabilita,
          )} a ${averageAffidabilita.toFixed(2)}.`,
      });
    }

    if (averageIntegrita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media INT dei ${role} ${getAverageTrendWord(
            currentIntegrita,
            averageIntegrita,
          )} a ${averageIntegrita.toFixed(2)}.`,
      });
    }
  }

  if (playerMode === "mantra") {
    const playerDepartments = getMantraDepartments(
      playerToAdd,
    ).filter(
      (
        department,
      ): department is Exclude<MantraDepartment, "P"> =>
        department !== "P",
    );

    for (const department of playerDepartments) {
      const currentDepartmentPlayers =
        getMantraDepartmentPlayers(
          purchasedPlayers,
          department,
        );

      const projectedDepartmentPlayers =
        getMantraDepartmentPlayers(
          temporarySquad,
          department,
        );

      for (const [
        metricLabel,
        columnName,
      ] of [
        ["TIT", "titolarita"],
        ["AFF", "affidabilita"],
        ["INT", "integrita"],
      ] as const) {
        const alert = buildMantraAverageAlert(
          metricLabel,
          columnName,
          department,
          currentDepartmentPlayers,
          projectedDepartmentPlayers,
        );

        if (alert) {
          alerts.push(alert);
        }
      }
    }
  }

  const playerTeam = String(playerToAdd.team ?? "").trim();

  if (playerMode === "classic" && playerTeam && role !== "P") {
    const teamCountInRole = temporaryRolePlayers.filter(
      (player) => String(player.team ?? "").trim() === playerTeam,
    ).length;

    if (teamCountInRole >= 3) {
      alerts.push({
        level: "red",
        text:
          `Avresti ${teamCountInRole} giocatori del ${playerTeam} ` +
          `nel ruolo ${role}.`,
      });
    } else if (teamCountInRole === 2) {
      alerts.push({
        level: "orange",
        text:
          `Avresti ${teamCountInRole} giocatori del ${playerTeam} ` +
          `nel ruolo ${role}.`,
      });
    }
  }


  if (playerMode === "mantra") {
    const candidateDepartments = getMantraDepartments(
      playerToAdd,
    );

    /*
     * Concentrazione per macro-ruolo Mantra:
     * l'avviso nasce soltanto dal secondo giocatore del reparto.
     */
    if (playerTeam) {
      for (const department of candidateDepartments) {
        if (department === "P") {
          continue;
        }

        const departmentPlayers = getMantraDepartmentPlayers(
          temporarySquad,
          department,
        );

        if (departmentPlayers.length < 2) {
          continue;
        }

        const sameTeamCount = departmentPlayers.filter(
          (player) =>
            String(player.team ?? "").trim() === playerTeam,
        ).length;

        if (sameTeamCount >= 3) {
          alerts.push({
            level: "red",
            text:
              `Avresti ${sameTeamCount} giocatori del ${playerTeam} ` +
              `tra i ${MANTRA_DEPARTMENT_LABELS[department]}.`,
          });
        } else if (sameTeamCount === 2) {
          alerts.push({
            level: "orange",
            text:
              `Avresti ${sameTeamCount} giocatori del ${playerTeam} ` +
              `tra i ${MANTRA_DEPARTMENT_LABELS[department]}.`,
          });
        }
      }
    }

    /*
     * Saturazione / copertura:
     * viene valutata soltanto quando il reparto è già almeno
     * al 60% del limite configurato.
     */
    for (const department of candidateDepartments) {
      if (department === "P") {
        continue;
      }

      const departmentPlayers = getMantraDepartmentPlayers(
        temporarySquad,
        department,
      );
      const configuredLimit = roleLimits[department];

      if (
        configuredLimit <= 0 ||
        departmentPlayers.length < 3 ||
        departmentPlayers.length / configuredLimit < 0.6
      ) {
        continue;
      }

      const coverage = countMantraRoleCoverage(
        departmentPlayers,
        department,
      );
      const candidateRoles = getMantraRoles(playerToAdd).filter(
        (roleName) =>
          MANTRA_DEPARTMENT_ROLES[department].includes(roleName),
      );

      const uncoveredRoles = MANTRA_DEPARTMENT_ROLES[
        department
      ].filter((roleName) => (coverage[roleName] ?? 0) === 0);

      const weakRoles = MANTRA_DEPARTMENT_ROLES[
        department
      ].filter((roleName) => (coverage[roleName] ?? 0) <= 1);

      const candidateAlreadyDeep = candidateRoles.length > 0 &&
        candidateRoles.every(
          (roleName) => (coverage[roleName] ?? 0) >= 3,
        );

      if (
        candidateAlreadyDeep &&
        weakRoles.some(
          (roleName) => !candidateRoles.includes(roleName),
        )
      ) {
        alerts.push({
          level: "yellow",
          text:
            `Questo acquisto aumenterebbe ancora la copertura di ` +
            `${candidateRoles.join("/")} mentre nel reparto hai ancora ` +
            `poche alternative per ${weakRoles
              .filter((roleName) => !candidateRoles.includes(roleName))
              .join(", ")}.`,
        });
      }

      const progress =
        departmentPlayers.length / configuredLimit;

      if (
        progress >= 0.8 &&
        uncoveredRoles.length > 0 &&
        candidateRoles.every(
          (roleName) => !uncoveredRoles.includes(roleName),
        )
      ) {
        alerts.push({
          level: "orange",
          text:
            `Il reparto è vicino al completamento ma resterebbero senza ` +
            `copertura naturale: ${uncoveredRoles.join(", ")}.`,
        });
      }
    }

    /*
     * Polivalenza: nessun avviso nei primi acquisti.
     * Parte soltanto da 8 giocatori di movimento.
     */
    const outfieldPlayers = temporarySquad.filter(
      (player) => !getMantraRoles(player).includes("Por"),
    );

    if (
      outfieldPlayers.length >= 8 &&
      !isMantraMultiRole(playerToAdd)
    ) {
      const multiRoleCount = outfieldPlayers.filter(
        isMantraMultiRole,
      ).length;
      const ratio = multiRoleCount / outfieldPlayers.length;

      if (ratio < 0.25) {
        alerts.push({
          level: "yellow",
          text:
            `La rosa ha poca polivalenza Mantra (${multiRoleCount}/` +
            `${outfieldPlayers.length} multiruolo) e questo giocatore ` +
            `è monoruolo.`,
        });
      }
    }
  }

  const totalTeamCount: Record<string, number> = {};
  const goalkeeperTeams = new Set<string>();

  for (const player of temporarySquad) {
    const team = String(player.team ?? "").trim();
    const playerRole = getPlayerRole(player);

    if (!team || !playerRole) {
      continue;
    }

    if (playerRole === "P") {
      if (!goalkeeperTeams.has(team)) {
        totalTeamCount[team] = (totalTeamCount[team] ?? 0) + 1;
        goalkeeperTeams.add(team);
      }
    } else {
      totalTeamCount[team] = (totalTeamCount[team] ?? 0) + 1;
    }
  }

  const coppaAfricaPlayers = temporarySquad.filter((player) =>
    playerHasNote(player, "Coppa Africa"),
  );

  if (temporarySquad.length >= 4) {
    const totalFromSameTeam = playerTeam
      ? totalTeamCount[playerTeam] ?? 0
      : 0;

    if (totalFromSameTeam >= 5) {
      alerts.push({
        level: "red",
        text: `Avresti ${totalFromSameTeam} giocatori del ${playerTeam} in rosa.`,
      });
    } else if (totalFromSameTeam === 4) {
      alerts.push({
        level: "orange",
        text: `Avresti ${totalFromSameTeam} giocatori del ${playerTeam} in rosa.`,
      });
    } else if (totalFromSameTeam === 3) {
      alerts.push({
        level: "yellow",
        text: `Avresti ${totalFromSameTeam} giocatori del ${playerTeam} in rosa.`,
      });
    }

    if (coppaAfricaPlayers.length >= 4) {
      alerts.push({
        level: "red",
        text:
          `Avresti ${coppaAfricaPlayers.length} giocatori ` +
          `impegnati in Coppa d'Africa.`,
      });
    } else if (coppaAfricaPlayers.length === 3) {
      alerts.push({
        level: "orange",
        text:
          `Avresti ${coppaAfricaPlayers.length} giocatori ` +
          `impegnati in Coppa d'Africa.`,
      });
    } else if (coppaAfricaPlayers.length === 2) {
      alerts.push({
        level: "yellow",
        text:
          `Avresti ${coppaAfricaPlayers.length} giocatori ` +
          `impegnati in Coppa d'Africa.`,
      });
    }
  }

  if (playerHasNote(playerToAdd, "Coppa Africa")) {
    const coppaAfricaInRole = coppaAfricaPlayers.filter(
      (player) => getPlayerRole(player) === role,
    ).length;

    if (coppaAfricaInRole >= 2) {
      alerts.push({
        level: "orange",
        text:
          `Avresti ${coppaAfricaInRole} giocatori impegnati in ` +
          `Coppa d'Africa nel ruolo ${role}.`,
      });
    }
  }

  return alerts;
}

function buildPriceDetails(
  player: PlayerRow,
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[],
  initialBudget: number,
): DetailItem[] {
  const details: DetailItem[] = [
    {
      label: "Media",
      value: formatPlayerValue(
        player.media_strategie,
        "media_strategie",
        initialBudget,
      ),
    },
    {
      label: "PMA",
      value: formatPlayerValue(player.pma, "pma", initialBudget),
    },
  ];

  for (const columnName of strategyColumns) {
    details.push({
      label: getStrategyShortLabel(
        columnName,
        strategyColumnMeta,
      ),
      value: formatPlayerValue(
        player[columnName],
        columnName,
        initialBudget,
      ),
    });
  }

  return details.filter((item) => item.value !== "-");
}

function buildSeasonDetails(player: PlayerRow): DetailItem[] {
  const role = getPlayerRole(player);

  const commonDetails: DetailItem[] = [
    { label: "Presenze", value: plainValue(player.presenze) },
    { label: "Partite titolare", value: plainValue(player.pt__tit) },
    { label: "Minuti", value: plainValue(player.minuti) },
    { label: "Partite saltate", value: plainValue(player.pt__inf) },
  ];

  const roleSpecificDetails: DetailItem[] =
    role === "P"
      ? [
          { label: "Gol subiti", value: plainValue(player.gol_subiti) },
          { label: "Rigori parati", value: plainValue(player.rig__parati) },
        ]
      : [
          { label: "Gol", value: plainValue(player.gol) },
          { label: "Assist", value: plainValue(player.assist) },
          { label: "Ammonizioni", value: plainValue(player.ammonizioni) },
          { label: "Espulsioni", value: plainValue(player.espulsioni) },
          { label: "Rigori segnati", value: plainValue(player.rig__segnati) },
          { label: "Rigori sbagliati", value: plainValue(player.rig__sbagliati) },
        ];

  const fantasyAverageDetails: DetailItem[] = [
    { label: "MV", value: plainValue(player.mv) },
    { label: "FMV", value: plainValue(player.fmv) },
    { label: "FMV Exp", value: plainValue(player.fmv_exp) },
  ];

  return [
    ...commonDetails,
    ...roleSpecificDetails,
    ...fantasyAverageDetails,
  ].filter((item) => item.value !== "-");
}

function DetailColumn({
  title,
  items,
}: {
  title: string;
  items: DetailItem[];
}) {
  return (
    <section style={detailColumnStyle}>
      <h4 style={detailColumnTitleStyle}>{title}</h4>

      {items.length === 0 ? (
        <p style={emptyTextStyle}>Nessun dato disponibile.</p>
      ) : (
        items.map((item, index) => (
          <p
            key={item.label}
            style={
              index === items.length - 1
                ? lastDetailLineStyle
                : detailLineStyle
            }
          >
            <strong style={detailLabelStyle}>{item.label}:</strong>{" "}
            {item.value}
          </p>
        ))
      )}
    </section>
  );
}

function DetailItemsColumn({
  items,
}: {
  items: DetailItem[];
}) {
  return (
    <div style={detailColumnStyle}>
      {items.length === 0 ? (
        <p style={emptyTextStyle}>Nessun dato disponibile.</p>
      ) : (
        items.map((item, index) => (
          <p
            key={item.label}
            style={
              index === items.length - 1
                ? lastDetailLineStyle
                : detailLineStyle
            }
          >
            <strong style={detailLabelStyle}>{item.label}:</strong>{" "}
            {item.value}
          </p>
        ))
      )}
    </div>
  );
}

function getAlertIcon(level: AlertLevel): string {
  switch (level) {
    case "red":
      return "🔴";
    case "orange":
      return "🟠";
    case "yellow":
      return "🟡";
  }
}

export default function PlayerTooltip({
  playerMode,
  player,
  pointerX,
  pointerY,
  viewportWidth,
  viewportHeight,
  initialBudget,
  strategyColumns,
  strategyColumnMeta,
  purchasedPlayers,
  roleLimits,
  recordPurchasePrice,
  purchasePrices,
  roleBudgets,
}: PlayerTooltipProps) {
  if (!player) {
    return null;
  }

  const role = getPlayerRole(player);
  const notes = getPlayerNotes(player);
  const purchaseAlerts = getPotentialPurchaseAlerts(
    playerMode,
    player,
    purchasedPlayers,
    roleLimits,
    initialBudget,
    recordPurchasePrice,
    purchasePrices,
    roleBudgets,
  );

  const priceAndStrategyDetails = buildPriceDetails(
    player,
    strategyColumns,
    strategyColumnMeta,
    initialBudget,
  );

  const STRATEGY_ROWS_PER_COLUMN = 7;

  const seasonDetails = buildSeasonDetails(player);
  const seasonSplitIndex = Math.ceil(seasonDetails.length / 2);
  const seasonDetailColumns: DetailItem[][] = [
    seasonDetails.slice(0, seasonSplitIndex),
    seasonDetails.slice(seasonSplitIndex),
  ].filter((items) => items.length > 0);

  const strategyDetailColumns: DetailItem[][] = [];

  for (
    let index = 0;
    index < priceAndStrategyDetails.length;
    index += STRATEGY_ROWS_PER_COLUMN
  ) {
    strategyDetailColumns.push(
      priceAndStrategyDetails.slice(
        index,
        index + STRATEGY_ROWS_PER_COLUMN,
      ),
    );
  }

  const TOOLTIP_GAP = 10;
  const TOOLTIP_MARGIN = 8;
  const showOnLeft = pointerX > viewportWidth / 2;
  const showAbove = pointerY > viewportHeight / 2;

  const availableWidth = showOnLeft
    ? pointerX - TOOLTIP_GAP - TOOLTIP_MARGIN
    : viewportWidth - pointerX - TOOLTIP_GAP - TOOLTIP_MARGIN;

  const availableHeight = showAbove
    ? pointerY - TOOLTIP_GAP - TOOLTIP_MARGIN
    : viewportHeight - pointerY - TOOLTIP_GAP - TOOLTIP_MARGIN;

  const horizontalPosition: CSSProperties = showOnLeft
    ? {
        right: Math.max(
          viewportWidth - pointerX + TOOLTIP_GAP,
          TOOLTIP_MARGIN,
        ),
        maxWidth: `${Math.max(availableWidth, 280)}px`,
      }
    : {
        left: Math.max(pointerX + TOOLTIP_GAP, TOOLTIP_MARGIN),
        maxWidth: `${Math.max(availableWidth, 280)}px`,
      };

  const verticalPosition: CSSProperties = showAbove
    ? {
        bottom: Math.max(
          viewportHeight - pointerY + TOOLTIP_GAP,
          TOOLTIP_MARGIN,
        ),
        maxHeight: `${Math.max(availableHeight, 180)}px`,
      }
    : {
        top: Math.max(pointerY + TOOLTIP_GAP, TOOLTIP_MARGIN),
        maxHeight: `${Math.max(availableHeight, 180)}px`,
      };

  return (
    <aside
      role="tooltip"
      style={{
        ...tooltipStyle,
        ...horizontalPosition,
        ...verticalPosition,
      }}
    >
      <header style={tooltipHeaderStyle}>
        <div>
          <strong style={playerNameStyle}>{plainValue(player.nome)}</strong>
          <div style={playerSubtitleStyle}>
            {playerMode === "mantra"
              ? getMantraRoles(player).join(" · ") || "-"
              : role
                ? ROLE_LABELS[role]
                : plainValue(player.ruolo)}
            {hasValue(player.team) ? ` · ${String(player.team)}` : ""}
          </div>
        </div>
      </header>

      <section style={alertsSectionStyle}>
        <strong style={alertsTitleStyle}>Suggerimenti per l’acquisto</strong>

        {purchaseAlerts.length === 0 ? (
          <p style={noAlertsStyle}>
            Nessun avviso strategico rilevato con la rosa attuale.
          </p>
        ) : (
          <div style={alertsListStyle}>
            {purchaseAlerts.map((alert, index) => (
              <p
                key={`${alert.text}-${index}`}
                style={{
                  ...alertLineStyle,
                  ...(alert.critical
                    ? criticalAlertLineStyle
                    : {}),
                }}
              >
                <span aria-hidden="true">
                  {getAlertIcon(alert.level)}
                </span>{" "}
                {alert.text}
              </p>
            ))}
          </div>
        )}
      </section>

      <section style={fullWidthSectionStyle}>
        <div style={statisticsSectionContentStyle}>
          <div style={detailsGroupsStyle}>
            <section style={statisticsGroupStyle}>
              <h4 style={detailColumnTitleStyle}>Statistiche</h4>
              <div style={statisticsColumnsStyle}>
                {seasonDetailColumns.map((items, columnIndex) => (
                  <DetailItemsColumn
                    key={`statistiche-${columnIndex}`}
                    items={items}
                  />
                ))}
              </div>
            </section>

            <section style={strategiesGroupStyle}>
              <h4 style={detailColumnTitleStyle}>Strategie</h4>
              <div style={strategyColumnsStyle}>
                {strategyDetailColumns.map((items, columnIndex) => (
                  <DetailItemsColumn
                    key={`strategie-${columnIndex}`}
                    items={items}
                  />
                ))}
              </div>
            </section>
          </div>

          {notes.length > 0 && (
            <section style={subSectionStyle}>
              <strong style={subSectionTitleStyle}>Note</strong>
              <p style={sectionTextStyle}>{notes.join(" · ")}</p>
            </section>
          )}

          {hasValue(player.commento) && (
            <section style={subSectionStyle}>
              <strong style={subSectionTitleStyle}>Commento</strong>
              <p style={sectionTextStyle}>{String(player.commento)}</p>
            </section>
          )}
        </div>
      </section>
    </aside>
  );
}

const tooltipStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2000,
  width: "min(760px, calc(100vw - 16px))",
  maxHeight: "calc(100vh - 16px)",
  overflowY: "auto",
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "10px",
  background: "rgba(36, 52, 68, 0.98)",
  color: "#fff",
  boxShadow: "0 12px 34px rgba(0,0,0,0.38)",
  pointerEvents: "none",
  fontSize: "0.78rem",
  lineHeight: 1.28,
};

const tooltipHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  paddingBottom: 0,
  marginBottom: "4px",
};

const playerNameStyle: CSSProperties = {
  display: "block",
  color: "#74b9ff",
  fontSize: "1rem",
};

const playerSubtitleStyle: CSSProperties = {
  marginTop: "2px",
  color: "#dfe6e9",
};

const detailsGroupsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 0,
  alignItems: "start",
};

const statisticsGroupStyle: CSSProperties = {
  minWidth: 0,
  paddingRight: "10px",
};

const strategiesGroupStyle: CSSProperties = {
  minWidth: 0,
  paddingLeft: "10px",
  borderLeft: "1px solid rgba(255,255,255,0.28)",
};

const statisticsColumnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const strategyColumnsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gap: "8px",
};

const detailColumnStyle: CSSProperties = {
  minWidth: 0,
};

const detailColumnTitleStyle: CSSProperties = {
  margin: "0 0 4px",
  color: "#f6c344",
  fontSize: "0.84rem",
};

const detailLineStyle: CSSProperties = {
  margin: 0,
  padding: "2px 0",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  overflowWrap: "anywhere",
};

const lastDetailLineStyle: CSSProperties = {
  ...detailLineStyle,
  paddingBottom: 0,
  borderBottom: "none",
};

const detailLabelStyle: CSSProperties = {
  color: "#74b9ff",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#b2bec3",
};

const fullWidthSectionStyle: CSSProperties = {
  paddingTop: "6px",
  marginTop: "6px",
  borderTop: "1px solid rgba(255,255,255,0.18)",
};

const sectionTitleStyle: CSSProperties = {
  color: "#74b9ff",
  display: "block",
};

const statisticsSectionContentStyle: CSSProperties = {
  marginTop: "3px",
};

const subSectionStyle: CSSProperties = {
  paddingTop: "6px",
  marginTop: "6px",
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

const subSectionTitleStyle: CSSProperties = {
  color: "#f6c344",
};

const sectionTextStyle: CSSProperties = {
  margin: "2px 0 0",
  whiteSpace: "normal",
};

const alertsSectionStyle: CSSProperties = {
  paddingTop: 0,
  marginTop: 0,
};

const alertsTitleStyle: CSSProperties = {
  color: "#f6c344",
};

const noAlertsStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#a3e4b1",
};

const alertsListStyle: CSSProperties = {
  marginTop: "3px",
};

const alertLineStyle: CSSProperties = {
  margin: "2px 0",
};

const criticalAlertLineStyle: CSSProperties = {
  color: "#ff6b6b",
  fontWeight: 800,
};
