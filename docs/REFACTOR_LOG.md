# Refactor Logg (små, trygge PR-er)

Denne filen føres KUN for **refaktorering/rydding** (ikke features). Etter hver liten refaktor-PR:

1. Kjør `npm run loc` i repo-roten.
2. Legg til en rad i tabellen under med **Dato**, **Totale linjer** (tallet fra kommandoen) og en **meget kort** beskrivelse av endringen.
3. Hold forklaringen til én setning. Detaljer hører hjemme i PR-beskrivelsen.

> Tellemåte: `scripts/loc-count.mjs` teller `.js/.ts/.css/.html/.md` rekursivt, ekskluderer `node_modules`, `dist`, `.git`, `assets`, `public`, `.github`, `build`, `coverage`, `.cache`. Juster ved behov.

## Historikk

| Dato       | Totale linjer | Endring                                          | Notat |
|------------|----------------|--------------------------------------------------|-------|
| 2025-09-xx | 5314           | **Baseline**                                     | Utgangspunkt før rydding. |
| 2025-09-xx | 5375           | Refactor-01: felles `ui/modal.js`                | Fokusfelle/scroll-lås samlet; litt engangskost i LOC. |
| 2025-09-xx | 5242           | Refactor-02: felles autocomplete                 | Fjernet duplisering i Navn/Turnering. |
| 2025-09-xx | 5272           | Refactor-03: finish/share → `openModal`          | Backdrop/Esc håndtert sentralt. |
| 2025-09-xx | 5260           | Konsolider ▼-knapp-logikk                        | Én `updateDropdownButtons`. |
| 2025-09-xx | 5287           | Bugfix-runde (dropdown + click-outside)          | Ingen nye features; stabilitet. |
| 2025-09-30 | 5276           | Refactor-04: `matchView` → `saveIndividual`      | Siste direkte `pushPrev` fjernet fra UI. |
| 2025-01-27 | 4909           | Refactor-05: Legg til REFACTOR_LOG + LOC-teller  | Dokumentasjon og verktøy for å spore refaktorer. |
| 2025-01-27 | 4885           | Refactor-06: `bindNameInput` i `matchView`       | Fjernet 6 dupliserte blur-lyttere med felles helper. |
| 2025-01-27 | 4887           | Refactor-07: Fjern ubrukte imports               | Opprydding i 4 UI-filer uten funksjonsendring. |
| 2025-01-27 | 4924           | Feat-01: Lås turneringsoppsett etter start       | Skjul/deaktiver "Tilbake" når turnering er startet. |
| 2025-01-27 | 4942           | Fix-01: "Fortsett turnering" åpner alltid oversikt | Bypass auto-resume til enkeltkamp for turneringsoversikt. |

## Mal for nye rader

> Legg nederst i tabellen, nyeste først.

```
| YYYY-MM-DD | <totale linjer> | Refactor-NN: <kort tittel> | <én kort setning om ryddingen> |
```
