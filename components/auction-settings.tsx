"use client";

// AUCTION_SETTINGS_BORDER_FIX_V1: evita mix border/borderColor nei pulsanti dinamici.

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  DEFENSE_MODIFIER_COOKIE,
  LEAGUE_SIZE_COOKIE,
  PLAYER_MODE_COOKIE,
  clearAuctionData,
  createDefaultAuctionSettings,
  getAllColumns,
  loadPersistedAuctionState,
  resolveAuctionSettings,
  roleLabel,
  SELECTED_AVERAGE_COLUMN_KEY,
  saveAuctionSettings,
  type AuctionSettings,
  type ColumnDefinition,
  type LeagueSize,
  type PlayerMode,
} from "@/lib/auction-settings";
import {
  ROLE_ORDER,
  type PlayerRole,
} from "@/lib/squad";

interface AuctionSettingsPanelProps {
  strategyColumns: string[];
  playerMode: PlayerMode;
  leagueSize: LeagueSize;
  defenseModifier: boolean;
}

type SettingsSection =
  | "general"
  | "table"
  | "reset";

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  label: string;
  description: string;
}> = [
  {
    key: "general",
    label: "Preferenze lega",
    description:
      "Tipo, partecipanti, rosa e budget.",
  },
  {
    key: "table",
    label: "Tabella listone",
    description: "Colonne visibili nell’asta.",
  },
  {
    key: "reset",
    label: "Ripristino",
    description: "Azzera asta o preferenze.",
  },
];

const COOKIE_MAX_AGE = 31536000;

function formatPercentage(value: number): string {
  const roundedValue = Math.round(value * 10) / 10;

  return `${roundedValue.toLocaleString("it-IT", {
    maximumFractionDigits: 1,
  })}%`;
}

