# Refaktor-oppgave (liten og trygg)

**Type:** refactor (se CONTRIBUTING.md)
**Scope:** <angi filer/moduler>
**Mål:**
- Fjern duplisering X ved å flytte til <ny modul/func>
- Behold oppførsel uendret (ingen visuelle endringer)

**Regler:**
- Ikke legg til nye features
- Hold endringen avgrenset og liten
- Gjenbruk helpers (ui/modal, util/dom, state actions)
- Bytt inline styles → CSS-klasser der det er naturlig

**Output:**
- En kompakt diff
- Kort notat om hva som ble endret
- Liten manuell testliste (2–4 punkter)
- Oppdater REFACTOR_LOG.md med ny LOC og refactor-info

**Commit-prosess:**
1. **Etter refactoring:** Lag klar commit-melding med `git add` og `git commit -m "..."` kommandoer
2. **Før commit:** Spør bruker om de vil committe - la bruker teste først
3. **Bruker godkjenner:** Kjør commit-kommandoene
4. **Oppdater REFACTOR_LOG.md** med ny LOC og refactor-info
