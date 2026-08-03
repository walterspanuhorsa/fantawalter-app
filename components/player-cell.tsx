import type { CSSProperties } from "react";

import { formatPlayerValue, parseNumericValue } from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";

interface PlayerCellProps {
  player: PlayerRow;
  columnName: string;
  initialBudget: number;
}

interface PlayerNote {
  text: string;
  icon: string;
}

type PerceptionStatus = "green" | "red" | "gray";

interface PerceptionResult {
  status: PerceptionStatus;
  description: string;
}

const NOTE_ICON_MAP: Record<string, string> = {
  modificatore: "🏰",
  "imbattibilità": "🧱",
  titolarissimo: "📋",
  scommessa: "🎲",
  pararigori: "❌",
  subentrante: "🔄",
  "rischio infortuni": "🚑",
  bonus: "➕",
  assistman: "👟",
  cartellini: "🟥",
  tiratore: "👟",
  incostante: "📉",
  costante: "📈",
  "tanti gol": "🥅",
  rigorista: "🅿️",
  jolly: "🃏",
  "coppa africa": "🦁",
};

const PERCEPTION_COLORS: Record<PerceptionStatus, string> = {
  green: "#2ecc71",
  red: "#e74c3c",
  gray: "#95a5a6",
};

function normalizeNote(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getPlayerNotes(player: PlayerRow): PlayerNote[] {
  const notes: PlayerNote[] = [];

  for (let index = 1; index <= 5; index += 1) {
    const note = normalizeNote(player[`nota_${index}`]);

    if (!note) {
      continue;
    }

    const normalizedNote = note.toLocaleLowerCase("it");

    notes.push({
      text: note,
      icon: NOTE_ICON_MAP[normalizedNote] ?? "📝",
    });
  }

  return notes;
}

function formatPercentage(value: number): string {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function calculatePerception(
  pma: unknown,
  mediaStrategie: unknown,
): PerceptionResult {
  const pmaValue = parseNumericValue(pma);
  const mediaValue = parseNumericValue(mediaStrategie);

  if (
    pmaValue === null ||
    mediaValue === null ||
    pmaValue === 0 ||
    mediaValue === 0
  ) {
    return {
      status: "gray",
      description: "Dati non disponibili o nulli.",
    };
  }

  if (pmaValue <= mediaValue * 0.9) {
    return {
      status: "green",
      description:
        `PMA ${formatPercentage(pmaValue)}%: ` +
        `inferiore di almeno il 10% rispetto alla media ` +
        `${formatPercentage(mediaValue)}%.`,
    };
  }

  if (pmaValue >= mediaValue * 1.1) {
    return {
      status: "red",
      description:
        `PMA ${formatPercentage(pmaValue)}%: ` +
        `superiore di almeno il 10% rispetto alla media ` +
        `${formatPercentage(mediaValue)}%.`,
    };
  }

  return {
    status: "gray",
    description:
      `PMA ${formatPercentage(pmaValue)}% in linea con la media ` +
      `${formatPercentage(mediaValue)}%.`,
  };
}

export default function PlayerCell({
  player,
  columnName,
  initialBudget,
}: PlayerCellProps) {
  if (columnName === "note") {
    const notes = getPlayerNotes(player);

    if (notes.length === 0) {
      return "-";
    }

    return (
      <span>
        {notes.map((note, index) => (
          <span
            key={`${note.text}-${index}`}
            title={note.text}
            style={noteIconStyle}
          >
            {note.icon}
          </span>
        ))}
      </span>
    );
  }

  if (columnName === "percezione") {
    const perception = calculatePerception(
      player.pma,
      player.media_strategie,
    );

    return (
      <span
        title={perception.description}
        aria-label={perception.description}
        style={{
          ...perceptionDotStyle,
          background: PERCEPTION_COLORS[perception.status],
        }}
      />
    );
  }

  return formatPlayerValue(
    player[columnName],
    columnName,
    initialBudget,
  );
}

const noteIconStyle: CSSProperties = {
  display: "inline-block",
  marginRight: "5px",
  cursor: "help",
};

const perceptionDotStyle: CSSProperties = {
  display: "inline-block",
  width: "13px",
  height: "13px",
  borderRadius: "50%",
  cursor: "help",
};