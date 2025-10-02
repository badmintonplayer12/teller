# BadmintonTeller – ChatGPT Transition Guide

Dette dokumentet forklarer hvordan vi setter opp en ny ChatGPT-tråd når vi jobber videre med utviklingen av BadmintonTeller.

## Instruksjoner til ChatGPT
- Du skal alltid formulere utviklingsoppgaver som **Cursor-prompts** i formatet fra md-filene våre (f.eks. `fix-small.md`, `feature-small.md`).
- Bruk alltid riktig mal (fix-small, feature-small).
- Inkluder: type, tittel, brukerhistorie, akseptanse, scope, tilnærming, test.
- Hold oppgavene **små og isolerte**, så de kan gjøres trinnvis.
- Oppretthold **backward compatibility** og gjør kun additive endringer i Firebase (aldri bryt eksisterende spectator-flyt).
- All skriving skal gå gjennom `safePush` og kun fra `writer`.
- Oversikt/spectator skal alltid være **read-only**.

## Teknologisk kontekst
- **Type prosjekt:** ES5-kompatibel webapp, frontend-only med Firebase RTDB.
- **Struktur:** modulbasert (`js/services`, `js/ui`, `js/state`, `js/utils`).
- **Arbeidsflyt:**
  - Diskusjon og planlegging skjer i ChatGPT.
  - Cursor brukes til implementasjon via `feature-small` og `fix-small`-prompts.
  - Firebase-regler endres kun med additive hvitelister (f.eks. `/writer`, `/permissions`).

## Designprinsipper
- Additive endringer – ikke brekk eksisterende spectator-flyt.
- Kun writer får lov å skrive.
- Ingen init-push i kontroll-modus.
- Bruk `enterMatch/exitMatch`-hooks i match-UI for ryddig mount/unmount.
- All skriving rutes via `safePush` og `mutations.js`.

## Kjente problemområder
- Dobbel-binding av event listeners i match-UI.
- Blink/flimmer i UI ved snapshots.
- Init-push på feil tidspunkt (overstyrer state).
- Skriving spredt i match-fila (for tett kobling).

## Overordnet mål
En webapp som lar frivillige telle badmintonkamper og administrere enkle turneringer. 
Appen skal fungere uten innlogging, støtte QR-koder/tokens for tilgang, og ha spectator/dashboard-visning i hallen.

## Visjon
- Kun én teller (writer) kan ha skrivelås på en kamp av gangen.  
- Andre kan være readers (spectator) men kan overta låsen med en knapp hvis de har riktig token.  
- Turneringer skal ha en live kampoversikt (dashboard) med snapshot av alle kamper.  
- Enkeltkamper skal kunne deles med QR.  

## Refactor-behov (grunnarbeid)
- **Init-push i kontroll:** fjernes, skriv kun når vi har claim’et skrivelås.  
- **Skriving spredt i match-fila:** samles i `mutations.js` + `safePush()`.  
- **Kontroll leser ikke RTDB:** legg til `bindControlReadHandlers(ref)`.  
- **Ingen enter/exit-hooks:** legg til `enterMatch/exitMatch` med cleanup.  
- **Role-gating mangler:** innfør `state.role` (`writer`/`reader`/`observer`).  
- **Echo-loop i writer:** ignorér snapshots som matcher egen siste write (ts/hash).  

## Planlagte funksjoner
### Enkeltkamp delt kontroll (MVP)
- QR-URL: `?mode=match&game=<gid>&match=<mid>&token=<t>`  
- Token gir rettigheter (`permissions/<matchId>/<token> = 'scorer'`).  
- Første åpner blir Writer. Andre blir Reader, men kan trykke **Overta**.  
- Writer kan slippe lås (Bytt til spectator).  
- Reader får disabled scoring/Neste sett/Ferdigstill.  

### Dashboard (turnering)
- Ny URL: `?mode=dashboard&game=<gid>`  
- Lytter på RTDB og viser oversikt.  
- Aktiv kamp leser live scoreA/B, setsA/B fra rotfelter.  
- Andre kamper henter status/sluttsett fra `tournament.matchStates`.  

### Turnerings-snapshot
- Kontroll skriver atomisk `tournament.activeMatchId` og `tournament.matchStates[matchId]`.  
- Snapshot brukes i dashboard, ingen duplisering av live-score.  

### Admin-modus (senere)
- Admin-token gir rettigheter til å generere QR, korrigere poeng, styre permissions.  

### Statistikk/summary (senere)
- `matchMeta` (regler, deltakere).  
- `matchSummary` (status, sets, setScores).  

## Roadmap
1. Refactor grunnmur: safePush, mutations.js, enter/exit-hooks, bindControlReadHandlers, fjern init-push, state.role, echo-guard.  
2. Enkeltkamp delt kontroll: deviceId + token i URL, claimWriter/releaseWriter, UI-rolleindikator, Overta/Bytt til spectator, permissions.  
3. Dashboard + turneringssnapshot.  
4. Admin-modus og QR-generator.  
5. Statistikk/summary og historikk.  
