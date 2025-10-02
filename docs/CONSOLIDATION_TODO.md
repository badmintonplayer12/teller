# 🏸 Konsolidering og Navngiving TODO

Basert på diskusjon om å forenkle spectator/controlRead-systemet og innføre badminton-spesifikke navn.

---

## 🎯 **NAVNGIVING - Anbefaling**

### **Roller (brukervendte):**
- **Counter** - Personen som teller (erstatter "controller")
- **Spectator** - Publikum som ser på (beholdes)
- **Reader** - Counter uten skrivetilgang (ny rolle)

### **Tekniske modi:**
- **Counter mode** - Aktiv telling med skrivetilgang
- **Reader mode** - Passiv telling uten skrivetilgang  
- **Spectator mode** - Kun visning

### **URL-struktur:**
```
// Nåværende:
?mode=spectator    ✅ Beholdes

// Nye:
?mode=counter      (erstatter ?mode=control)
?mode=reader       (ny - counter uten skrivetilgang)

// Med tokens (fremtid):
?token=counter-abc123
?token=reader-abc123
?token=spectator-abc123
```

---

## 🔥 **FASE 1: Navngiving og Konsolidering (1-2 uker)**

### **1.1 Navngiving gjennom kodebasen**
- **Problem:** "control/controller" brukes inkonsistent
- **Løsning:** Erstatt med "counter" overalt
- **Estimat:** 2-3 dager, lav risiko
- **Status:** ⏳ Pending

**Konkrete endringer:**
```javascript
// URL parsing
'control' → 'counter'

// Variabler
controlRead.js → counterSync.js (eller firebaseSync.js)
bindControlReadHandlers → bindCounterSync
setControlReadDependencies → setCounterDependencies

// Kommentarer og dokumentasjon
"kontroll-modus" → "counter-modus"
"control client" → "counter client"
```

### **1.2 Konsolider spectator.js og controlRead.js**
- **Problem:** Duplikasjon av Firebase-lytting logikk
- **Løsning:** Felles firebaseSync.js modul
- **Estimat:** 3-4 dager, medium risiko
- **Status:** ⏳ Pending

**Ny struktur:**
```javascript
// firebaseSync.js (ny fil)
export function bindFirebaseSync(options) {
  const { mode, onUpdate, canWrite } = options;
  // Felles logikk for alle Firebase-lytting
}

// Bruk:
bindFirebaseSync({ mode: 'counter', onUpdate: updateUI, canWrite: true });
bindFirebaseSync({ mode: 'spectator', onUpdate: updateUI, canWrite: false });
bindFirebaseSync({ mode: 'reader', onUpdate: updateUI, canWrite: false });
```

### **1.3 Introduser "Reader" rolle**
- **Problem:** Counter uten skrivetilgang trenger eget navn
- **Løsning:** Ny "reader" rolle
- **Estimat:** 1 dag, lav risiko
- **Status:** ⏳ Pending

**Implementering:**
```javascript
// roles.js (ny fil)
export const ROLES = {
  SPECTATOR: 'spectator',  // Kun visning
  READER: 'reader',        // Counter uten skrivetilgang
  COUNTER: 'counter'       // Counter med skrivetilgang
};

export function getCurrentRole() {
  const mode = getURLMode();
  return ROLES[mode.toUpperCase()] || ROLES.SPECTATOR;
}
```

---

## 🔥 **FASE 2: Security-Ready Architecture (1-2 uker)**

### **2.1 Permission abstraction layer**
- **Problem:** Hardkodet tilgangskontroll spredt i koden
- **Løsning:** Sentral permissions.js modul
- **Estimat:** 2-3 dager, lav risiko
- **Status:** ⏳ Pending

```javascript
// permissions.js (ny fil)
export function canWrite(gameId, action) {
  const role = getCurrentRole();
  const token = getCurrentToken();
  
  // Nå: Enkel rolle-sjekk
  return role === 'counter';
  
  // Senere: Token-basert validering
}

export function canRead(gameId) {
  // Alltid true nå, klar for fremtidige restriksjoner
  return true;
}
```

