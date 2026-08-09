import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Guida | FantaConsigliere",
  description:
    "Guida all'utilizzo di FantaConsigliere per configurare la lega, leggere il listone e gestire l'asta.",
};

export default function GuidePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <div style={topBarStyle}>
          <div>
            <p style={eyebrowStyle}>FantaConsigliere</p>
            <h1 style={titleStyle}>Guida all&apos;utilizzo</h1>
            <p style={subtitleStyle}>
              Configura correttamente la tua lega, prepara il listone e usa
              FantaConsigliere come supporto operativo durante tutta l&apos;asta.
            </p>
          </div>

          <Link href="/" style={backButtonStyle}>
            ← Torna all&apos;asta
          </Link>
        </div>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            1. Prima di iniziare: configura la tua lega
          </h2>

          <p style={paragraphStyle}>
            La prima operazione da effettuare è entrare nella pagina{" "}
            <strong>Configurazione</strong>. Qui puoi indicare le
            caratteristiche fondamentali della tua lega, che determinano anche
            i dati e le funzioni utilizzate nel resto dell&apos;app.
          </p>

          <h3 style={subsectionTitleStyle}>Tipo di Fantacalcio</h3>

          <p style={paragraphStyle}>
            Puoi scegliere tra <strong>Classic</strong> e{" "}
            <strong>Mantra</strong>. La scelta modifica i ruoli visualizzati nel
            listone, i filtri disponibili e i dati utilizzati
            dall&apos;applicazione.
          </p>

          <p style={paragraphStyle}>
            Se scegli la modalità <strong>Classic</strong>, puoi inoltre
            indicare se nella tua lega è previsto il{" "}
            <strong>Modificatore difesa</strong>, impostandolo semplicemente su
            Sì oppure No. Questa opzione non è prevista in modalità Mantra.
          </p>

          <h3 style={subsectionTitleStyle}>Numero di partecipanti</h3>

          <p style={paragraphStyle}>
            Puoi configurare una lega da <strong>8</strong>,{" "}
            <strong>10</strong> oppure <strong>12 o più partecipanti</strong>.
            Il valore 12 viene quindi utilizzato anche per leghe con un numero
            maggiore di partecipanti.
          </p>

          <p style={paragraphStyle}>
            Questa scelta è importante anche per individuare il corretto{" "}
            <strong>PMA</strong>, perché i prezzi medi d&apos;asta utilizzati
            dall&apos;app dipendono dalla numerosità della lega.
          </p>

          <h3 style={subsectionTitleStyle}>Composizione della rosa</h3>

          <p style={paragraphStyle}>
            Nella stessa pagina puoi definire come deve essere composta la tua
            rosa, indicando quanti giocatori devono essere acquistati per
            ciascun ruolo.
          </p>

          <p style={paragraphStyle}>
            Questi valori vengono utilizzati durante l&apos;asta per controllare
            la costruzione della squadra e il completamento dei vari reparti.
          </p>

          <h3 style={subsectionTitleStyle}>Budget iniziale</h3>

          <p style={paragraphStyle}>
            Inserisci infine il <strong>budget iniziale</strong> disponibile per
            la tua asta. Questo valore viene utilizzato come riferimento per i
            prezzi consigliati e, quando viene registrato il prezzo effettivo
            degli acquisti, anche per calcolare il budget residuo.
          </p>

          <Link href="/configurazione" style={primaryLinkStyle}>
            Apri Configurazione →
          </Link>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>2. Configura la tabella del listone</h2>

          <p style={paragraphStyle}>
            Nella sezione dedicata alla configurazione della <strong>"Tabella listone" </strong> puoi
            scegliere quali informazioni visualizzare durante l&apos;asta.
          </p>

          <p style={paragraphStyle}>
            Le colonne informative principali sono abilitate di default. In
            aggiunta puoi attivare manualmente le colonne relative alle singole
            strategie, cioè i prezzi consigliati dai diversi esperti presenti
            nell&apos;app.
          </p>

          <div style={infoGridStyle}>
            <InfoCard
              title="Media degli esperti"
              text="Rappresenta il valore consigliato complessivo ottenuto elaborando i prezzi proposti dagli esperti. Il calcolo riduce l'incidenza dei valori estremi e restituisce un riferimento medio più robusto."
            />

            <InfoCard
              title="PMA"
              text="È il Prezzo Medio d'Asta derivato dalle aste di FantaLab e rappresenta il prezzo medio con cui il giocatore viene effettivamente acquistato."
            />

            <InfoCard
              title="TIT"
              text="La Titolarità indica quanto il giocatore è considerato stabile nelle gerarchie della propria squadra."
            />

            <InfoCard
              title="AFF"
              text="L'Affidabilità indica quanto il giocatore tende a garantire prestazioni regolari e positive."
            />

            <InfoCard
              title="INT"
              text="L'Integrità fornisce un'indicazione sintetica sulla continuità fisica del giocatore e sul rischio di indisponibilità."
            />

            <InfoCard
              title="Note"
              text="Raccoglie in forma sintetica le principali caratteristiche fantacalcistiche del giocatore tramite simboli e indicazioni rapide."
            />

            <InfoCard
              title="Percezione"
              text="Confronta la Media degli esperti con il PMA per evidenziare se il giocatore viene mediamente acquistato a un prezzo inferiore, superiore o in linea con il valore suggerito."
            />
          </div>

          <h3 style={subsectionTitleStyle}>Come leggere la Percezione</h3>

          <p style={paragraphStyle}>
            Se il <strong>PMA è significativamente inferiore</strong> alla Media
            degli esperti, viene mostrato un indicatore{" "}
            <strong style={{ color: "#158e4f" }}>verde</strong>: il giocatore
            viene mediamente acquistato a un prezzo più basso rispetto al valore
            suggerito.
          </p>

          <p style={paragraphStyle}>
            Se invece il <strong>PMA è significativamente superiore</strong> alla
            Media degli esperti, viene mostrato un indicatore{" "}
            <strong style={{ color: "#a12d25" }}>rosso</strong>: il giocatore
            viene mediamente pagato più di quanto suggeriscano le valutazioni
            degli esperti.
          </p>

          <p style={paragraphStyle}>
            Quando i due valori sono sostanzialmente allineati, l&apos;indicatore
            rimane neutro.
          </p>

          <h3 style={subsectionTitleStyle}>Registra prezzi di acquisto</h3>

          <p style={paragraphStyle}>
            La funzione <strong>Registra prezzi di acquisto</strong> permette di
            memorizzare il costo effettivamente sostenuto per ogni giocatore
            inserito nella tua rosa. In questo modo FantaConsigliere può
            aggiornare automaticamente il budget residuo.
          </p>

        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>3. Azzerare l&apos;asta</h2>

          <p style={paragraphStyle}>
            Dalla pagina Configurazione puoi anche utilizzare la funzione{" "}
            <strong>Azzera asta</strong>.
          </p>

          <p style={paragraphStyle}>
            Questa operazione riporta FantaConsigliere allo stato iniziale,
            eliminando lo stato operativo corrente dell&apos;asta e permettendo
            di ripartire da zero.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            4. La pagina principale: il tavolo di lavoro
          </h2>

          <p style={paragraphStyle}>
            Una volta completata la configurazione puoi tornare alla pagina
            principale. Questa è la vera area di lavoro durante l&apos;asta.
          </p>

          <p style={paragraphStyle}>
            La struttura del listone e i ruoli disponibili cambiano
            automaticamente in base alla modalità <strong>Classic</strong> o{" "}
            <strong>Mantra</strong> selezionata.
          </p>

          <h3 style={subsectionTitleStyle}>Filtrare i giocatori</h3>

          <p style={paragraphStyle}>
            In modalità Classic puoi filtrare i giocatori attraverso i ruoli
            tradizionali <strong>P, D, C e A</strong>.
          </p>

          <p style={paragraphStyle}>
            In modalità Mantra vengono invece utilizzati i ruoli specifici
            Mantra e un singolo giocatore può ricoprire più ruoli.
          </p>

          <p style={paragraphStyle}>
            In entrambe le modalità puoi inoltre filtrare per{" "}
            <strong>squadra</strong> oppure cercare direttamente il giocatore
            attraverso il campo <strong>Cerca un giocatore</strong>.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            5. Consultare rapidamente le informazioni di un giocatore
          </h2>

          <p style={paragraphStyle}>
            Quando durante l&apos;asta viene chiamato un giocatore, puoi trovarlo
            nel listone e <strong>passare il mouse sul suo nome</strong> per
            visualizzare una scheda rapida con ulteriori informazioni.
          </p>

          <p style={paragraphStyle}>
            In base ai dati disponibili puoi consultare valori e quotazioni di
            riferimento, la <strong>fantamedia attesa</strong>, le informazioni
            della stagione precedente e altri dati utili per valutare il
            giocatore senza abbandonare la pagina dell&apos;asta.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>6. Gli avvisi strategici</h2>

          <p style={paragraphStyle}>
            Uno degli elementi centrali di FantaConsigliere è il sistema di{" "}
            <strong>avvisi strategici</strong>. Mentre costruisci la tua rosa,
            l&apos;app analizza progressivamente i giocatori acquistati e può
            segnalare situazioni potenzialmente critiche.
          </p>

          <p style={paragraphStyle}>
            Gli avvisi possono essere elaborati sia a livello del{" "}
            <strong>singolo ruolo</strong> sia considerando la{" "}
            <strong>rosa complessiva</strong>.
          </p>

          <div style={infoGridStyle}>
            <InfoCard
              title="Troppi giocatori della stessa squadra"
              text="FantaConsigliere può segnalare una concentrazione eccessiva di giocatori appartenenti alla stessa squadra reale, sia all'interno di un reparto sia nella rosa complessiva."
            />

            <InfoCard
              title="Titolarità bassa"
              text="Se vengono acquistati troppi giocatori con valori TIT bassi, l'app segnala il rischio di avere troppi calciatori con un posto da titolare poco sicuro."
            />

            <InfoCard
              title="Affidabilità bassa"
              text="Una concentrazione elevata di giocatori con AFF bassa può indicare una rosa composta da troppi profili dal rendimento potenzialmente incostante."
            />

            <InfoCard
              title="Integrità bassa"
              text="Troppi giocatori con INT bassa possono aumentare l'esposizione della rosa al rischio di indisponibilità e problemi fisici."
            />
          </div>

          <p style={paragraphStyle}>
            Gli avvisi non impediscono l&apos;acquisto: servono come supporto
            strategico per evidenziare gli effetti della costruzione progressiva
            della tua squadra.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            7. Quando termina l&apos;asta di un giocatore
          </h2>

          <p style={paragraphStyle}>
            Durante la chiamata hai a disposizione nel listone tutte le
            informazioni necessarie per valutare il giocatore: Media degli
            esperti, PMA, TIT, AFF, INT, Note, Percezione ed eventuali strategie
            dei singoli esperti.
          </p>

          <div style={choiceGridStyle}>
            <div style={choiceCardStyle}>
              <span style={choiceIconStyle}>🛒</span>
              <h3 style={choiceTitleStyle}>Hai acquistato il giocatore</h3>
              <p style={choiceTextStyle}>
                Usa il pulsante di acquisto per inserirlo nella tua{" "}
                <strong>Rosa</strong>. Se la registrazione dei prezzi è attiva,
                puoi anche memorizzare il costo effettivamente sostenuto.
              </p>
            </div>

            <div style={choiceCardStyle}>
              <span style={choiceIconStyle}>🗑️</span>
              <h3 style={choiceTitleStyle}>
                È stato acquistato da un avversario
              </h3>
              <p style={choiceTextStyle}>
                Usa il <strong>Cestino</strong> per rimuoverlo dal listone,
                mantenere pulita la lista dei disponibili ed evitare di
                richiamare giocatori che non sono più acquistabili.
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            8. Rosa e cestino non sono definitivi
          </h2>

          <p style={paragraphStyle}>
            Un giocatore inserito nella <strong>Rosa</strong> oppure nel{" "}
            <strong>Cestino</strong> può essere riportato nel listone.
          </p>

          <p style={paragraphStyle}>
            In questo modo puoi correggere rapidamente eventuali errori durante
            l&apos;asta senza dover azzerare l&apos;intera sessione.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            9. Controllare la rosa mentre viene costruita
          </h2>

          <p style={paragraphStyle}>
            Man mano che acquisti giocatori, FantaConsigliere aggiorna la
            sezione dedicata alla <strong>Rosa</strong>.
          </p>

          <p style={paragraphStyle}>
            Oltre all&apos;elenco dei calciatori acquistati, vengono mostrate
            statistiche e informazioni riepilogative che aiutano a valutare
            l&apos;equilibrio della squadra che stai costruendo.
          </p>

          <p style={paragraphStyle}>
            L&apos;obiettivo non è soltanto sapere chi hai acquistato, ma
            controllare durante l&apos;asta come si sta formando la rosa nel suo
            complesso.
          </p>
        </section>

        <div style={footerActionsStyle}>
          <Link href="/configurazione" style={secondaryLinkStyle}>
            ⚙️ Configurazione
          </Link>

          <Link href="/" style={primaryLinkStyle}>
            Vai all&apos;asta →
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div style={infoCardStyle}>
      <strong style={infoCardTitleStyle}>{title}</strong>
      <p style={infoCardTextStyle}>{text}</p>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "28px 18px 48px",
  background: "var(--fw-page-bg)",
  color: "var(--fw-text)",
};

