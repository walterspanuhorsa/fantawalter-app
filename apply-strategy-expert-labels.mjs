#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES = [
  "lib/auction-settings.ts",
  "lib/players.ts",
  "app/page.tsx",
  "app/configurazione/page.tsx",
  "components/auction-assistant.tsx",
  "components/player-tooltip.tsx",
  "components/auction-settings.tsx",
];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`File non trovato: ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function replaceRequired(source, search, replacement, label) {
  const next =
    search instanceof RegExp
      ? source.replace(search, replacement)
      : source.replace(search, replacement);

  if (next === source) {
    throw new Error(`Modifica non applicata: ${label}`);
  }
  return next;
}

function replaceOptional(source, search, replacement) {
  return search instanceof RegExp
    ? source.replace(search, replacement)
    : source.replace(search, replacement);
}

const original = new Map(FILES.map((rel) => [rel, read(rel)]));
const patched = new Map(original);

if (original.get("lib/auction-settings.ts").includes("STRATEGY_LABELS_V1")) {
  console.log("La modifica STRATEGY_LABELS_V1 risulta già applicata.");
  process.exit(0);
}

// -----------------------------------------------------------------------------
// lib/auction-settings.ts
// -----------------------------------------------------------------------------
{
  const rel = "lib/auction-settings.ts";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
    /export interface ColumnDefinition \{\s*key: string;\s*label: string;\s*\}/,
`// STRATEGY_LABELS_V1
export interface StrategyColumnMeta {
  key: string;
  fullLabel: string;
  shortLabel: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  fullLabel?: string;
  shortLabel?: string;
}`,
    `${rel}: metadati colonne strategia`,
  );

  s = replaceRequired(
    s,
    /export function getAllColumns\(\s*strategyColumns: string\[\],\s*\): ColumnDefinition\[\] \{[\s\S]*?\n\}\n\nfunction readPositiveNumber/,
`function getStrategyMetaMap(
  strategyColumnMeta: StrategyColumnMeta[],
): Map<string, StrategyColumnMeta> {
  return new Map(
    strategyColumnMeta.map((item) => [item.key, item]),
  );
}

export function getStrategyFullLabel(
  columnName: string,
  strategyColumnMeta: StrategyColumnMeta[] = [],
): string {
  const meta = getStrategyMetaMap(strategyColumnMeta).get(
    columnName,
  );

  return meta?.fullLabel?.trim() || formatStrategyLabel(columnName);
}

export function getStrategyShortLabel(
  columnName: string,
  strategyColumnMeta: StrategyColumnMeta[] = [],
): string {
  const meta = getStrategyMetaMap(strategyColumnMeta).get(
    columnName,
  );

  return (
    meta?.shortLabel?.trim() ||
    meta?.fullLabel?.trim() ||
    formatStrategyLabel(columnName)
  );
}

export function getAllColumns(
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[] = [],
): ColumnDefinition[] {
  const metaByKey = getStrategyMetaMap(strategyColumnMeta);

  return [
    ...BASE_COLUMNS,
    ...FANTACALCIO_COLUMNS,
    ...strategyColumns.map((columnName) => {
      const meta = metaByKey.get(columnName);
      const fullLabel =
        meta?.fullLabel?.trim() ||
        formatStrategyLabel(columnName);
      const shortLabel =
        meta?.shortLabel?.trim() || fullLabel;

      return {
        key: columnName,
        label: fullLabel,
        fullLabel,
        shortLabel,
      };
    }),
  ];
}

export function getListColumns(
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[] = [],
): ColumnDefinition[] {
  return getAllColumns(
    strategyColumns,
    strategyColumnMeta,
  ).map((column) =>
    column.key.startsWith("strategia_")
      ? {
          ...column,
          label:
            column.shortLabel ||
            column.fullLabel ||
            column.label,
        }
      : column,
  );
}

