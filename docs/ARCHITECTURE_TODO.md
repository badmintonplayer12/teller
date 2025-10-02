# 🏗️ Arkitektur TODO - Forbedringspotensial i BadmintonTeller

Basert på gjennomgang av kodebasen mot arkitekturprinsippene i `ARCHITECTURE.md`.

---

## 🔥 **HØYEST PRIORITET - Kritiske arkitekturproblemer**

### **1. matchView.js - God Object Problem**
- **Problem:** 20 imports, 1190+ linjer, ansvar for alt
- **Brudd på:** Single Responsibility, Separation of Concerns  
- **Gevinst:** Massiv reduksjon i kompleksitet og vedlikeholdbarhet
- **Løsning:** Split i `MatchController`, `MatchUI`, `MatchEvents`
- **Estimat:** 3-5 dager, høy risiko
- **Status:** ⏳ Pending

### **2. Callback Injection Pattern**
- **Problem:** `setControlReadDependencies()`, `setSpectatorDependencies()` etc.
- **Brudd på:** Tight coupling, indirekte koblinger
- **Gevinst:** Løsere kobling, lettere testing
- **Løsning:** Event-basert kommunikasjon eller observables
- **Estimat:** 2-3 dager, medium risiko
- **Status:** ⏳ Pending

### **3. Swap Suppression System**
- **Problem:** `_lastSwapTime`, `SWAP_SUPPRESS_MS` - timing-avhengig
- **Brudd på:** Timing-avhengig kode, symptombehandling
- **Gevinst:** Eliminerer race conditions
- **Løsning:** Bruk disable/enable pattern som vi gjorde for reset
- **Estimat:** 1 dag, lav risiko
- **Status:** ⏳ Pending

---

## 🔥 **HØY PRIORITET - Store arkitekturproblemer**

### **4. Firebase-UI Tight Coupling**
- **Problem:** UI-moduler importerer direkte fra Firebase
- **Brudd på:** Separation of Concerns
- **Gevinst:** Lettere testing, mindre avhengigheter
- **Løsning:** Firebase abstraction layer
- **Estimat:** 2-3 dager, medium risiko
- **Status:** ⏳ Pending

### **5. State Synchronization Chaos**
- **Problem:** Forskjellige patterns i `spectator.js` vs `controlRead.js`
- **Brudd på:** Konsistens, forutsigbarhet
- **Gevinst:** Enhetlig state-håndtering
- **Løsning:** Felles state sync interface
- **Estimat:** 2-3 dager, medium risiko
- **Status:** ⏳ Pending

### **6. Modal System Fragmentering**
- **Problem:** Hver modal har sin egen setup/teardown logikk
- **Brudd på:** DRY, konsistens
- **Gevinst:** Mindre kode, færre bugs
- **Løsning:** Felles modal manager
- **Estimat:** 1-2 dager, lav risiko
- **Status:** ⏳ Pending

---

## 🔥 **MEDIUM PRIORITET - Viktige forbedringer**

### **7. Event Binding Patterns**
- **Problem:** Inkonsistent binding/unbinding på tvers av moduler
- **Brudd på:** Predictable patterns
- **Gevinst:** Færre memory leaks, konsistens
- **Løsning:** Felles event binding interface
- **Estimat:** 1-2 dager, lav risiko
- **Status:** ⏳ Pending

### **8. Error Handling Standardisering**
- **Problem:** `try { } catch(_) {}` overalt, ingen konsistent strategi
- **Brudd på:** Fail fast & graceful degradation
- **Gevinst:** Bedre debugging, mer robust
- **Løsning:** Felles error handling utilities
- **Estimat:** 1-2 dager, lav risiko
- **Status:** ⏳ Pending

### **9. Timing Dependencies Eliminering**
- **Problem:** Mange `setTimeout()` for koordinering
- **Brudd på:** Timing-uavhengig kode
- **Gevinst:** Mer pålitelig, mindre race conditions
- **Løsning:** Promise-baserte patterns
- **Estimat:** 2-3 dager, medium risiko
- **Status:** ⏳ Pending

---

## 🔥 **LAV PRIORITET - Kodekvalitet**

### **10. Code Duplication Eliminering**
- **Problem:** Lignende patterns repetert på tvers av filer
- **Brudd på:** DRY principle
- **Gevinst:** Mindre kode å vedlikeholde
- **Løsning:** Extract common utilities
- **Estimat:** 1-2 dager, lav risiko
- **Status:** ⏳ Pending

---

## 📊 **Anbefalt implementeringsrekkefølge:**

### **Fase 1: Quick Wins (1-2 uker)**
1. **Swap Suppression System** → Anvend reset-pattern
2. **Modal System** → Felles manager
3. **Event Binding** → Konsistente patterns

### **Fase 2: Core Architecture (3-4 uker)**
4. **Callback Injection** → Event-basert kommunikasjon
5. **State Synchronization** → Felles interface
6. **Firebase Coupling** → Abstraction layer

### **Fase 3: The Big One (4-6 uker)**
7. **matchView.js Refaktorering** → Split i moduler

### **Fase 4: Polish (1-2 uker)**
8. **Error Handling** → Standardisering
9. **Timing Dependencies** → Promise-basert
10. **Code Duplication** → Utilities

---

## 🎯 **Suksesskriterier:**

### **Etter Fase 1:**
- ✅ Ingen timing-baserte suppression systems
- ✅ Konsistent modal-håndtering
- ✅ Forutsigbare event patterns

### **Etter Fase 2:**
- ✅ Løs kobling mellom moduler
- ✅ Enhetlig state synchronization
- ✅ Testbar Firebase-integrasjon

### **Etter Fase 3:**
- ✅ matchView.js under 400 linjer
- ✅ Klare ansvarsområder per modul
- ✅ Maksimalt 8 imports per fil

### **Etter Fase 4:**
- ✅ Konsistent error handling
- ✅ Ingen setTimeout-koordinering
- ✅ Minimal code duplication

---

## 💡 **Implementeringstips:**

1. **En oppgave av gangen** - Ikke bland refaktoreringer
2. **Test grundig** - Spesielt state sync og Firebase-integrasjon
3. **Behold funksjonalitet** - Ingen nye features under refaktorering
4. **Dokumenter endringer** - Oppdater REFACTOR_LOG.md
5. **Bruk arkitekturprinsippene** - Referer til ARCHITECTURE.md

---

*Oppdatert: 2025-01-02*  
*Estimert total innsats: 12-18 uker*  
*Forventet gevinst: 80% reduksjon i kompleksitet og vedlikeholdskost*
