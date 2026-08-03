import type { PlayerRow } from "@/lib/players";

export type PlayerRole = "P" | "D" | "C" | "A";
export type RoleLimits = Record<PlayerRole, number>;
export type RoleBudgets = Record<PlayerRole, number>;

export const ROLE_ORDER: PlayerRole[] = ["P", "D", "C", "A"];

export const DEFAULT_ROLE_LIMITS: RoleLimits = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

export const DEFAULT_ROLE_BUDGETS: RoleBudgets = {
  P: 0,
  D: 0,
  C: 0,
  A: 0,
};

export const ROLE_PLURAL_LABELS: Record<PlayerRole, string> = {
  P: "portieri",
  D: "difensori",
  C: "centrocampisti",
  A: "attaccanti",
};

export function getPlayerRole(
  player: PlayerRow,
): PlayerRole | null {
  const role = String(player.ruolo ?? "")
    .trim()
    .toUpperCase();

  return ROLE_ORDER.includes(role as PlayerRole)
    ? (role as PlayerRole)
    : null;
}

export function getPlayerKey(player: PlayerRow): string {
  const stableId =
    player.id ??
    player.player_id ??
    player.uuid;

  if (
    stableId !== null &&
    stableId !== undefined &&
    String(stableId).trim() !== ""
  ) {
    return `id:${String(stableId).trim()}`;
  }

  return [
    String(player.ruolo ?? "").trim(),
    String(player.team ?? "").trim(),
    String(player.nome ?? "").trim(),
  ].join("|");
}

export function sortSquadPlayers(
  players: PlayerRow[],
): PlayerRow[] {
  return [...players].sort((firstPlayer, secondPlayer) => {
    const firstRole = getPlayerRole(firstPlayer);
    const secondRole = getPlayerRole(secondPlayer);
    const firstRoleIndex = firstRole
      ? ROLE_ORDER.indexOf(firstRole)
      : ROLE_ORDER.length;
    const secondRoleIndex = secondRole
      ? ROLE_ORDER.indexOf(secondRole)
      : ROLE_ORDER.length;

    if (firstRoleIndex !== secondRoleIndex) {
      return firstRoleIndex - secondRoleIndex;
    }

    return String(firstPlayer.nome ?? "").localeCompare(
      String(secondPlayer.nome ?? ""),
      "it",
      { sensitivity: "base" },
    );
  });
}
