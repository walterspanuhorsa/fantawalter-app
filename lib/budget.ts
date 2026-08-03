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

function formatNumber(value: number): string {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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

  const numericValue =
    parseNumericValue(value);

  if (
    isBudgetPercentageColumn(columnName) &&
    numericValue !== null
  ) {
    const credits = calculateCredits(
      numericValue,
      initialBudget,
    );

    return `${credits} crediti (${formatNumber(
      numericValue,
    )}%)`;
  }

  if (
    columnName === "pma" &&
    numericValue !== null
  ) {
    return `${formatNumber(numericValue)}%`;
  }

  return String(value);
}