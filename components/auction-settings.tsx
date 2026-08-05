"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  clearAuctionData,
  createDefaultAuctionSettings,
  getAllColumns,
  loadPersistedAuctionState,
  resolveAuctionSettings,
  roleLabel,
  saveAuctionSettings,
  type AuctionSettings,
  type ColumnDefinition,
} from "@/lib/auction-settings";
import {
  ROLE_ORDER,
  type PlayerRole,
} from "@/lib/squad";

interface AuctionSettingsPanelProps {
  strategyColumns: string[];
}

function formatPercentage(value: number): string {
  const roundedValue = Math.round(value * 10) / 10;

  return `${roundedValue.toLocaleString("it-IT", {
    maximumFractionDigits: 1,
  })}%`;
}

type SettingsSection =
  | "general"
  | "squad"
  | "table"
  | "reset";

const SETTINGS_SECTIONS: Array<{
  key: SettingsSection;
  label: string;
  description: string;
}> = [
  {
    key: "general",
    label: "Generale",
    description: "Budget e gestione dei prezzi.",
  },
  {
    key: "squad",
    label: "Composizione rosa",
    description: "Numero massimo di giocatori.",
  },
  {
    key: "table",
    label: "Tabella giocatori",
    description: "Colonne visibili nell’asta.",
  },
  {
    key: "reset",
    label: "Ripristino",
    description: "Azzera asta o preferenze.",
  },
];