function writeCookie(
  name: string,
  value: string,
): void {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; ` +
    `path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export default function AuctionSettingsPanel({
  strategyColumns,
  playerMode,
  leagueSize,
  defenseModifier,
}: AuctionSettingsPanelProps) {
  const router = useRouter();

  const [settings, setSettings] =
    useState<AuctionSettings>(
      () => createDefaultAuctionSettings(),
    );

  const [storageReady, setStorageReady] =
    useState(false);

  const [columnNotice, setColumnNotice] = useState<{
    tone: "warning" | "success";
    text: string;
  } | null>(null);

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  const allColumns = useMemo(
    () => getAllColumns(strategyColumns),
    [strategyColumns],
  );

  const strategyColumnKeySet = useMemo(
    () => new Set(strategyColumns),
    [strategyColumns],
  );

  const mainColumns = useMemo(
    () =>
      allColumns.filter(
        (column) =>
          !strategyColumnKeySet.has(column.key),
      ),
    [allColumns, strategyColumnKeySet],
  );

  const strategySettingsColumns = useMemo(
    () =>
      allColumns.filter((column) =>
        strategyColumnKeySet.has(column.key),
      ),
    [allColumns, strategyColumnKeySet],
  );

  const selectedStrategyCount = useMemo(
    () =>
      settings.visibleColumnKeys.filter((columnKey) =>
        strategyColumnKeySet.has(columnKey),
      ).length,
    [settings.visibleColumnKeys, strategyColumnKeySet],
  );

  const totalPlannedRoleBudget =
    ROLE_ORDER.reduce(
      (total, role) =>
        total + settings.roleBudgets[role],
      0,
    );

  const unallocatedRoleBudget =
    settings.initialBudget -
    totalPlannedRoleBudget;

  const totalPlannedRoleBudgetPercentage =
    settings.initialBudget > 0
      ? (
          totalPlannedRoleBudget /
          settings.initialBudget
        ) * 100
      : 0;

  const unallocatedRoleBudgetPercentage =
    100 - totalPlannedRoleBudgetPercentage;


  useEffect(() => {
    const animationFrameId =
      window.requestAnimationFrame(() => {
        const persistedState =
          loadPersistedAuctionState();

        const resolved =
          resolveAuctionSettings(
            persistedState,
            strategyColumns,
          );

        /*
         * Le tre preferenze che determinano i dati caricati
         * server-side arrivano dai cookie e sono quindi autorevoli.
         */
        setSettings({
          ...resolved,
          playerMode,
          leagueSize,
          defenseModifier,
        });

        setStorageReady(true);
      });

    return () => {
      window.cancelAnimationFrame(
        animationFrameId,
      );
    };
  }, [
    strategyColumns,
    playerMode,
    leagueSize,
    defenseModifier,
  ]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    saveAuctionSettings(settings);
  }, [settings, storageReady]);

  useEffect(() => {
    if (!columnNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setColumnNotice(null);
    }, 5500);

    return () => window.clearTimeout(timeoutId);
  }, [columnNotice]);

  function updateSettings(
    updater: (
      current: AuctionSettings,
    ) => AuctionSettings,
  ): void {
    setSettings((current) =>
      updater(current),
    );
  }

  function changePlayerMode(
    nextMode: PlayerMode,
  ): void {
    if (
      nextMode === settings.playerMode
    ) {
      return;
    }

    const nextSettings: AuctionSettings = {
      ...settings,
      playerMode: nextMode,
      defenseModifier:
        nextMode === "mantra"
          ? false
          : settings.defenseModifier,

      /*
       * Le colonne dei creator dipendono da Classic/Mantra.
       * Eliminiamo dal salvataggio quelle del vecchio tipo,
       * lasciando inalterate le colonne principali.
       */
      visibleColumnKeys:
        settings.visibleColumnKeys.filter(
          (columnKey) =>
            !columnKey.startsWith(
              "strategia_",
            ) &&
            columnKey !== SELECTED_AVERAGE_COLUMN_KEY,
        ),
      columnOrderKeys:
        settings.columnOrderKeys.filter(
          (columnKey) =>
            !columnKey.startsWith(
              "strategia_",
            ) &&
            columnKey !== SELECTED_AVERAGE_COLUMN_KEY,
        ),
    };

    setSettings(nextSettings);
    writeCookie(
      PLAYER_MODE_COOKIE,
      nextMode,
    );

    if (nextMode === "mantra") {
      writeCookie(
        DEFENSE_MODIFIER_COOKIE,
        "false",
      );
    }

    saveAuctionSettings(nextSettings);

    /*
     * Serve a ricaricare nella pagina Configurazione
     * le colonne strategia del nuovo tipo.
     */
    router.refresh();
  }

  function changeLeagueSize(
    nextLeagueSize: LeagueSize,
  ): void {
    if (
      nextLeagueSize === settings.leagueSize
    ) {
      return;
    }

    const nextSettings = {
      ...settings,
      leagueSize: nextLeagueSize,
    };

    setSettings(nextSettings);
    writeCookie(
      LEAGUE_SIZE_COOKIE,
      String(nextLeagueSize),
    );
    saveAuctionSettings(nextSettings);
    router.refresh();
  }


  function changeDefenseModifier(
    enabled: boolean,
  ): void {
    if (enabled === settings.defenseModifier) {
      return;
    }

    const nextSettings = {
      ...settings,
      defenseModifier: enabled,
    };

    setSettings(nextSettings);
    writeCookie(
      DEFENSE_MODIFIER_COOKIE,
      enabled ? "true" : "false",
    );
    saveAuctionSettings(nextSettings);
  }

  function changeRoleLimit(
    role: PlayerRole,
    value: number,
  ): void {
    updateSettings((current) => ({
      ...current,
      roleLimits: {
        ...current.roleLimits,
        [role]: value,
      },
    }));
  }

  function changeRoleBudget(
    role: PlayerRole,
    value: number,
  ): void {
    updateSettings((current) => ({
      ...current,
      roleBudgets: {
        ...current.roleBudgets,
        [role]: value,
      },
    }));
  }

  function changeInitialBudget(
    value: number,
  ): void {
    const nextInitialBudget =
      Number.isFinite(value) &&
      value > 0
        ? Math.trunc(value)
        : 1;

    updateSettings((current) => ({
      ...current,
      initialBudget:
        nextInitialBudget,
    }));
  }

  function changeRoleBudgetPercentage(
    role: PlayerRole,
    percentage: number,
  ): void {
    const normalizedPercentage =
      Number.isFinite(percentage) &&
      percentage >= 0
        ? percentage
        : 0;

    changeRoleBudget(
      role,
      Math.max(
        0,
        Math.round(
          (
            settings.initialBudget *
            normalizedPercentage
          ) / 100,
        ),
      ),
    );
  }

  function getRoleBudgetPercentage(
    role: PlayerRole,
  ): number {
    if (
      settings.initialBudget <= 0
    ) {
      return 0;
    }

    return (
      (
        settings.roleBudgets[role] /
        settings.initialBudget
      ) * 100
    );
  }

  function toggleColumn(
    columnKey: string,
  ): void {
    const isVisible =
      settings.visibleColumnKeys.includes(columnKey);
    const isStrategy =
      strategyColumnKeySet.has(columnKey);

    if (
      columnKey === SELECTED_AVERAGE_COLUMN_KEY &&
      !isVisible &&
      selectedStrategyCount < 2
    ) {
      setColumnNotice({
        tone: "warning",
        text:
          "La colonna Media Selezionati calcola la media solo degli esperti scelti da te. Per attivarla, seleziona almeno due esperti.",
      });
      return;
    }

    if (
      isStrategy &&
      !isVisible &&
      selectedStrategyCount === 1
    ) {
      setColumnNotice({
        tone: "success",
        text:
          "Hai selezionato almeno due esperti: ora puoi attivare la colonna Media Selezionati nelle Colonne principali.",
      });
    }

    if (
      isStrategy &&
      isVisible &&
      selectedStrategyCount === 2 &&
      settings.visibleColumnKeys.includes(
        SELECTED_AVERAGE_COLUMN_KEY,
      )
    ) {
      setColumnNotice({
        tone: "warning",
        text:
          "Media Selezionati è stata disattivata perché sono rimasti meno di due esperti selezionati.",
      });
    }

    updateSettings((current) => {
      if (current.visibleColumnKeys.includes(columnKey)) {
        let remainingColumns =
          current.visibleColumnKeys.filter(
            (currentColumnKey) =>
              currentColumnKey !== columnKey,
          );

        if (isStrategy) {
          const remainingStrategyCount =
            remainingColumns.filter((currentColumnKey) =>
              strategyColumnKeySet.has(currentColumnKey),
            ).length;

          if (remainingStrategyCount < 2) {
            remainingColumns = remainingColumns.filter(
              (currentColumnKey) =>
                currentColumnKey !==
                SELECTED_AVERAGE_COLUMN_KEY,
            );
          }
        }

        if (remainingColumns.length === 0) {
          return current;
        }

        return {
          ...current,
          visibleColumnKeys: remainingColumns,
        };
      }

      return {
        ...current,
        visibleColumnKeys: [
          ...current.visibleColumnKeys,
          columnKey,
        ],
      };
    });
  }

  function showAllColumns(): void {
    const canEnableSelectedAverage =
      strategyColumns.length >= 2;
    const selectedAverageWasVisible =
      settings.visibleColumnKeys.includes(
        SELECTED_AVERAGE_COLUMN_KEY,
      );

    if (
      selectedStrategyCount < 2 &&
      canEnableSelectedAverage
    ) {
      setColumnNotice({
        tone: "success",
        text:
          "Hai selezionato almeno due esperti: ora puoi attivare la colonna Media Selezionati nelle Colonne principali.",
      });
    }

    updateSettings((current) => ({
      ...current,
      visibleColumnKeys: allColumns
        .map((column) => column.key)
        .filter(
          (columnKey) =>
            columnKey !== SELECTED_AVERAGE_COLUMN_KEY ||
            (canEnableSelectedAverage &&
              selectedAverageWasVisible),
        ),
    }));
  }

  function restoreDefaultColumns(): void {
    const defaults =
      createDefaultAuctionSettings();

    updateSettings((current) => ({
      ...current,
      visibleColumnKeys:
        defaults.visibleColumnKeys,
    }));
  }

  function resetAuction(): void {
    const confirmed =
      window.confirm(
        "Vuoi svuotare la rosa, il cestino e tutti i prezzi registrati? Le impostazioni verranno mantenute.",
      );

    if (!confirmed) {
      return;
    }

    clearAuctionData();

    window.alert(
      "Asta azzerata. Le impostazioni sono state mantenute.",
    );
  }

  function resetPreferences(): void {
    const confirmed =
      window.confirm(
        "Vuoi ripristinare preferenze lega, budget, limiti, budget per ruolo e colonne predefinite? La rosa attuale non verrà cancellata.",
      );

    if (!confirmed) {
      return;
    }

    const defaults =
      createDefaultAuctionSettings();

    setSettings(defaults);

    writeCookie(
      PLAYER_MODE_COOKIE,
      defaults.playerMode,
    );
    writeCookie(
      LEAGUE_SIZE_COOKIE,
      String(defaults.leagueSize),
    );
    writeCookie(
      DEFENSE_MODIFIER_COOKIE,
      defaults.defenseModifier
        ? "true"
        : "false",
    );

    saveAuctionSettings(defaults);
    router.refresh();
  }

  function renderColumnControls(
    columns: ColumnDefinition[],
  ) {
    return columns.map((column) => {
      const isVisible =
        settings.visibleColumnKeys.includes(
          column.key,
        );
      const isSelectedAverageUnavailable =
        column.key === SELECTED_AVERAGE_COLUMN_KEY &&
        selectedStrategyCount < 2;

      return (
        <button
          key={column.key}
          type="button"
          onClick={() =>
            toggleColumn(column.key)
          }
          aria-pressed={isVisible}
          aria-disabled={isSelectedAverageUnavailable}
          title={
            isSelectedAverageUnavailable
              ? "Seleziona almeno due esperti per poter attivare questa colonna."
              : undefined
          }
          style={{
            ...choiceButtonStyle,
            ...(isSelectedAverageUnavailable
              ? choiceButtonUnavailableStyle
              : {}),
            ...(isVisible
              ? choiceButtonActiveStyle
              : {}),
          }}
        >
          {column.label}
        </button>
      );
    });
  }

  function renderGeneralSection() {
    return (
      <>
        <SectionHeader title="Preferenze lega" />

        <div style={settingsStackStyle}>
          <section style={settingBlockStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Tipo di fantacalcio
              </strong>
              <span style={settingDescriptionStyle}>
                Scegli tra modalità Classic e Mantra.
              </span>
            </div>

            <div style={segmentedControlStyle}>
              {(
                [
                  "classic",
                  "mantra",
                ] as PlayerMode[]
              ).map((mode) => {
                const active =
                  settings.playerMode ===
                  mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      changePlayerMode(
                        mode,
                      )
                    }
                    aria-pressed={active}
                    style={{
                      ...segmentButtonStyle,
                      ...(active
                        ? segmentButtonActiveStyle
                        : {}),
                    }}
                  >
                    {mode === "classic"
                      ? "Classic"
                      : "Mantra"}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={settingBlockStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Partecipanti
              </strong>
              <span style={settingDescriptionStyle}>
                Numero di allenatori della lega: determina la PMA utilizzata.
              </span>
            </div>

            <div style={segmentedControlStyle}>
              {(
                [8, 10, 12] as LeagueSize[]
              ).map((size) => {
                const active =
                  settings.leagueSize ===
                  size;

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() =>
                      changeLeagueSize(
                        size,
                      )
                    }
                    aria-pressed={active}
                    style={{
                      ...segmentButtonStyle,
                      ...(active
                        ? segmentButtonActiveStyle
                        : {}),
                    }}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </section>

          {settings.playerMode === "classic" && (
          <section style={settingBlockStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Modificatore difesa
              </strong>
              <span style={settingDescriptionStyle}>
                Indica se nella lega è attivo il modificatore della difesa.
              </span>
            </div>

            <div style={segmentedControlStyle}>
              <button
                type="button"
                onClick={() =>
                  changeDefenseModifier(
                    false,
                  )
                }
                aria-pressed={
                  !settings.defenseModifier
                }
                style={{
                  ...segmentButtonStyle,
                  ...(!settings.defenseModifier
                    ? segmentButtonActiveStyle
                    : {}),
                }}
              >
                No
              </button>

              <button
                type="button"
                onClick={() =>
                  changeDefenseModifier(
                    true,
                  )
                }
                aria-pressed={
                  settings.defenseModifier
                }
                style={{
                  ...segmentButtonStyle,
                  ...(settings.defenseModifier
                    ? segmentButtonActiveStyle
                    : {}),
                }}
              >
                Sì
              </button>
            </div>
          </section>
          )}

          <section style={settingBlockStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Composizione rosa
              </strong>
              <span style={settingDescriptionStyle}>
                Imposta il numero massimo di P, D, C e A acquistabili.
              </span>
            </div>

            <div style={compactRoleLimitsStyle}>
              {ROLE_ORDER.map((role) => (
                <label
                  key={role}
                  style={compactRoleLimitStyle}
                >
                  <span style={compactRoleCodeStyle}>
                    {role}
                  </span>

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      settings.roleLimits[
                        role
                      ]
                    }
                    onChange={(event) => {
                      const value =
                        event.currentTarget
                          .valueAsNumber;

                      changeRoleLimit(
                        role,
                        Number.isFinite(
                          value,
                        )
                          ? Math.max(
                              0,
                              Math.trunc(
                                value,
                              ),
                            )
                          : 0,
                      );
                    }}
                    style={compactRoleInputStyle}
                    aria-label={`Numero massimo ${roleLabel(
                      role,
                    )}`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section style={settingBlockStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Budget iniziale
              </strong>
              <span style={settingDescriptionStyle}>
                Crediti disponibili all’inizio dell’asta.
              </span>
            </div>

            <input
              type="number"
              min={1}
              step={1}
              value={
                settings.initialBudget
              }
              onChange={(event) =>
                changeInitialBudget(
                  event.currentTarget
                    .valueAsNumber,
                )
              }
              style={numberInputStyle}
            />
          </section>

          <section style={settingBlockStyle}>
            <strong style={settingTitleStyle}>
              Registra prezzi di acquisto
            </strong>

            <button
              type="button"
              aria-pressed={
                settings.recordPurchasePrice
              }
              onClick={() =>
                updateSettings(
                  (current) => ({
                    ...current,
                    recordPurchasePrice:
                      !current.recordPurchasePrice,
                  }),
                )
              }
              style={{
                ...toggleButtonStyle,
                ...(settings.recordPurchasePrice
                  ? toggleButtonActiveStyle
                  : {}),
              }}
            >
              {settings.recordPurchasePrice
                ? "Attivo"
                : "Disattivo"}
            </button>
          </section>

          {settings.recordPurchasePrice && (
            <section style={budgetPanelStyle}>
              <div style={budgetHeaderStyle}>
                <div>
                  <strong
                    style={
                      settingTitleStyle
                    }
                  >
                    Budget previsto per
                    ruolo
                  </strong>
                </div>

                <div
                  style={
                    budgetSummaryStyle
                  }
                >
                  <span>
                    Assegnato:{" "}
                    <strong>
                      {
                        totalPlannedRoleBudget
                      }
                    </strong>{" "}
                    (
                    {formatPercentage(
                      totalPlannedRoleBudgetPercentage,
                    )}
                    )
                  </span>

                  <span>
                    Residuo:{" "}
                    <strong>
                      {
                        unallocatedRoleBudget
                      }
                    </strong>{" "}
                    (
                    {formatPercentage(
                      unallocatedRoleBudgetPercentage,
                    )}
                    )
                  </span>
                </div>
              </div>

              <div
                style={roleBudgetGridStyle}
              >
                {ROLE_ORDER.map(
                  (role) => (
                    <div
                      key={role}
                      style={
                        roleBudgetRowStyle
                      }
                    >
                      <div
                        style={
                          roleBudgetLabelStyle
                        }
                      >
                        <strong>
                          {role}
                        </strong>
                        <span>
                          {roleLabel(role)}
                        </span>
                      </div>

                      <label
                        style={
                          compactFieldStyle
                        }
                      >
                        <span>
                          Crediti
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={
                            settings
                              .roleBudgets[
                              role
                            ]
                          }
                          onChange={(
                            event,
                          ) => {
                            const value =
                              event
                                .currentTarget
                                .valueAsNumber;

                            changeRoleBudget(
                              role,
                              Number.isFinite(
                                value,
                              )
                                ? Math.max(
                                    0,
                                    Math.trunc(
                                      value,
                                    ),
                                  )
                                : 0,
                            );
                          }}
                          style={
                            compactInputStyle
                          }
                        />
                      </label>

                      <label
                        style={
                          compactFieldStyle
                        }
                      >
                        <span>
                          %
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={Math.round(
                            getRoleBudgetPercentage(
                              role,
                            ) * 10,
                          ) / 10}
                          onChange={(
                            event,
                          ) =>
                            changeRoleBudgetPercentage(
                              role,
                              event
                                .currentTarget
                                .valueAsNumber,
                            )
                          }
                          style={
                            compactInputStyle
                          }
                        />
                      </label>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </>
    );
  }

  function renderTableSection() {
    return (
      <>
        <SectionHeader
          title="Tabella listone"
          description="Scegli le colonne da mostrare. L’ordine continua a essere gestito trascinando le intestazioni direttamente nella pagina dell’asta."
        />

        <div style={toolbarStyle}>
          <button
            type="button"
            onClick={showAllColumns}
            style={secondaryButtonStyle}
          >
            Mostra tutte
          </button>

          <button
            type="button"
            onClick={
              restoreDefaultColumns
            }
            style={secondaryButtonStyle}
          >
            Rimuovi tutte
          </button>
        </div>

        <ColumnGroup
          title="Colonne principali"
        >
          {renderColumnControls(
            mainColumns,
          )}
        </ColumnGroup>

        {columnNotice && (
          <div
            role="status"
            aria-live="polite"
            style={{
              ...columnNoticeStyle,
              ...(columnNotice.tone === "success"
                ? columnNoticeSuccessStyle
                : columnNoticeWarningStyle),
            }}
          >
            {columnNotice.text}
          </div>
        )}

        <ColumnGroup title="Strategie">
          {strategySettingsColumns.length >
          0 ? (
            renderColumnControls(
              strategySettingsColumns,
            )
          ) : (
            <p style={emptyTextStyle}>
              Nessuna strategia
              disponibile per{" "}
              {settings.playerMode ===
              "classic"
                ? "Classic"
                : "Mantra"}
              .
            </p>
          )}
        </ColumnGroup>
      </>
    );
  }

  function renderResetSection() {
    return (
      <>
        <SectionHeader
          title="Ripristino"
          description="Gestisci separatamente i dati dell’asta e le preferenze."
        />

        <div style={settingsStackStyle}>
          <section
            style={settingBlockStyle}
          >
            <div
              style={settingCopyStyle}
            >
              <strong
                style={settingTitleStyle}
              >
                Azzera asta corrente
              </strong>
              <span
                style={
                  settingDescriptionStyle
                }
              >
                Svuota Rosa, cestino e
                prezzi registrati senza
                cambiare le preferenze.
              </span>
            </div>

            <button
              type="button"
              onClick={resetAuction}
              style={dangerButtonStyle}
            >
              Azzera asta
            </button>
          </section>


        </div>
      </>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "general":
        return renderGeneralSection();
      case "table":
        return renderTableSection();
      case "reset":
        return renderResetSection();
    }
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @media (max-width: 820px) {
          .fantawalter-settings-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .fantawalter-settings-nav {
            position: static !important;
            display: flex !important;
            overflow-x: auto !important;
          }

          .fantawalter-settings-nav button {
            min-width: 190px !important;
          }
        }

        @media (max-width: 640px) {
          .fantawalter-settings-page {
            padding: 12px !important;
          }

          .fantawalter-settings-header,
          .fantawalter-setting-block,
          .fantawalter-budget-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .fantawalter-settings-content {
            padding: 18px !important;
          }

          .fantawalter-role-budget-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }

          .fantawalter-role-budget-label {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>

      <div
        className="fantawalter-settings-page"
        style={shellStyle}
      >
        <Link
          href="/"
          style={backLinkStyle}
        >
          ← Torna all’asta
        </Link>

        <header
          className="fantawalter-settings-header"
          style={headerStyle}
        >
          <div>
            <h1 style={titleStyle}>
              Configurazione
            </h1>
            <p style={subtitleStyle}>
              Gestisci le preferenze
              della tua lega e
              dell’interfaccia.
            </p>
          </div>

          <span
            role="status"
            style={saveStatusStyle}
          >
            {storageReady
              ? "✓ Modifiche salvate automaticamente"
              : "Caricamento impostazioni…"}
          </span>
        </header>

        <div
          className="fantawalter-settings-layout"
          style={layoutStyle}
        >
          <nav
            className="fantawalter-settings-nav"
            aria-label="Sezioni configurazione"
            style={navigationStyle}
          >
            {SETTINGS_SECTIONS.map(
              (section) => {
                const isActive =
                  activeSection ===
                  section.key;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() =>
                      setActiveSection(
                        section.key,
                      )
                    }
                    aria-current={
                      isActive
                        ? "page"
                        : undefined
                    }
                    style={{
                      ...navigationButtonStyle,
                      ...(isActive
                        ? navigationButtonActiveStyle
                        : {}),
                    }}
                  >
                    <strong>
                      {section.label}
                    </strong>
                    <span>
                      {
                        section.description
                      }
                    </span>
                  </button>
                );
              },
            )}
          </nav>

          <section
            className="fantawalter-settings-content"
            style={contentStyle}
          >
            {renderActiveSection()}
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <header
      style={sectionHeaderStyle}
    >
      <div>
        <h2 style={sectionTitleStyle}>
          {title}
        </h2>
        {description && (
          <p
            style={sectionDescriptionStyle}
          >
            {description}
          </p>
        )}
      </div>

      {meta && (
        <span style={metaStyle}>
          {meta}
        </span>
      )}
    </header>
  );
}

function ColumnGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={columnGroupStyle}>
      <h3 style={columnGroupTitleStyle}>
        {title}
      </h3>
      <div style={columnButtonsStyle}>
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
 * STILI
 * ------------------------------------------------------------------ */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "var(--fw-page-bg)",
  color: "var(--fw-text)",
  fontFamily: "Arial, sans-serif",
};

const shellStyle: CSSProperties = {
  maxWidth: "1120px",
  margin: "0 auto",
};

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "38px",
  marginBottom: "18px",
  padding: "0 13px",
  border: "1px solid var(--fw-accent-border)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-accent-text)",
  fontSize: "0.92rem",
  fontWeight: 800,
  textDecoration: "none",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "20px",
  marginBottom: "22px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-heading)",
  fontSize: "clamp(1.9rem, 4vw, 2.55rem)",
  lineHeight: 1.1,
};

const subtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "var(--fw-text-muted)",
  fontSize: "0.96rem",
};

const saveStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "38px",
  padding: "0 13px",
  border: "1px solid var(--fw-success-border)",
  borderRadius: "999px",
  background: "var(--fw-success-soft)",
  color: "var(--fw-success-text)",
  fontSize: "0.84rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const layoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "250px minmax(0, 1fr)",
  gap: "18px",
  alignItems: "start",
};

const navigationStyle: CSSProperties = {
  position: "sticky",
  top: "18px",
  display: "grid",
  gap: "8px",
  padding: "8px",
  border: "1px solid var(--fw-border)",
  borderRadius: "12px",
  background: "var(--fw-panel-bg)",
};

const navigationButtonStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "13px 14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: "9px",
  background: "transparent",
  color: "var(--fw-text-secondary)",
  textAlign: "left",
  cursor: "pointer",
};

const navigationButtonActiveStyle: CSSProperties = {
  borderColor: "var(--fw-accent-border)",
  background: "var(--fw-accent-soft)",
  color: "var(--fw-accent-text)",
};

const contentStyle: CSSProperties = {
  minWidth: 0,
  padding: "24px",
  border: "1px solid var(--fw-border)",
  borderRadius: "12px",
  background: "var(--fw-panel-bg)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  marginBottom: "22px",
  paddingBottom: "18px",
  borderBottom: "1px solid var(--fw-border)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-heading)",
  fontSize: "1.35rem",
};

const sectionDescriptionStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "7px 0 0",
  color: "var(--fw-text-muted)",
  lineHeight: 1.5,
};

const metaStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "var(--fw-control-muted-bg)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.82rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const settingsStackStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const settingBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  padding: "17px",
  border: "1px solid var(--fw-border)",
  borderRadius: "10px",
  background: "var(--fw-card-bg, var(--fw-panel-bg))",
};

const settingCopyStyle: CSSProperties = {
  display: "grid",
  gap: "5px",
};

const settingTitleStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.96rem",
};

const settingDescriptionStyle: CSSProperties = {
  maxWidth: "650px",
  color: "var(--fw-text-muted)",
  fontSize: "0.88rem",
  lineHeight: 1.45,
};

const segmentedControlStyle: CSSProperties = {
  display: "inline-flex",
  gap: "6px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const segmentButtonStyle: CSSProperties = {
  minWidth: "78px",
  minHeight: "40px",
  padding: "0 14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "8px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text-secondary)",
  fontWeight: 800,
  cursor: "pointer",
};

const segmentButtonActiveStyle: CSSProperties = {
  borderColor: "var(--fw-accent-border)",
  background: "var(--fw-accent)",
  color: "#111",
  boxShadow: "0 1px 3px rgba(0,0,0,.12)",
};

const compactRoleLimitsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(72px, 1fr))",
  gap: "8px",
  width: "min(430px, 100%)",
};

const compactRoleLimitStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr)",
  alignItems: "center",
  gap: "5px",
};

const compactRoleCodeStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.88rem",
  fontWeight: 900,
  textAlign: "center",
};

const compactRoleInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: "38px",
  padding: "0 7px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "7px",
  background:
    "var(--fw-input-bg, var(--fw-panel-bg))",
  color: "var(--fw-text)",
  fontWeight: 800,
};

