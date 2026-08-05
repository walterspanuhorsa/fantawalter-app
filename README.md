# Pacchetto identità visiva — FantaConsigliere

Ho scelto **FantaConsigliere** perché mantiene il significato di “Consigliere Fantacalcio”
ma risulta più breve, riconoscibile e adatto a un prodotto.

## File inclusi

- `app/layout.tsx`
  - elimina “Create Next App”
  - imposta titolo, descrizione, Open Graph, Twitter e metadati applicazione
  - mantiene l’inizializzazione del tema chiaro/scuro
- `app/favicon.ico`
  - icona della scheda del browser
- `app/icon.png`
  - icona generale dell’app
- `app/apple-icon.png`
  - icona per iPhone/iPad
- `app/opengraph-image.png`
  - anteprima quando il sito viene condiviso
- `app/twitter-image.png`
  - anteprima per social compatibili con Twitter Cards
- `app/manifest.ts`
  - nome e icone quando il sito viene installato come app
- `app/robots.ts`
  - indicazioni per i motori di ricerca
- `app/sitemap.ts`
  - sitemap delle pagine principali
- `public/icons/*`
  - icone PWA 192×192 e 512×512
- `rimuovi-asset-default-next.ps1`
  - elimina gli SVG dimostrativi generati da Create Next App, soltanto se presenti

## Installazione

Estrai il contenuto nella cartella principale del progetto mantenendo la struttura
delle cartelle. Accetta la sostituzione di `app/layout.tsx` e degli eventuali file
icona esistenti.

Poi, dalla cartella del progetto:

```powershell
powershell -ExecutionPolicy Bypass -File .\rimuovi-asset-default-next.ps1
npm run lint
npm run build
npm run dev
```

## Risultato

Titolo scheda:

`FantaConsigliere – Assistente per l’asta`

Nome applicazione:

`FantaConsigliere`

Descrizione:

`Assistente strategico per l’asta del fantacalcio: confronta i giocatori, valuta i prezzi e costruisci una rosa più equilibrata.`

## Nota sul dominio

I file utilizzano attualmente:

`https://fantawalter-app.vercel.app`

Quando verrà deciso un dominio definitivo, andranno aggiornati `SITE_URL` in
`app/layout.tsx`, `app/robots.ts` e `app/sitemap.ts`.
