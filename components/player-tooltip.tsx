"use client";

import type { CSSProperties } from "react";

import {
  calculateCredits,
  formatPlayerValue,
  parseNumericValue,
} from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";
import {
  ROLE_PLURAL_LABELS,
  getPlayerKey,
  getPlayerRole,
  type PlayerRole,
  type RoleBudgets,
  type RoleLimits,
} from "@/lib/squad";

interface PlayerTooltipProps {
  player: PlayerRow | null;
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  initialBudget: number;
  strategyColumns: string[];
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
}

interface DetailItem {
  label: string;
  value: string;
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

function formatStrategyLabel(columnName: string): string {
  return columnName
    .replace(/^strategia_/, "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
      text:
        `Raggiungeresti il limite di ${roleLimits[role]} ` +
        `giocatori per il ruolo ${role}.`,
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

  if (temporaryRolePlayers.length >= 2) {
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

    if (averageTitolarita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media TIT dei ${role} scenderebbe a ` +
          `${averageTitolarita.toFixed(2)}.`,
      });
    }

    if (averageAffidabilita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media AFF dei ${role} scenderebbe a ` +
          `${averageAffidabilita.toFixed(2)}.`,
      });
    }

    if (averageIntegrita < 3) {
      alerts.push({
        level: "red",
        text:
          `La media INT dei ${role} scenderebbe a ` +
          `${averageIntegrita.toFixed(2)}.`,
      });
    }
  }

  const playerTeam = String(playerToAdd.team ?? "").trim();

  if (playerTeam && role !== "P") {
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

function buildMainDetails(player: PlayerRow): DetailItem[] {
  return [
    { label: "Ruolo", value: plainValue(player.ruolo) },
    { label: "Squadra", value: plainValue(player.team) },
    { label: "TIT", value: plainValue(player.titolarita) },
    { label: "AFF", value: plainValue(player.affidabilita) },
    { label: "INT", value: plainValue(player.integrita) },
    { label: "MV", value: plainValue(player.mv) },
    { label: "FMV", value: plainValue(player.fmv) },
    { label: "FMV Exp", value: plainValue(player.fmv_exp) },
  ].filter((item) => item.value !== "-");
}

function buildPriceDetails(
  player: PlayerRow,
  strategyColumns: string[],
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
      label: formatStrategyLabel(columnName),
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

  return [...commonDetails, ...roleSpecificDetails].filter(
    (item) => item.value !== "-",
  );
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
        items.map((item) => (
          <p key={item.label} style={detailLineStyle}>
            <strong style={detailLabelStyle}>{item.label}:</strong>{" "}
            {item.value}
          </p>
        ))
      )}
    </section>
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
  player,
  pointerX,
  pointerY,
  viewportWidth,
  viewportHeight,
  initialBudget,
  strategyColumns,
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
    player,
    purchasedPlayers,
    roleLimits,
    initialBudget,
    recordPurchasePrice,
    purchasePrices,
    roleBudgets,
  );

  const horizontalPosition: CSSProperties =
    pointerX > viewportWidth / 2
      ? { right: Math.max(viewportWidth - pointerX + 14, 14) }
      : { left: Math.max(pointerX + 14, 14) };

  const verticalPosition: CSSProperties =
    pointerY > viewportHeight / 2
      ? { bottom: Math.max(viewportHeight - pointerY + 14, 14) }
      : { top: Math.max(pointerY + 14, 14) };

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
            {role ? ROLE_LABELS[role] : plainValue(player.ruolo)}
            {hasValue(player.team) ? ` · ${String(player.team)}` : ""}
          </div>
        </div>
      </header>

      <div style={detailsGridStyle}>
        <DetailColumn title="Profilo" items={buildMainDetails(player)} />
        <DetailColumn
          title="Prezzi e strategie"
          items={buildPriceDetails(
            player,
            strategyColumns,
            initialBudget,
          )}
        />
        <DetailColumn title="Statistiche" items={buildSeasonDetails(player)} />
      </div>

      {notes.length > 0 && (
        <section style={fullWidthSectionStyle}>
          <strong style={sectionTitleStyle}>Note</strong>
          <p style={sectionTextStyle}>{notes.join(" · ")}</p>
        </section>
      )}

      {hasValue(player.commento) && (
        <section style={fullWidthSectionStyle}>
          <strong style={sectionTitleStyle}>Commento</strong>
          <p style={sectionTextStyle}>{String(player.commento)}</p>
        </section>
      )}

      <section style={alertsSectionStyle}>
        <strong style={alertsTitleStyle}>Valutazione preventiva dell’acquisto</strong>

        {purchaseAlerts.length === 0 ? (
          <p style={noAlertsStyle}>
            Nessun avviso strategico rilevato con la rosa attuale.
          </p>
        ) : (
          <div style={alertsListStyle}>
            {purchaseAlerts.map((alert, index) => (
              <p key={`${alert.text}-${index}`} style={alertLineStyle}>
                <span aria-hidden="true">{getAlertIcon(alert.level)}</span>{" "}
                {alert.text}
              </p>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

const tooltipStyle: CSSProperties = {
  position: "fixed",
  zIndex: 2000,
  width: "min(860px, calc(100vw - 28px))",
  maxHeight: "min(720px, calc(100vh - 28px))",
  overflowY: "auto",
  padding: "16px",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "10px",
  background: "rgba(36, 52, 68, 0.98)",
  color: "#fff",
  boxShadow: "0 12px 34px rgba(0,0,0,0.38)",
  pointerEvents: "none",
  fontSize: "0.84rem",
  lineHeight: 1.45,
};

const tooltipHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  paddingBottom: "10px",
  marginBottom: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.18)",
};

const playerNameStyle: CSSProperties = {
  display: "block",
  color: "#74b9ff",
  fontSize: "1.08rem",
};

const playerSubtitleStyle: CSSProperties = {
  marginTop: "2px",
  color: "#dfe6e9",
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
};

const detailColumnStyle: CSSProperties = {
  minWidth: 0,
};

const detailColumnTitleStyle: CSSProperties = {
  margin: "0 0 6px",
  color: "#f6c344",
  fontSize: "0.9rem",
};

const detailLineStyle: CSSProperties = {
  margin: 0,
  padding: "4px 0",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  overflowWrap: "anywhere",
};

const detailLabelStyle: CSSProperties = {
  color: "#74b9ff",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#b2bec3",
};

const fullWidthSectionStyle: CSSProperties = {
  paddingTop: "10px",
  marginTop: "10px",
  borderTop: "1px solid rgba(255,255,255,0.18)",
};

const sectionTitleStyle: CSSProperties = {
  color: "#74b9ff",
};

const sectionTextStyle: CSSProperties = {
  margin: "4px 0 0",
  whiteSpace: "normal",
};

const alertsSectionStyle: CSSProperties = {
  paddingTop: "10px",
  marginTop: "10px",
  borderTop: "1px solid rgba(255,255,255,0.18)",
};

const alertsTitleStyle: CSSProperties = {
  color: "#f6c344",
};

const noAlertsStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#a3e4b1",
};

const alertsListStyle: CSSProperties = {
  marginTop: "5px",
};

const alertLineStyle: CSSProperties = {
  margin: "4px 0",
};
