import type { PlayerRow } from "@/lib/players";

export type PlayerRole = "P" | "D" | "C" | "A";

export type RoleLimits = Record<PlayerRole, number>;

export const ROLE_ORDER: PlayerRole[] = [
  "P",
  "D",
  "C",
  "A",
];

export const DEFAULT_ROLE_LIMITS: RoleLimits = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
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

/*
 * Chiave provvisoria del giocatore.
 * In seguito sarà preferibile avere un vero ID
 * univoco nella tabella Supabase.
 */
export function getPlayerKey(
  player: PlayerRow,
): string {
  return [
    String(player.ruolo ?? "").trim(),
    String(player.team ?? "").trim(),
    String(player.nome ?? "").trim(),
  ].join("|");
}

export function sortSquadPlayers(
  players: PlayerRow[],
): PlayerRow[] {
  return [...players].sort(
    (firstPlayer, secondPlayer) => {
      const firstRole =
        getPlayerRole(firstPlayer);

      const secondRole =
        getPlayerRole(secondPlayer);

      const firstRoleIndex = firstRole
        ? ROLE_ORDER.indexOf(firstRole)
        : ROLE_ORDER.length;

      const secondRoleIndex = secondRole
        ? ROLE_ORDER.indexOf(secondRole)
        : ROLE_ORDER.length;

      if (firstRoleIndex !== secondRoleIndex) {
        return firstRoleIndex - secondRoleIndex;
      }

      return String(
        firstPlayer.nome ?? "",
      ).localeCompare(
        String(secondPlayer.nome ?? ""),
        "it",
        {
          sensitivity: "base",
        },
      );
    },
  );
}