const numberInputStyle: CSSProperties = {
  width: "120px",
  minHeight: "40px",
  padding: "0 10px",
  border: "1px solid var(--fw-border-strong)",
  borderRadius: "8px",
  background: "var(--fw-input-bg, var(--fw-panel-bg))",
  color: "var(--fw-text)",
  fontWeight: 800,
};

const toggleButtonStyle: CSSProperties = {
  minWidth: "110px",
  minHeight: "40px",
  padding: "0 14px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "999px",
  background: "var(--fw-control-muted-bg)",
  color: "var(--fw-control-muted-text)",
  fontWeight: 800,
  cursor: "pointer",
};

const toggleButtonActiveStyle: CSSProperties = {
  borderColor: "var(--fw-success-border)",
  background: "var(--fw-success-soft)",
  color: "var(--fw-success-text)",
};

const budgetPanelStyle: CSSProperties = {
  padding: "17px",
  border: "1px solid var(--fw-border)",
  borderRadius: "10px",
};

const budgetHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "14px",
};


const budgetSummaryStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  color: "var(--fw-text-secondary)",
  fontSize: "0.82rem",
  textAlign: "right",
};

const roleBudgetGridStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const roleBudgetRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1fr) 120px 120px",
  gap: "10px",
  alignItems: "end",
  paddingTop: "8px",
  borderTop: "1px solid var(--fw-border)",
};

const roleBudgetLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "40px",
};

const compactFieldStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  color: "var(--fw-text-muted)",
  fontSize: "0.76rem",
  fontWeight: 700,
};

const compactInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "38px",
  padding: "0 9px",
  border: "1px solid var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-input-bg, var(--fw-panel-bg))",
  color: "var(--fw-text)",
};




const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const columnGroupStyle: CSSProperties = {
  padding: "16px 0",
  borderTop: "1px solid var(--fw-border)",
};

const columnGroupTitleStyle: CSSProperties = {
  margin: "0 0 10px",
  color: "var(--fw-heading)",
  fontSize: "0.94rem",
};

const columnButtonsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const choiceButtonStyle: CSSProperties = {
  minHeight: "36px",
  padding: "0 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "7px",
  background: "var(--fw-control-muted-bg)",
  color: "var(--fw-control-muted-text)",
  fontWeight: 750,
  cursor: "pointer",
};

const choiceButtonActiveStyle: CSSProperties = {
  borderColor: "var(--fw-accent-border)",
  background: "var(--fw-accent-soft)",
  color: "var(--fw-accent-text)",
};

const choiceButtonUnavailableStyle: CSSProperties = {
  opacity: 0.58,
  cursor: "not-allowed",
};

const columnNoticeStyle: CSSProperties = {
  margin: "0 0 12px",
  padding: "11px 13px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "8px",
  fontSize: "0.88rem",
  fontWeight: 700,
  lineHeight: 1.4,
};

const columnNoticeSuccessStyle: CSSProperties = {
  borderColor: "#2e8b57",
  background: "rgba(46, 139, 87, 0.10)",
  color: "var(--fw-text)",
};

const columnNoticeWarningStyle: CSSProperties = {
  borderColor: "#c98212",
  background: "rgba(201, 130, 18, 0.10)",
  color: "var(--fw-text)",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 13px",
  border: "1px solid var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text-secondary)",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "40px",
  padding: "0 14px",
  border: "1px solid #c0392b",
  borderRadius: "7px",
  background: "#e74c3c",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-text-muted)",
  fontSize: "0.9rem",
};