### **2.2 Token-basert tilgangskontroll (grunnlag)**
- **Problem:** Kun URL-basert tilgangskontroll
- **Løsning:** Token-parsing og lagring
- **Estimat:** 2-3 dager, medium risiko
- **Status:** ⏳ Pending

```javascript
// tokens.js (ny fil)
export function getCurrentToken() {
  return new URLSearchParams(location.search).get('token') || 
         localStorage.getItem('gameToken');
}

export function getTokenRole(token) {
  if (!token) return 'spectator';
  if (token.startsWith('counter-')) return 'counter';
  if (token.startsWith('reader-')) return 'reader';
  return 'spectator';
}
```

### **2.3 Sentral write actions**
- **Problem:** Spredte Firebase-skrivinger
- **Løsning:** Sentral writeActions.js modul
- **Estimat:** 1-2 dager, lav risiko
- **Status:** ⏳ Pending

```javascript
// writeActions.js (ny fil)
export async function writeScore(gameId, side, newScore) {
  if (!canWrite(gameId, 'score')) {
    throw new Error('Unauthorized');
  }
  
  // Nå: Direkte Firebase
  return pushStateNow();
  
  // Senere: Gjennom sikker endpoint med token-validering
}
```

---

## 🔥 **FASE 3: Fremtidig sikkerhet (senere)**

### **3.1 Firebase Security Rules**
- **Problem:** Ingen server-side validering
- **Løsning:** Firebase rules basert på tokens
- **Estimat:** 1-2 dager, medium risiko
- **Status:** 📋 Future

### **3.2 QR-kode generering**
- **Problem:** Vanskelig å dele tilgang
- **Løsning:** QR-koder med embedded tokens
- **Estimat:** 2-3 dager, lav risiko
- **Status:** 📋 Future

### **3.3 Token management**
- **Problem:** Ingen token-administrasjon
- **Løsning:** Admin-interface for token-generering
- **Estimat:** 3-4 dager, medium risiko
- **Status:** 📋 Future

---

## 📊 **Implementeringsrekkefølge:**

### **Uke 1-2: Grunnleggende opprydding**
1. **Navngiving** - controller → counter
2. **Konsolidering** - spectator.js + controlRead.js → firebaseSync.js
3. **Reader rolle** - Ny rolle for counter uten skrivetilgang

### **Uke 3-4: Security-ready**
4. **Permission layer** - Abstraher tilgangskontroll
5. **Token parsing** - Grunnlag for token-system
6. **Write actions** - Sentral skrivetilgang

### **Senere: Full sikkerhet**
7. **Firebase rules** - Server-side validering
8. **QR-koder** - Enkel tilgangsdeling
9. **Token admin** - Administrasjonsgrensesnitt

---

## 🎯 **Suksesskriterier:**

### **Etter Fase 1:**
- ✅ Konsistent "counter" terminologi
- ✅ Én Firebase sync-modul i stedet for to
- ✅ Tydelige roller: spectator/reader/counter

### **Etter Fase 2:**
- ✅ Abstrakt permission-system
- ✅ Token-basert tilgangskontroll (grunnlag)
- ✅ Sentral write-funksjonalitet

### **Etter Fase 3:**
- ✅ Ekte sikkerhet med server-side validering
- ✅ QR-basert tilgangsdeling
- ✅ Komplett token-administrasjon

---

## 💡 **Navngiving - Endelig anbefaling:**

### **Brukervendte termer:**
- **Counter** ✅ (erstatter controller)
- **Spectator** ✅ (beholdes)
- **Reader** ✅ (ny - counter uten skrivetilgang)

### **Tekniske termer:**
- **firebaseSync.js** ✅ (erstatter spectator.js + controlRead.js)
- **permissions.js** ✅ (ny - tilgangskontroll)
- **tokens.js** ✅ (ny - token-håndtering)
- **writeActions.js** ✅ (ny - sikre skrivinger)

### **URL-struktur:**
```
?mode=spectator  ✅ (beholdes)
?mode=counter    ✅ (erstatter control)
?mode=reader     ✅ (ny rolle)

// Fremtid:
?token=counter-abc123
?token=reader-abc123
```

---

*Estimert total tid: 4-6 uker*  
*Hovedgevinst: Enklere arkitektur + security-ready foundation*
