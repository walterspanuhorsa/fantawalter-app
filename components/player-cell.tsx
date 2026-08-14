// Versione 1.14
import type { CSSProperties } from "react";

import { formatPlayerValue, parseNumericValue } from "@/lib/budget";
import type { PlayerRow } from "@/lib/players";

interface PlayerCellProps {
  player: PlayerRow;
  columnName: string;
  initialBudget: number;
}

type PerceptionStatus = "green" | "red" | "gray";

interface PerceptionResult {
  status: PerceptionStatus;
  description: string;
}

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

type NoteTone = "positive" | "negative" | "neutral" | "unknown";

const NOTE_TONE_COLORS: Record<
  NoteTone,
  { border: string; background: string; text: string }
> = {
  positive: {
    border: "#22c55e",
    background: "rgba(34, 197, 94, 0.16)",
    text: "#166534",
  },
  negative: {
    border: "#ef4444",
    background: "rgba(239, 68, 68, 0.16)",
    text: "#991b1b",
  },
  neutral: {
    border: "#38bdf8",
    background: "rgba(56, 189, 248, 0.16)",
    text: "#075985",
  },
  unknown: {
    border: "#94a3b8",
    background: "rgba(148, 163, 184, 0.14)",
    text: "#334155",
  },
};

const POSITIVE_NOTES = new Set([
  "modificatore",
  "imbattibilita",
  "titolarissimo",
  "pararigori",
  "bonus",
  "assistman",
  "assistman o tiratore",
  "tiratore",
  "costante",
  "tanti gol",
  "rigorista",
  "jolly",
]);

const NEGATIVE_NOTES = new Set([
  "subentrante",
  "rischio infortuni",
  "cartellini",
  "incostante",
  "coppa d'africa",
  "copa d'africa",
]);

const NEUTRAL_NOTES = new Set(["scommessa"]);

function normalizeNoteKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("it");
}

function getNoteTone(note: string): NoteTone {
  const normalized = normalizeNoteKey(note);

  if (POSITIVE_NOTES.has(normalized)) {
    return "positive";
  }

  if (NEGATIVE_NOTES.has(normalized)) {
    return "negative";
  }

  if (NEUTRAL_NOTES.has(normalized)) {
    return "neutral";
  }

  return "unknown";
}

function getPlayerNotes(player: PlayerRow): string[] {
  const notes: string[] = [];

  for (let index = 1; index <= 5; index += 1) {
    const note = normalizeNote(player[`nota_${index}`]);

    if (note) {
      notes.push(note);
    }
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
      <span style={notesContainerStyle}>
        {notes.map((note, index) => {
          const tone = getNoteTone(note);
          const colors = NOTE_TONE_COLORS[tone];

          return (
            <span
              key={`${note}-${index}`}
              style={{
                ...noteBadgeStyle,
                borderColor: colors.border,
                background: colors.background,
                color: colors.text,
              }}
            >
              {note}
            </span>
          );
        })}
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

const perceptionDotStyle: CSSProperties = {
  display: "inline-block",
  width: "13px",
  height: "13px",
  borderRadius: "50%",
  cursor: "help",
};
const notesContainerStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "4px",
  verticalAlign: "middle",
};

const noteBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "18px",
  padding: "2px 5px",
  border: "1px solid",
  borderRadius: "5px",
  fontSize: "10px",
  fontWeight: 600,
  lineHeight: 1.15,
  whiteSpace: "nowrap",
};