export default function AuctionSettingsPanel({
  strategyColumns,
}: AuctionSettingsPanelProps) {
  const [settings, setSettings] = useState<AuctionSettings>(
    () => createDefaultAuctionSettings(),
  );
  const [storageReady, setStorageReady] = useState(false);
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
        (column) => !strategyColumnKeySet.has(column.key),
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

  const totalPlannedRoleBudget = ROLE_ORDER.reduce(
    (total, role) => total + settings.roleBudgets[role],
    0,
  );

  const unallocatedRoleBudget =
    settings.initialBudget - totalPlannedRoleBudget;

  const totalPlannedRoleBudgetPercentage =
    settings.initialBudget > 0
      ? (totalPlannedRoleBudget / settings.initialBudget) * 100
      : 0;

  const unallocatedRoleBudgetPercentage =
    100 - totalPlannedRoleBudgetPercentage;

  const totalPlayers = ROLE_ORDER.reduce(
    (total, role) => total + settings.roleLimits[role],
    0,
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const persistedState = loadPersistedAuctionState();

      setSettings(
        resolveAuctionSettings(
          persistedState,
          strategyColumns,
        ),
      );

      setStorageReady(true);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [strategyColumns]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    saveAuctionSettings(settings);
  }, [settings, storageReady]);

  function updateSettings(
    updater: (current: AuctionSettings) => AuctionSettings,
  ): void {
    setSettings((current) => updater(current));
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

  function changeInitialBudget(value: number): void {
    const nextInitialBudget =
      Number.isFinite(value) && value > 0
        ? Math.trunc(value)
        : 1;

    updateSettings((current) => ({
      ...current,
      initialBudget: nextInitialBudget,
    }));
  }

  function changeRoleBudgetPercentage(
    role: PlayerRole,
    percentage: number,
  ): void {
    const normalizedPercentage =
      Number.isFinite(percentage) && percentage >= 0
        ? percentage
        : 0;

    changeRoleBudget(
      role,
      Math.max(
        0,
        Math.round(
          (settings.initialBudget * normalizedPercentage) /
            100,
        ),
      ),
    );
  }

  function getRoleBudgetPercentage(
    role: PlayerRole,
  ): number {
    if (settings.initialBudget <= 0) {
      return 0;
    }

    return (
      (settings.roleBudgets[role] /
        settings.initialBudget) *
      100
    );
  }

  function toggleColumn(columnKey: string): void {
    updateSettings((current) => {
      if (current.visibleColumnKeys.includes(columnKey)) {
        const remainingColumns =
          current.visibleColumnKeys.filter(
            (currentColumnKey) =>
              currentColumnKey !== columnKey,
          );

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
    updateSettings((current) => ({
      ...current,
      visibleColumnKeys: allColumns.map(
        (column) => column.key,
      ),
    }));
  }

  function restoreDefaultColumns(): void {
    const defaults = createDefaultAuctionSettings();

    updateSettings((current) => ({
      ...current,
      visibleColumnKeys: defaults.visibleColumnKeys,
    }));
  }

  function resetAuction(): void {
    const confirmed = window.confirm(
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
    const confirmed = window.confirm(
      "Vuoi ripristinare budget, limiti, budget per ruolo e colonne predefinite? La rosa attuale non verrà cancellata.",
    );

    if (!confirmed) {
      return;
    }

    setSettings(createDefaultAuctionSettings());
  }

  function renderColumnControls(
    columns: ColumnDefinition[],
  ) {
    return columns.map((column) => {
      const isVisible =
        settings.visibleColumnKeys.includes(column.key);

      return (
        <button
          key={column.key}
          type="button"
          onClick={() => toggleColumn(column.key)}
          aria-pressed={isVisible}
          style={{
            ...columnButtonStyle,
            background: isVisible
              ? "var(--fw-accent-soft)"
              : "var(--fw-control-muted-bg)",
            borderColor: isVisible
              ? "var(--fw-accent-border)"
              : "var(--fw-border)",
            color: isVisible
              ? "var(--fw-accent-text)"
              : "var(--fw-control-muted-text)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              ...columnStateDotStyle,
              background: isVisible
                ? "var(--fw-accent)"
                : "var(--fw-text-muted)",
            }}
          />
          {column.label}
        </button>
      );
    });
  }

  function renderGeneralSection() {
    return (
      <>
        <SectionHeader
          title="Generale"
          description="Configura il budget iniziale e gli avvisi basati sui prezzi di acquisto."
        />

        <div style={settingsListStyle}>
          <div className="fantawalter-setting-row" style={settingRowStyle}>
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
              value={settings.initialBudget}
              onChange={(event) => {
                changeInitialBudget(
                  event.currentTarget.valueAsNumber,
                );
              }}
              aria-label="Budget iniziale"
              style={numberControlStyle}
            />
          </div>

          <div className="fantawalter-setting-row" style={settingRowStyle}>
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Registra prezzi di acquisto
              </strong>
              <span style={settingDescriptionStyle}>
                Attiva gli avvisi sulla spesa e richiede il prezzo
                pagato per ogni giocatore acquistato.
              </span>
            </div>

            <button
              type="button"
              aria-pressed={settings.recordPurchasePrice}
              onClick={() =>
                updateSettings((current) => ({
                  ...current,
                  recordPurchasePrice:
                    !current.recordPurchasePrice,
                }))
              }
              style={{
                ...switchButtonStyle,
                ...(settings.recordPurchasePrice
                  ? switchButtonActiveStyle
                  : {}),
              }}
            >
              <span style={switchTrackStyle}>
                <span
                  style={{
                    ...switchThumbStyle,
                    transform: settings.recordPurchasePrice
                      ? "translateX(20px)"
                      : "translateX(0)",
                  }}
                />
              </span>
              <span>
                {settings.recordPurchasePrice
                  ? "Attivo"
                  : "Disattivo"}
              </span>
            </button>
          </div>
        </div>

        {settings.recordPurchasePrice && (
          <section style={subsectionStyle}>
            <div
              className="fantawalter-budget-header"
              style={subsectionHeaderStyle}
            >
              <div>
                <h3 style={subsectionTitleStyle}>
                  Budget per reparto
                </h3>
                <p style={subsectionDescriptionStyle}>
                  Imposta il tetto di spesa in crediti o in
                  percentuale del budget iniziale. I due valori si
                  aggiornano automaticamente.
                </p>
              </div>

              <span
                style={{
                  ...budgetBadgeStyle,
                  ...(unallocatedRoleBudget < 0
                    ? budgetBadgeWarningStyle
                    : {}),
                }}
              >
                {totalPlannedRoleBudget}/
                {settings.initialBudget} ·{" "}
                {formatPercentage(
                  totalPlannedRoleBudgetPercentage,
                )}
              </span>
            </div>

            <div
              className="fantawalter-budget-columns-header"
              aria-hidden="true"
              style={roleBudgetColumnsHeaderStyle}
            >
              <span />
              <span style={roleBudgetColumnLabelStyle}>
                $ Crediti
              </span>
              <span style={roleBudgetColumnLabelStyle}>
                % Budget
              </span>
            </div>

            <div style={roleBudgetListStyle}>
              {ROLE_ORDER.map((role) => {
                const roleBudgetPercentage =
                  getRoleBudgetPercentage(role);

                return (
                  <div
                    key={role}
                    className="fantawalter-role-budget-row"
                    style={roleBudgetRowStyle}
                  >
                    <span style={roleNameStyle}>
                      {roleLabel(role)}
                    </span>

                    <label style={roleBudgetInputWrapStyle}>
                      <span
                        aria-hidden="true"
                        style={roleBudgetPrefixStyle}
                      >
                        $
                      </span>

                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={settings.roleBudgets[role]}
                        onChange={(event) => {
                          const value =
                            event.currentTarget.valueAsNumber;

                          changeRoleBudget(
                            role,
                            Number.isFinite(value)
                              ? Math.max(
                                  0,
                                  Math.trunc(value),
                                )
                              : 0,
                          );
                        }}
                        aria-label={`Budget ${roleLabel(
                          role,
                        )} in crediti`}
                        style={{
                          ...roleBudgetNumberControlStyle,
                          paddingLeft: "30px",
                        }}
                      />
                    </label>

                    <label style={roleBudgetInputWrapStyle}>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={Number(
                          roleBudgetPercentage.toFixed(1),
                        )}
                        onChange={(event) => {
                          changeRoleBudgetPercentage(
                            role,
                            event.currentTarget.valueAsNumber,
                          );
                        }}
                        aria-label={`Budget ${roleLabel(
                          role,
                        )} in percentuale`}
                        style={{
                          ...roleBudgetNumberControlStyle,
                          paddingRight: "30px",
                        }}
                      />

                      <span
                        aria-hidden="true"
                        style={roleBudgetSuffixStyle}
                      >
                        %
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                ...budgetStatusStyle,
                ...(unallocatedRoleBudget < 0
                  ? budgetStatusWarningStyle
                  : {}),
              }}
            >
              {unallocatedRoleBudget > 0 && (
                <>
                  Restano{" "}
                  <strong>{unallocatedRoleBudget}</strong>{" "}
                  crediti non assegnati ·{" "}
                  <strong>
                    {formatPercentage(
                      unallocatedRoleBudgetPercentage,
                    )}
                  </strong>{" "}
                  del budget.
                </>
              )}

              {unallocatedRoleBudget === 0 && (
                <>
                  Il budget è interamente assegnato ·{" "}
                  <strong>100%</strong>.
                </>
              )}

              {unallocatedRoleBudget < 0 && (
                <>
                  Il totale supera il budget iniziale di{" "}
                  <strong>
                    {Math.abs(unallocatedRoleBudget)}
                  </strong>{" "}
                  crediti ·{" "}
                  <strong>
                    {formatPercentage(
                      totalPlannedRoleBudgetPercentage,
                    )}
                  </strong>{" "}
                  assegnato.
                </>
              )}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderSquadSection() {
    return (
      <>
        <SectionHeader
          title="Composizione della rosa"
          description="Definisci il numero massimo di giocatori previsto per ogni ruolo."
          meta={`${totalPlayers} giocatori`}
        />

        <div style={roleLimitsListStyle}>
          {ROLE_ORDER.map((role) => (
            <label
              key={role}
              className="fantawalter-setting-row"
              style={settingRowStyle}
            >
              <div style={settingCopyStyle}>
                <strong style={settingTitleStyle}>
                  {roleLabel(role)}
                </strong>
                <span style={settingDescriptionStyle}>
                  Limite massimo per il ruolo {role}.
                </span>
              </div>

              <input
                type="number"
                min={0}
                step={1}
                value={settings.roleLimits[role]}
                onChange={(event) => {
                  const value =
                    event.currentTarget.valueAsNumber;

                  changeRoleLimit(
                    role,
                    Number.isFinite(value)
                      ? Math.max(0, Math.trunc(value))
                      : 0,
                  );
                }}
                aria-label={`Limite ${roleLabel(role)}`}
                style={numberControlStyle}
              />
            </label>
          ))}
        </div>
      </>
    );
  }

  function renderTableSection() {
    return (
      <>
        <SectionHeader
          title="Tabella giocatori"
          description="Scegli quali colonne mostrare durante l’asta."
          meta={`${settings.visibleColumnKeys.length}/${allColumns.length} visibili`}
        />

        <div style={tableInfoStyle}>
          L’ordine delle colonne si modifica trascinando le
          intestazioni direttamente nella pagina dell’asta.
        </div>

        <div style={utilityButtonsStyle}>
          <button
            type="button"
            onClick={showAllColumns}
            style={secondaryButtonStyle}
          >
            Mostra tutte
          </button>

          <button
            type="button"
            onClick={restoreDefaultColumns}
            style={secondaryButtonStyle}
          >
            Ripristina predefinite
          </button>
        </div>

        <section style={columnSectionStyle}>
          <h3 style={columnSectionTitleStyle}>
            Colonne principali
          </h3>

          <div style={columnButtonsStyle}>
            {renderColumnControls(mainColumns)}
          </div>
        </section>

        <section style={columnSectionStyle}>
          <h3 style={columnSectionTitleStyle}>
            Strategie
          </h3>

          {strategySettingsColumns.length > 0 ? (
            <div style={columnButtonsStyle}>
              {renderColumnControls(
                strategySettingsColumns,
              )}
            </div>
          ) : (
            <p style={emptyTextStyle}>
              Nessuna colonna strategia rilevata.
            </p>
          )}
        </section>
      </>
    );
  }

  function renderResetSection() {
    return (
      <>
        <SectionHeader
          title="Ripristino"
          description="Gestisci separatamente i dati dell’asta e le preferenze dell’interfaccia."
        />

        <div style={resetListStyle}>
          <section
            className="fantawalter-setting-row"
            style={resetItemStyle}
          >
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Azzera asta corrente
              </strong>
              <span style={settingDescriptionStyle}>
                Svuota la rosa, il cestino e i prezzi registrati,
                mantenendo tutte le impostazioni.
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

          <section
            className="fantawalter-setting-row"
            style={resetItemStyle}
          >
            <div style={settingCopyStyle}>
              <strong style={settingTitleStyle}>
                Ripristina impostazioni
              </strong>
              <span style={settingDescriptionStyle}>
                Ripristina budget, limiti e colonne senza
                cancellare i giocatori già acquistati.
              </span>
            </div>

            <button
              type="button"
              onClick={resetPreferences}
              style={secondaryButtonStyle}
            >
              Ripristina impostazioni
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
      case "squad":
        return renderSquadSection();
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
            padding: 8px !important;
          }

          .fantawalter-settings-nav button {
            min-width: max-content !important;
          }
        }

        @media (max-width: 640px) {
          .fantawalter-settings-page {
            padding: 12px !important;
          }

          .fantawalter-settings-header {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .fantawalter-setting-row {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .fantawalter-setting-row input,
          .fantawalter-setting-row button {
            width: 100% !important;
          }

          .fantawalter-budget-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .fantawalter-role-budget-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }

          .fantawalter-budget-columns-header {
            display: none !important;
          }

          .fantawalter-role-budget-row > span:first-child {
            grid-column: 1 / -1 !important;
          }

          .fantawalter-settings-content {
            padding: 18px !important;
          }
        }
      `}</style>

      <div
        className="fantawalter-settings-page"
        style={shellStyle}
      >
        <Link href="/" style={backLinkStyle}>
          ← Torna all’asta
        </Link>

        <header
          className="fantawalter-settings-header"
          style={headerStyle}
        >
          <div>
            <h1 style={titleStyle}>Configurazione</h1>
            <p style={subtitleStyle}>
              Gestisci le impostazioni della tua asta.
            </p>
          </div>

          <span role="status" style={saveStatusStyle}>
            {storageReady
              ? "✓ Modifiche salvate automaticamente"
              : "Caricamento impostazioni…"}
          </span>
        </header>

        <div
          className="fantawalter-settings-layout"
          style={settingsLayoutStyle}
        >
          <nav
            className="fantawalter-settings-nav"
            aria-label="Sezioni configurazione"
            style={navigationStyle}
          >
            {SETTINGS_SECTIONS.map((section) => {
              const isActive =
                activeSection === section.key;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() =>
                    setActiveSection(section.key)
                  }
                  aria-current={
                    isActive ? "page" : undefined
                  }
                  style={{
                    ...navigationButtonStyle,
                    ...(isActive
                      ? navigationButtonActiveStyle
                      : {}),
                  }}
                >
                  <span style={navigationLabelStyle}>
                    {section.label}
                  </span>

                  <span style={navigationDescriptionStyle}>
                    {section.description}
                  </span>
                </button>
              );
            })}
          </nav>

          <section
            className="fantawalter-settings-content"
            style={contentPanelStyle}
          >
            {renderActiveSection()}
          </section>
        </div>
      </div>
    </main>
  );
}

interface SectionHeaderProps {
  title: string;
  description: string;
  meta?: string;
}

function SectionHeader({
  title,
  description,
  meta,
}: SectionHeaderProps) {
  return (
    <header style={sectionHeaderStyle}>
      <div>
        <h2 style={sectionTitleStyle}>{title}</h2>
        <p style={sectionDescriptionStyle}>
          {description}
        </p>
      </div>

      {meta && (
        <span style={sectionMetaStyle}>{meta}</span>
      )}
    </header>
  );
}

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
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-accent-border)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-accent-text)",
  fontSize: "0.92rem",
  fontWeight: 800,
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
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
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-success-border)",
  borderRadius: "999px",
  background: "var(--fw-success-soft)",
  color: "var(--fw-success-text)",
  fontSize: "0.84rem",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const settingsLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "230px minmax(0, 1fr)",
  gap: "16px",
  alignItems: "start",
};

const navigationStyle: CSSProperties = {
  position: "sticky",
  top: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "8px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "10px",
  background: "var(--fw-panel-bg)",
  boxShadow: "var(--fw-shadow-soft)",
};

const navigationButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "3px",
  padding: "11px 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: "7px",
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

const navigationLabelStyle: CSSProperties = {
  fontWeight: 800,
  lineHeight: 1.2,
};

const navigationDescriptionStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.75rem",
  lineHeight: 1.25,
};

const contentPanelStyle: CSSProperties = {
  minWidth: 0,
  minHeight: "520px",
  padding: "26px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "10px",
  background: "var(--fw-panel-bg)",
  boxShadow: "var(--fw-shadow-soft)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  paddingBottom: "18px",
  marginBottom: "6px",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "var(--fw-border-soft)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-heading)",
  fontSize: "1.35rem",
};

const sectionDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--fw-text-muted)",
  fontSize: "0.9rem",
  lineHeight: 1.45,
};

const sectionMetaStyle: CSSProperties = {
  flexShrink: 0,
  padding: "5px 9px",
  borderRadius: "999px",
  background: "var(--fw-accent-soft)",
  color: "var(--fw-accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const settingsListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const settingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  padding: "18px 0",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "var(--fw-border-soft)",
};


const settingCopyStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const settingTitleStyle: CSSProperties = {
  color: "var(--fw-heading)",
  fontSize: "0.96rem",
};

const settingDescriptionStyle: CSSProperties = {
  maxWidth: "560px",
  color: "var(--fw-text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.4,
};

const numberControlStyle: CSSProperties = {
  width: "110px",
  minHeight: "40px",
  flexShrink: 0,
  padding: "7px 10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text)",
  fontSize: "0.95rem",
  textAlign: "right",
  outline: "none",
};

const switchButtonStyle: CSSProperties = {
  minWidth: "126px",
  minHeight: "40px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "9px",
  padding: "6px 10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "999px",
  background: "var(--fw-control-muted-bg)",
  color: "var(--fw-text-secondary)",
  fontWeight: 800,
  cursor: "pointer",
};

const switchButtonActiveStyle: CSSProperties = {
  borderColor: "var(--fw-success-border)",
  background: "var(--fw-success-soft)",
  color: "var(--fw-success-text)",
};

const switchTrackStyle: CSSProperties = {
  width: "42px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  padding: "2px",
  borderRadius: "999px",
  background: "var(--fw-border-strong)",
};

const switchThumbStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  display: "block",
  borderRadius: "50%",
  background: "#ffffff",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.22)",
  transition: "transform 0.18s ease",
};

const subsectionStyle: CSSProperties = {
  marginTop: "24px",
  padding: "18px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "9px",
  background: "var(--fw-panel-soft)",
};

const subsectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  marginBottom: "10px",
};

const roleBudgetColumnsHeaderStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 118px 118px",
  gap: "10px",
  alignItems: "center",
  padding: "0 0 6px",
};

const roleBudgetColumnLabelStyle: CSSProperties = {
  color: "var(--fw-text-muted)",
  fontSize: "0.72rem",
  fontWeight: 800,
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const roleBudgetRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(150px, 1fr) 118px 118px",
  gap: "10px",
  alignItems: "center",
  minHeight: "54px",
  padding: "7px 0",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "#e3e9ee",
};

const roleBudgetInputWrapStyle: CSSProperties = {
  position: "relative",
  display: "block",
  minWidth: 0,
};

const roleBudgetNumberControlStyle: CSSProperties = {
  ...numberControlStyle,
  width: "100%",
  minWidth: 0,
  textAlign: "right",
};

const roleBudgetPrefixStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "10px",
  zIndex: 1,
  transform: "translateY(-50%)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.82rem",
  fontWeight: 900,
  pointerEvents: "none",
};

const roleBudgetSuffixStyle: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "10px",
  transform: "translateY(-50%)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.82rem",
  fontWeight: 900,
  pointerEvents: "none",
};

const subsectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-heading)",
  fontSize: "1.02rem",
};

const subsectionDescriptionStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "var(--fw-text-muted)",
  fontSize: "0.82rem",
};

const budgetBadgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "5px 9px",
  borderRadius: "999px",
  background: "var(--fw-accent-soft)",
  color: "var(--fw-accent-text)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const budgetBadgeWarningStyle: CSSProperties = {
  background: "var(--fw-danger-soft)",
  color: "var(--fw-danger-text)",
};

const roleBudgetListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const roleNameStyle: CSSProperties = {
  color: "var(--fw-text-secondary)",
  fontWeight: 700,
};

const budgetStatusStyle: CSSProperties = {
  marginTop: "14px",
  padding: "10px 12px",
  borderRadius: "7px",
  background: "var(--fw-info-soft)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.84rem",
};

const budgetStatusWarningStyle: CSSProperties = {
  background: "var(--fw-danger-soft)",
  color: "var(--fw-danger-text)",
};

const roleLimitsListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const tableInfoStyle: CSSProperties = {
  margin: "18px 0 14px",
  padding: "11px 12px",
  borderRadius: "7px",
  background: "var(--fw-panel-muted)",
  color: "var(--fw-text-secondary)",
  fontSize: "0.84rem",
  lineHeight: 1.4,
};

const utilityButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "20px",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border-strong)",
  borderRadius: "6px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-text-secondary)",
  fontWeight: 700,
  cursor: "pointer",
};

const columnSectionStyle: CSSProperties = {
  padding: "16px 0",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "var(--fw-border-soft)",
};

const columnSectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  color: "var(--fw-text-secondary)",
  fontSize: "0.95rem",
};

const columnButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const columnButtonStyle: CSSProperties = {
  minHeight: "36px",
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "6px 10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--fw-border)",
  borderRadius: "6px",
  fontWeight: 700,
  cursor: "pointer",
};

const columnStateDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  flexShrink: 0,
  borderRadius: "50%",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-text-muted)",
  fontSize: "0.84rem",
};

const resetListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginTop: "8px",
};

const resetItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  padding: "22px 0",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "var(--fw-border-soft)",
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "38px",
  flexShrink: 0,
  padding: "0 13px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#b63125",
  borderRadius: "6px",
  background: "#c0392b",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};
