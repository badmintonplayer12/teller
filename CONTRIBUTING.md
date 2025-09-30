# BadmintonTeller – Retningslinjer for endringer

Disse reglene gjelder alle PR-er, spesielt de som lages med AI (Cursor/ChatGPT).

----------------------------------------
## Typer PR
- **refactor:** Rydding/forenkling. *Ingen nye funksjoner* og *ingen endret oppførsel*.
- **feat:** Ny funksjonalitet eller endret brukeropplevelse.
- **fix:** Feilretting uten å endre eksisterende design.

## Krav til ALLE PR-er
- Hold endringen liten og avgrenset. Del heller opp.
- Dokumentér i PR-beskrivelsen:
  - Resultat av `lint` (OK/feil)
  - Linjetall (før/etter), eller et grovt estimat hvis du ikke kjører cloc
- Kort "manuell test"-sjekkliste (hva du trykket på for å verifisere at det virker).

## Ekstra for *refactor*
- **Ingen nye features.** Koden skal gjøre det samme som før, bare være renere.
- Gjenbruk eksisterende helpers (f.eks. `ui/modal`, `util/dom`, state-actions).
- Bytt inline styles til CSS-klasser der det er enkelt.
- Bevar navngiving og offentlige API-er så langt det går.

## Ekstra for *feat*
- Beskriv kort brukerhistorie/scenario ("Som spiller vil jeg …").
- Legg ved enkel test-sjekkliste som viser hva som er nytt.

## Stil
- Bruk modulstruktur (ui/core/util) og unngå duplisering.
- En funksjon = ett ansvar. Korte, tydelige navn.