const containerStyle: CSSProperties = {
  width: "min(960px, 100%)",
  margin: "0 auto",
};

const topBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: CSSProperties = {
  margin: "0 0 4px",
  color: "var(--fw-accent)",
  fontSize: "0.82rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-heading)",
  fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
};

const subtitleStyle: CSSProperties = {
  maxWidth: "720px",
  margin: "8px 0 0",
  color: "var(--fw-text-secondary)",
  lineHeight: 1.55,
};

const sectionStyle: CSSProperties = {
  marginBottom: "14px",
  padding: "20px",
  border: "1px solid var(--fw-border)",
  borderRadius: "10px",
  background: "var(--fw-panel-bg)",
  boxShadow: "var(--fw-shadow-soft)",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 14px",
  color: "var(--fw-heading)",
  fontSize: "1.2rem",
};

const subsectionTitleStyle: CSSProperties = {
  margin: "18px 0 7px",
  color: "var(--fw-heading)",
  fontSize: "0.98rem",
};

const paragraphStyle: CSSProperties = {
  margin: "0 0 10px",
  color: "var(--fw-text)",
  lineHeight: 1.65,
};

const noteStyle: CSSProperties = {
  margin: "12px 0 0",
  padding: "10px 12px",
  borderLeft: "4px solid var(--fw-accent)",
  borderRadius: "0 7px 7px 0",
  background: "var(--fw-panel-soft)",
  color: "var(--fw-text-secondary)",
  lineHeight: 1.55,
  fontSize: "0.9rem",
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "10px",
  margin: "14px 0",
};