function readPositiveNumber`,
    `${rel}: getAllColumns/getListColumns`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// lib/players.ts
// -----------------------------------------------------------------------------
{
  const rel = "lib/players.ts";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`  type LeagueSize,
  type PlayerMode,
} from "@/lib/auction-settings";`,
`  type LeagueSize,
  type PlayerMode,
  type StrategyColumnMeta,
} from "@/lib/auction-settings";`,
    `${rel}: import StrategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  budget?: unknown;
  esperto?: unknown;
}`,
`  budget?: unknown;
  esperto?: unknown;
  short_label?: unknown;
}`,
    `${rel}: campo short_label`,
  );

  s = replaceRequired(
    s,
    /export async function loadStrategyColumns\([\s\S]*?\n\}\n\nexport async function loadLastUpdate/,
`function normalizeStrategyLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\\s+/g, " ");
}

export async function loadStrategyColumnMeta(
  requestedMode: PlayerMode | string = "classic",
): Promise<StrategyColumnMeta[]> {
  const mode = resolvePlayerMode(requestedMode);
  const rows = await loadStrategyRows(mode);
  const metaByKey = new Map<string, StrategyColumnMeta>();

  for (const row of rows) {
    const fullLabel = normalizeStrategyLabel(row.esperto);
    const expertSlug = strategySlug(fullLabel);

    if (!fullLabel || !expertSlug) {
      continue;
    }

    const key = \`strategia_\${expertSlug}_\${mode}\`;
    const rawShortLabel = normalizeStrategyLabel(
      row.short_label,
    );
    const existing = metaByKey.get(key);

    if (!existing) {
      metaByKey.set(key, {
        key,
        fullLabel,
        shortLabel: rawShortLabel || fullLabel,
      });
      continue;
    }

    /*
     * Le tabelle contengono normalmente una riga per giocatore:
     * per lo stesso esperto i metadati si ripetono. Se la prima
     * riga non aveva short_label ma una successiva sì, privilegiamo
     * il valore esplicito.
     */
    if (
      existing.shortLabel === existing.fullLabel &&
      rawShortLabel
    ) {
      existing.shortLabel = rawShortLabel;
    }
  }

  return Array.from(metaByKey.values()).sort(
    (first, second) =>
      first.fullLabel.localeCompare(
        second.fullLabel,
        "it",
        { sensitivity: "base" },
      ),
  );
}

export async function loadStrategyColumns(
  requestedMode: PlayerMode | string = "classic",
): Promise<string[]> {
  const metadata = await loadStrategyColumnMeta(
    requestedMode,
  );

  return metadata.map((item) => item.key);
}

export async function loadLastUpdate`,
    `${rel}: loader metadati strategie`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// app/page.tsx
// -----------------------------------------------------------------------------
{
  const rel = "app/page.tsx";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`  getStrategyColumns,
  loadLastUpdate,
  loadPlayers,`,
`  getStrategyColumns,
  loadLastUpdate,
  loadPlayers,
  loadStrategyColumnMeta,`,
    `${rel}: import loadStrategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  const [players, lastUpdate] = await Promise.all([
    loadPlayers({
      playerMode,
      leagueSize,
      defenseModifier,
    }),
    loadLastUpdate(),
  ]);`,
`  const [
    players,
    lastUpdate,
    strategyColumnMeta,
  ] = await Promise.all([
    loadPlayers({
      playerMode,
      leagueSize,
      defenseModifier,
    }),
    loadLastUpdate(),
    loadStrategyColumnMeta(playerMode),
  ]);`,
    `${rel}: caricamento metadati strategie`,
  );

  s = replaceRequired(
    s,
`    strategyColumns={strategyColumns}
    lastUpdate={lastUpdate}`,
`    strategyColumns={strategyColumns}
    strategyColumnMeta={strategyColumnMeta}
    lastUpdate={lastUpdate}`,
    `${rel}: prop strategyColumnMeta`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// app/configurazione/page.tsx
// -----------------------------------------------------------------------------
{
  const rel = "app/configurazione/page.tsx";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`import { loadStrategyColumns } from "@/lib/players";`,
`import {
  loadStrategyColumnMeta,
  loadStrategyColumns,
} from "@/lib/players";`,
    `${rel}: import loader metadati`,
  );

  s = replaceRequired(
    s,
    /const strategyColumns\s*=\s*await loadStrategyColumns\(\s*playerMode,?\s*\);/,
`const [
    strategyColumns,
    strategyColumnMeta,
  ] = await Promise.all([
    loadStrategyColumns(playerMode),
    loadStrategyColumnMeta(playerMode),
  ]);`,
    `${rel}: caricamento colonne + metadati`,
  );

  s = replaceRequired(
    s,
`      strategyColumns={strategyColumns}
      playerMode={playerMode}`,
`      strategyColumns={strategyColumns}
      strategyColumnMeta={strategyColumnMeta}
      playerMode={playerMode}`,
    `${rel}: prop strategyColumnMeta`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// components/auction-assistant.tsx
// -----------------------------------------------------------------------------
{
  const rel = "components/auction-assistant.tsx";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`  getAllColumns,`,
`  getListColumns,`,
    `${rel}: usa getListColumns`,
  );

  s = replaceRequired(
    s,
`  type PlayerMode,
} from "@/lib/auction-settings";`,
`  type PlayerMode,
  type StrategyColumnMeta,
} from "@/lib/auction-settings";`,
    `${rel}: import StrategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  strategyColumns: string[];
  lastUpdate: string | null;`,
`  strategyColumns: string[];
  strategyColumnMeta: StrategyColumnMeta[];
  lastUpdate: string | null;`,
    `${rel}: prop type strategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  initialPlayers,
  strategyColumns,
  lastUpdate,`,
`  initialPlayers,
  strategyColumns,
  strategyColumnMeta,
  lastUpdate,`,
    `${rel}: destructuring strategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  const allColumns = useMemo<ColumnDefinition[]>(
    () => getAllColumns(strategyColumns),
    [strategyColumns],
  );`,
`  const allColumns = useMemo<ColumnDefinition[]>(
    () =>
      getListColumns(
        strategyColumns,
        strategyColumnMeta,
      ),
    [strategyColumns, strategyColumnMeta],
  );`,
    `${rel}: colonne listone con short_label`,
  );

  s = replaceRequired(
    s,
`  if (column.key.startsWith("strategia_")) {
    return \`Prezzo consigliato da \${column.label}, espresso in crediti in base al budget iniziale.\`;
  }`,
`  if (column.key.startsWith("strategia_")) {
    const expertName =
      column.fullLabel ?? column.label;

    return \`Prezzo consigliato da \${expertName}, espresso in crediti in base al budget iniziale.\`;
  }`,
    `${rel}: descrizione con nome esteso`,
  );

  s = replaceRequired(
    s,
`  return \`\${getColumnDescription(column)}\\n\\n\${interactionHelp}\`;`,
`  const expertPrefix =
    column.key.startsWith("strategia_")
      ? \`\${column.fullLabel ?? column.label}\\n\\n\`
      : "";

  return \`\${expertPrefix}\${getColumnDescription(column)}\\n\\n\${interactionHelp}\`;`,
    `${rel}: tooltip header con nome esteso`,
  );

  s = replaceRequired(
    s,
`        strategyColumns={strategyColumns}
        purchasedPlayers={purchasedPlayers}`,
`        strategyColumns={strategyColumns}
        strategyColumnMeta={strategyColumnMeta}
        purchasedPlayers={purchasedPlayers}`,
    `${rel}: passa metadati al PlayerTooltip`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// components/player-tooltip.tsx
// -----------------------------------------------------------------------------
{
  const rel = "components/player-tooltip.tsx";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`import type { PlayerMode } from "@/lib/auction-settings";`,
`import {
  getStrategyFullLabel,
  type PlayerMode,
  type StrategyColumnMeta,
} from "@/lib/auction-settings";`,
    `${rel}: helper nome esteso`,
  );

  s = replaceRequired(
    s,
`  strategyColumns: string[];
  purchasedPlayers: PlayerRow[];`,
`  strategyColumns: string[];
  strategyColumnMeta: StrategyColumnMeta[];
  purchasedPlayers: PlayerRow[];`,
    `${rel}: prop type strategyColumnMeta`,
  );

  s = replaceOptional(
    s,
    /function formatStrategyLabel\(columnName: string\): string \{[\s\S]*?\n\}\n\nfunction normalizeText/,
`function normalizeText`,
  );

  s = replaceRequired(
    s,
`function buildPriceDetails(
  player: PlayerRow,
  strategyColumns: string[],
  initialBudget: number,
): DetailItem[] {`,
`function buildPriceDetails(
  player: PlayerRow,
  strategyColumns: string[],
  strategyColumnMeta: StrategyColumnMeta[],
  initialBudget: number,
): DetailItem[] {`,
    `${rel}: firma buildPriceDetails`,
  );

  s = replaceRequired(
    s,
`      label: formatStrategyLabel(columnName),`,
`      label: getStrategyFullLabel(
        columnName,
        strategyColumnMeta,
      ),`,
    `${rel}: nome esteso nel tooltip giocatore`,
  );

  s = replaceRequired(
    s,
`  initialBudget,
  strategyColumns,
  purchasedPlayers,`,
`  initialBudget,
  strategyColumns,
  strategyColumnMeta,
  purchasedPlayers,`,
    `${rel}: destructuring strategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  const priceAndStrategyDetails = buildPriceDetails(
    player,
    strategyColumns,
    initialBudget,
  );`,
`  const priceAndStrategyDetails = buildPriceDetails(
    player,
    strategyColumns,
    strategyColumnMeta,
    initialBudget,
  );`,
    `${rel}: buildPriceDetails con metadati`,
  );

  patched.set(rel, s);
}

// -----------------------------------------------------------------------------
// components/auction-settings.tsx
// -----------------------------------------------------------------------------
{
  const rel = "components/auction-settings.tsx";
  let s = patched.get(rel);

  s = replaceRequired(
    s,
`  type PlayerMode,
} from "@/lib/auction-settings";`,
`  type PlayerMode,
  type StrategyColumnMeta,
} from "@/lib/auction-settings";`,
    `${rel}: import StrategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`interface AuctionSettingsPanelProps {
  strategyColumns: string[];
  playerMode: PlayerMode;`,
`interface AuctionSettingsPanelProps {
  strategyColumns: string[];
  strategyColumnMeta: StrategyColumnMeta[];
  playerMode: PlayerMode;`,
    `${rel}: prop type strategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`export default function AuctionSettingsPanel({
  strategyColumns,
  playerMode,`,
`export default function AuctionSettingsPanel({
  strategyColumns,
  strategyColumnMeta,
  playerMode,`,
    `${rel}: destructuring strategyColumnMeta`,
  );

  s = replaceRequired(
    s,
`  const allColumns = useMemo(
    () => getAllColumns(strategyColumns),
    [strategyColumns],
  );`,
`  const allColumns = useMemo(
    () =>
      getAllColumns(
        strategyColumns,
        strategyColumnMeta,
      ),
    [strategyColumns, strategyColumnMeta],
  );`,
    `${rel}: configurazione usa nome esteso`,
  );

  patched.set(rel, s);
}

// Tutte le trasformazioni sono riuscite: solo ora creiamo i backup e scriviamo.
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");
const backupRoot = path.join(
  ROOT,
  `backup-strategy-labels-${stamp}`,
);

for (const rel of FILES) {
  const backupPath = path.join(backupRoot, rel);
  fs.mkdirSync(path.dirname(backupPath), {
    recursive: true,
  });
  fs.writeFileSync(
    backupPath,
    original.get(rel),
    "utf8",
  );
}

for (const rel of FILES) {
  fs.writeFileSync(
    path.join(ROOT, rel),
    patched.get(rel),
    "utf8",
  );
}

console.log("");
console.log("Modifica STRATEGY_LABELS_V1 applicata.");
console.log("");
console.log("File aggiornati:");
for (const rel of FILES) {
  console.log(`- ${rel}`);
}
console.log("");
console.log(`Backup: ${path.relative(ROOT, backupRoot)}`);
console.log("");
console.log("Comportamento:");
console.log("- listone: usa short_label;");
console.log("- hover header listone: mostra esperto per esteso;");
console.log("- configurazione e tooltip giocatore: usano esperto per esteso;");
console.log("- se short_label è vuoto, usa esperto come fallback;");
console.log("- le chiavi strategia_* restano invariate.");
console.log("");
console.log("Ora esegui: npm run build");
