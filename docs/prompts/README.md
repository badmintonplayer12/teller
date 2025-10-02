# Prompt-bruk i BadmintonTeller

Her er oversikt over de ulike prompt-malene vi har laget, og hvordan du skal bruke dem i Cursor.

---

## 1. Refaktor (rydde opp, ingen nye funksjoner)
**Fil:** `docs/prompts/refactor-small.md`  
**Bruk når:** Du vil korte ned kode, fjerne duplisering, flytte logikk til egne moduler.  
**Regler:** Ingen nye features. Diff < 150 linjer. Samme oppførsel som før.  
**Slik bruker du i Cursor:**

```
Bruk @docs/prompts/refactor-small.md
Scope: js/ui/modal.js + bytte i nameModal.js og summary.js
Mål: samle åpne/lukke-logikken for modalene i én felles funksjon.
```

---

## 2. Feature (legge til ny funksjon)
**Fil:** `docs/prompts/feature-small.md`  
**Bruk når:** Du vil bygge en ny knapp, ny flyt, eller endre oppførsel brukeren ser.  
**Regler:** Beskriv en kort brukerhistorie + akseptansekriterier.  
**Slik bruker du i Cursor:**

```
Bruk @docs/prompts/feature-small.md
Brukerhistorie: Som spiller vil jeg se en timer på sett, slik at jeg vet hvor lenge det har vart.
Scope: js/ui/matchView.js
```

---

## 3. Fix (rette en bug)
**Fil:** `docs/prompts/fix-small.md`  
**Bruk når:** En knapp gjør feil ting, feil state settes, eller en annen uønsket oppførsel må rettes.  
**Regler:** Diff < 100 linjer. Ingen nye features.  
**Slik bruker du i Cursor:**
```
Bruk @docs/prompts/fix-small.md
Feil: "Lukk sammendragsmodal låser scroll etter lukking."
Forventet: Scroll skal være frigitt når modal er lukket.
Scope: js/ui/summary.js
```

---

## 4. Generelt tips
- Start alltid med å si hvilken type oppgave det er (`refactor`, `feat`, `fix`).  
- Peker du til en mal (`@docs/prompts/...`), så bruker Cursor reglene der automatisk.  
- Be alltid om en kort testliste tilbake, slik at du kan sjekke manuelt før du merger.
- **Les arkitekturprinsippene:** Se `@docs/ARCHITECTURE.md` for retningslinjer om elegant kode.

---

## 5. Arkitektur og kodestil
**Fil:** `docs/ARCHITECTURE.md`  
**Inneholder:** Prinsipper for elegant, vedlikeholdbar kode i BadmintonTeller.  
**Bruk når:** Du er usikker på hvordan du skal løse et problem, eller vil ha code review-kriterier.

---