const infoCardStyle: CSSProperties = {
  padding: "14px",
  border: "1px solid var(--fw-border)",
  borderRadius: "8px",
  background: "var(--fw-panel-soft)",
};

const infoCardTitleStyle: CSSProperties = {
  display: "block",
  marginBottom: "6px",
  color: "var(--fw-heading)",
};

const infoCardTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-text-secondary)",
  lineHeight: 1.55,
  fontSize: "0.9rem",
};

const choiceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "10px",
  marginTop: "14px",
};

const choiceCardStyle: CSSProperties = {
  padding: "16px",
  border: "1px solid var(--fw-border)",
  borderRadius: "8px",
  background: "var(--fw-panel-soft)",
};

const choiceIconStyle: CSSProperties = {
  display: "block",
  marginBottom: "7px",
  fontSize: "1.3rem",
};

const choiceTitleStyle: CSSProperties = {
  margin: "0 0 7px",
  color: "var(--fw-heading)",
  fontSize: "0.98rem",
};

const choiceTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--fw-text-secondary)",
  lineHeight: 1.55,
  fontSize: "0.9rem",
};

const backButtonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 13px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-heading)",
  fontWeight: 800,
  textDecoration: "none",
};

const primaryLinkStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 13px",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "7px",
  background: "var(--fw-accent)",
  color: "#ffffff",
  fontWeight: 800,
  textDecoration: "none",
};

const secondaryLinkStyle: CSSProperties = {
  minHeight: "38px",
  padding: "8px 13px",
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--fw-border-strong)",
  borderRadius: "7px",
  background: "var(--fw-panel-bg)",
  color: "var(--fw-heading)",
  fontWeight: 800,
  textDecoration: "none",
};

const footerActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "20px",
};
