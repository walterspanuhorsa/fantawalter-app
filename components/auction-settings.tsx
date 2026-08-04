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

export default function AuctionSettingsPanel({
  strategyColumns,
}: AuctionSettingsPanelProps) {
  const [settings, setSettings] = useState<AuctionSettings>(
    () => createDefaultAuctionSettings(),
  );
  const [storageReady, setStorageReady] = useState(false);

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
            background: isVisible ? "#f1c40f" : "#e2e8ee",
            borderColor: isVisible ? "#d99a00" : "#aeb8c2",
            color: isVisible ? "#222" : "#56616c",
          }}
        >
          {column.label}
        </button>
      );
    });
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @media (max-width: 720px) {
          .fantawalter-settings-page {
            padding: 10px !important;
          }

          .fantawalter-settings-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .fantawalter-settings-grid,
          .fantawalter-role-grid,
          .fantawalter-form-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .fantawalter-settings-actions {
            width: 100% !important;
          }

          .fantawalter-settings-actions a {
            width: 100% !important;
          }
        }
      `}</style>

      <div className="fantawalter-settings-page" style={shellStyle}>
        <header
          className="fantawalter-settings-header"
          style={headerStyle}
        >
          <div>
            <Link href="/" style={backLinkStyle}>
              ← Torna all’asta
            </Link>
            <h1 style={titleStyle}>Configurazione</h1>
            <p style={subtitleStyle}>
              Imposta la lega e personalizza l’interfaccia. Tutte le
              modifiche vengono applicate alla pagina dell’asta.
            </p>
          </div>

          <div
            className="fantawalter-settings-actions"
            style={headerActionsStyle}
          >
            <span role="status" style={saveStatusStyle}>
              {storageReady
                ? "✓ Le modifiche vengono salvate automaticamente"
                : "Caricamento impostazioni…"}
            </span>
          </div>
        </header>

        <div
          className="fantawalter-settings-grid"
          style={settingsGridStyle}
        >
          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Impostazioni dell’asta</h2>
                <p style={cardDescriptionStyle}>
                  Definisci il budget e l’eventuale registrazione dei
                  prezzi reali.
                </p>
              </div>
              <span style={sectionIconStyle}>⚙️</span>
            </div>

            <div className="fantawalter-form-grid" style={formGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Budget iniziale</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={settings.initialBudget}
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;

                    updateSettings((current) => ({
                      ...current,
                      initialBudget:
                        Number.isFinite(value) && value > 0
                          ? Math.trunc(value)
                          : 1,
                    }));
                  }}
                  style={controlStyle}
                />
                <small style={fieldHelpStyle}>
                  Crediti disponibili all’inizio dell’asta.
                </small>
              </label>

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
                  ...toggleCardStyle,
                  ...(settings.recordPurchasePrice
                    ? toggleCardActiveStyle
                    : {}),
                }}
              >
                <span aria-hidden="true" style={toggleIconStyle}>
                  🧾
                </span>
                <span>
                  <strong>Registra prezzi di acquisto</strong>
                  <small style={toggleDescriptionStyle}>
                    Attiva nuovi avvisi basati sulla spesa: dovrai
                    inserire il prezzo pagato per ogni giocatore
                    acquistato.
                  </small>
                </span>
                <span style={toggleStatusStyle}>
                  {settings.recordPurchasePrice ? "Attivo" : "Disattivo"}
                </span>
              </button>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Composizione della rosa</h2>
                <p style={cardDescriptionStyle}>
                  Imposta il numero massimo di giocatori previsto per
                  ciascun ruolo.
                </p>
              </div>
              <span style={sectionIconStyle}>👥</span>
            </div>

            <div
              className="fantawalter-role-grid"
              style={roleGridStyle}
            >
              {ROLE_ORDER.map((role) => (
                <label key={role} style={roleFieldStyle}>
                  <span style={roleLabelStyle}>
                    <strong>{role}</strong>
                    <span>{roleLabel(role)}</span>
                  </span>
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
                    style={roleControlStyle}
                  />
                </label>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Budget per reparto</h2>
                <p style={cardDescriptionStyle}>
                  Imposta un budget per ciascun ruolo per attivare gli
                  avvisi sulla spesa.
                </p>
              </div>
              <span style={plannedBudgetBadgeStyle}>
                {totalPlannedRoleBudget}/{settings.initialBudget}
              </span>
            </div>

            {!settings.recordPurchasePrice ? (
              <div style={disabledNoticeStyle}>
                Attiva “Registra prezzi di acquisto” per utilizzare i
                budget per reparto.
              </div>
            ) : (
              <>
                <div
                  className="fantawalter-role-grid"
                  style={roleGridStyle}
                >
                  {ROLE_ORDER.map((role) => (
                    <label key={role} style={roleBudgetFieldStyle}>
                      <span style={labelStyle}>
                        {role} · {roleLabel(role)}
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
                              ? Math.max(0, Math.trunc(value))
                              : 0,
                          );
                        }}
                        style={controlStyle}
                      />
                    </label>
                  ))}
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
                      Restano <strong>{unallocatedRoleBudget}</strong>{" "}
                      crediti non assegnati.
                    </>
                  )}
                  {unallocatedRoleBudget === 0 && (
                    <>Il budget iniziale è interamente assegnato.</>
                  )}
                  {unallocatedRoleBudget < 0 && (
                    <>
                      La pianificazione supera il budget iniziale di{" "}
                      <strong>{Math.abs(unallocatedRoleBudget)}</strong>{" "}
                      crediti.
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <section style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Tabella giocatori</h2>
                <p style={cardDescriptionStyle}>
                  Scegli le colonne da mostrare nella tabella.
                  Per cambiarne l’ordine, trascina le intestazioni
                  direttamente nella pagina dell’asta.
                </p>
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
            </div>

            <section style={columnGroupStyle}>
              <h3 style={columnGroupTitleStyle}>
                Colonne principali
              </h3>
              <div style={columnButtonsStyle}>
                {renderColumnControls(mainColumns)}
              </div>
            </section>

            <section style={strategyColumnGroupStyle}>
              <h3 style={columnGroupTitleStyle}>Strategie</h3>
              {strategySettingsColumns.length > 0 ? (
                <div style={columnButtonsStyle}>
                  {renderColumnControls(strategySettingsColumns)}
                </div>
              ) : (
                <p style={emptyTextStyle}>
                  Nessuna colonna strategia rilevata.
                </p>
              )}
            </section>
          </section>

          <section style={{ ...cardStyle, ...dangerCardStyle }}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Asta corrente</h2>
                <p style={cardDescriptionStyle}>
                  Svuota la rosa, il cestino e i prezzi registrati,
                  mantenendo tutte le impostazioni.
                </p>
              </div>
              <span style={sectionIconStyle}>🗑️</span>
            </div>
            <button
              type="button"
              onClick={resetAuction}
              style={dangerButtonStyle}
            >
              Azzera asta
            </button>
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={cardTitleStyle}>Impostazioni predefinite</h2>
                <p style={cardDescriptionStyle}>
                  Ripristina budget, limiti e colonne senza cancellare
                  i giocatori già acquistati.
                </p>
              </div>
              <span style={sectionIconStyle}>↺</span>
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
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "#eef2f5",
  color: "#1f2933",
  fontFamily: "Arial, sans-serif",
};

const shellStyle: CSSProperties = {
  maxWidth: "1180px",
  margin: "0 auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "20px",
  marginBottom: "18px",
};

const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "38px",
  marginBottom: "12px",
  padding: "0 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#9ec5df",
  borderRadius: "7px",
  background: "#eaf4fb",
  color: "#1f618d",
  fontSize: "0.92rem",
  fontWeight: 800,
  textDecoration: "none",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#243746",
  fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
};

const subtitleStyle: CSSProperties = {
  maxWidth: "680px",
  margin: "7px 0 0",
  color: "#637381",
  lineHeight: 1.5,
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
};

const saveStatusStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "38px",
  padding: "0 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#a9d8ba",
  borderRadius: "999px",
  background: "#edf9f1",
  color: "#216a3a",
  fontSize: "0.86rem",
  fontWeight: 800,
};

const settingsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

const cardStyle: CSSProperties = {
  minWidth: 0,
  padding: "18px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#d7e0e7",
  borderRadius: "10px",
  background: "#fff",
  boxShadow: "0 3px 12px rgba(35, 55, 70, 0.06)",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  marginBottom: "16px",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: "#2c3e50",
  fontSize: "1.08rem",
};

const cardDescriptionStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#637381",
  fontSize: "0.86rem",
  lineHeight: 1.45,
};

const sectionIconStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: "1.2rem",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 0.65fr) minmax(250px, 1.35fr)",
  gap: "12px",
  alignItems: "stretch",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "#2c3e50",
  fontWeight: 800,
};

const fieldHelpStyle: CSSProperties = {
  marginTop: "6px",
  color: "#71808d",
  fontSize: "0.76rem",
};

const controlStyle: CSSProperties = {
  width: "100%",
  minHeight: "42px",
  padding: "8px 10px",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "#b5c3cf",
  borderRadius: "7px",
  background: "#fff",
  color: "#1f2933",
  fontSize: "0.95rem",
  outline: "none",
};

const toggleCardStyle: CSSProperties = {
  position: "relative",
  minHeight: "88px",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "11px",
  padding: "12px 13px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#c4d0da",
  borderRadius: "8px",
  background: "#f9fbfc",
  color: "#2c3e50",
  textAlign: "left",
  cursor: "pointer",
};

const toggleCardActiveStyle: CSSProperties = {
  borderColor: "#2980b9",
  background: "#eaf4fb",
  boxShadow: "0 0 0 2px rgba(41,128,185,0.1)",
};

const toggleIconStyle: CSSProperties = {
  fontSize: "1.25rem",
};

const toggleDescriptionStyle: CSSProperties = {
  display: "block",
  marginTop: "4px",
  color: "#637381",
  fontSize: "0.78rem",
  fontWeight: 400,
  lineHeight: 1.35,
};

const toggleStatusStyle: CSSProperties = {
  padding: "4px 7px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.8)",
  color: "#2471a3",
  fontSize: "0.72rem",
  fontWeight: 800,
};

const roleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "9px",
};

const roleFieldStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "10px",
  borderRadius: "8px",
  background: "#f7f9fb",
};

const roleLabelStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  color: "#34495e",
  fontSize: "0.8rem",
};

const roleControlStyle: CSSProperties = {
  width: "58px",
  minHeight: "40px",
  padding: "6px",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "#b8c7d3",
  borderRadius: "7px",
  background: "#fff",
  textAlign: "center",
  fontWeight: 700,
};

const roleBudgetFieldStyle: CSSProperties = {
  minWidth: 0,
};

const plannedBudgetBadgeStyle: CSSProperties = {
  flexShrink: 0,
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#eaf4fb",
  color: "#2471a3",
  fontWeight: 800,
  fontSize: "0.82rem",
};

const disabledNoticeStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "7px",
  background: "#f3f5f7",
  color: "#637381",
  fontSize: "0.86rem",
};

const budgetStatusStyle: CSSProperties = {
  marginTop: "12px",
  padding: "9px 11px",
  borderRadius: "7px",
  background: "#f2f8fc",
  color: "#34495e",
  fontSize: "0.84rem",
};

const budgetStatusWarningStyle: CSSProperties = {
  background: "#ffebee",
  color: "#b03a2e",
};

const utilityButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "8px",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "36px",
  padding: "0 11px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#aeb9c3",
  borderRadius: "6px",
  background: "#fff",
  color: "#34495e",
  fontWeight: 700,
  cursor: "pointer",
};

const columnGroupStyle: CSSProperties = {
  padding: "11px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#dfe5ea",
  borderRadius: "8px",
  background: "#fbfcfd",
};

const strategyColumnGroupStyle: CSSProperties = {
  ...columnGroupStyle,
  marginTop: "10px",
  borderColor: "#dccb9f",
  background: "#fffaf0",
};

const columnGroupTitleStyle: CSSProperties = {
  margin: "0 0 9px",
  color: "#34495e",
  fontSize: "0.9rem",
};

const columnButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
};

const columnButtonStyle: CSSProperties = {
  minHeight: "34px",
  padding: "5px 10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "#95a5a6",
  borderRadius: "5px",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#71808d",
  fontSize: "0.84rem",
};

const dangerCardStyle: CSSProperties = {
  borderColor: "#edc4c1",
  background: "#fffafa",
};

const dangerButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 13px",
  border: 0,
  borderRadius: "6px",
  background: "#c0392b",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};
