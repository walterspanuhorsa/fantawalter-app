// Versione 1.1

export function parseNumericValue(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value
    .trim()
    .replace("%", "")
    .replace(",", ".");

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : null;
}

export function isBudgetPercentageColumn(
  columnName: string,
): boolean {
  return (
    columnName === "media_strategie" ||
    columnName === "media_selezionati" ||
    columnName === "pma" ||
    columnName.startsWith("strategia_")
  );
}

export function calculateCredits(
  percentage: number,
  initialBudget: number,
): number {
  return Math.round(
    (percentage * initialBudget) / 100,
  );
}

export function formatPlayerValue(
  value: unknown,
  columnName: string,
  initialBudget: number,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const numericValue = parseNumericValue(value);

  // Il PMA usa -1 come valore sentinella per "dato non disponibile".
  // Qualsiasi PMA non numerico o negativo viene mostrato come trattino
  // e non viene convertito in crediti.
  if (
    columnName === "pma" &&
    (numericValue === null || numericValue < 0)
  ) {
    return "-";
  }

  if (
    isBudgetPercentageColumn(columnName) &&
    numericValue !== null
  ) {
    return calculateCredits(
      numericValue,
      initialBudget,
    ).toLocaleString("it-IT", {
      maximumFractionDigits: 0,
    });
  }

  return String(value);
}
