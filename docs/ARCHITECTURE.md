# Arkitekturprinsipper for BadmintonTeller

Dette dokumentet definerer de grunnleggende prinsippene for hvordan kode skal skrives og struktureres i BadmintonTeller-prosjektet.

---

## 🎯 Kjerneprinsipp: Eleganse over kompleksitet

**"Velg alltid den enkleste løsningen som løser problemet fullstendig."**

### ✅ Foretrekk:
- **Enkle, forståelige løsninger** over smarte, komplekse hacks
- **Direkte årsak-virkning** over indirekte koblinger
- **Få moving parts** over mange koordinerte komponenter
- **Tydelig kontrollflyt** over implisitt timing og state

### ❌ Unngå:
- **Symptombehandling** - fiks rotårsaken, ikke symptomene
- **Race condition-patches** - redesign for å eliminere racet
- **Timing-avhengig kode** - bruk promises/callbacks i stedet
- **Cross-module koordinering** - reduser avhengigheter

---

## 🏗️ Arkitekturprinsipper

### 1. **Separation of Concerns**
```javascript
// ✅ Bra: Hver modul har ett ansvar
firebase.js    // Kun Firebase-kommunikasjon
matchView.js   // Kun UI-logikk for kamper
state.js       // Kun state-håndtering

// ❌ Dårlig: Blandet ansvar
matchView.js   // UI + Firebase + state + validering
```

### 2. **Fail Fast & Graceful Degradation**
```javascript
// ✅ Bra: Håndter feil eksplisitt
pushResult
  .then(() => reEnableReads())
  .catch(() => reEnableReads()); // Fortsett selv ved feil

// ❌ Dårlig: Anta at alt går bra
setTimeout(reEnableReads, 200); // Hva hvis push feiler?
```

### 3. **Predictable State Flow**
```javascript
// ✅ Bra: Tydelig rekkefølge
unbindReads() → resetState() → pushState() → bindReads()

// ❌ Dårlig: Timing-avhengig suppression
suppressReads(1000); resetState(); pushState();
```

### 4. **Single Source of Truth**
- **Firebase** er master for delt state
- **Lokal state** er kun for UI-optimering
- **Ved konflikt:** Firebase vinner alltid

---

## 🔧 Praktiske retningslinjer

### **Race Conditions**
```javascript
// ✅ Bra: Disable → Modify → Enable
unbindListener();
modifyState();
pushToServer().then(() => bindListener());

// ❌ Dårlig: Suppression-flags
if (suppressUntil > now) return; // Komplekst og feilpront
```

### **Error Handling**
```javascript
// ✅ Bra: Eksplisitt error-håndtering
try {
  await riskyOperation();
} catch (error) {
  console.warn('Operation failed, continuing:', error);
  fallbackOperation();
}

// ❌ Dårlig: Stille feil
try { riskyOperation(); } catch(_) {} // Skjuler problemer
```

### **Async Operations**
```javascript
// ✅ Bra: Promise-basert med fallback
const result = operation();
if (result?.then) {
  result.then(onSuccess).catch(onError);
} else {
  setTimeout(onSuccess, 300); // Fallback
}

// ❌ Dårlig: Kun timeout
setTimeout(onSuccess, 200); // Hva hvis det tar lengre tid?
```

---

## 📋 Code Review Checklist

Ved code review, spør:

### **Eleganse**
- [ ] Er dette den enkleste løsningen som fungerer?
- [ ] Kan kompleksiteten reduseres uten å miste funksjonalitet?
- [ ] Er årsak-virkning-forholdet tydelig?

### **Robusthet**
- [ ] Håndteres edge cases og feil eksplisitt?
- [ ] Er løsningen timing-uavhengig?
- [ ] Fungerer det ved treg nettverksforbindelse?

### **Vedlikeholdbarhet**
- [ ] Kan en ny utvikler forstå koden uten lang forklaring?
- [ ] Er avhengigheter mellom moduler minimert?
- [ ] Er state-endringer forutsigbare?

---

## 🎯 Eksempler fra prosjektet

### **Bra refaktorering: Firebase race condition**
```javascript
// Før (komplekst): Suppression-flags og timing
notifyStateReset(); // Cross-module koordinering
setTimeout(pushState, 200); // Timing-avhengig

// Etter (elegant): Disable → Modify → Enable
unbindControlRead();
pushStateNow().then(() => bindControlReadHandlers(ref));
```

### **Bra refaktorering: Bump-effekt isolation**
```javascript
// Før (komplekst): DOM-sjekking og suppression
if(elA?.classList.contains('pop') || elB?.classList.contains('pop')) return;

// Etter (elegant): Global flag
if(_bumpInProgress) return;
```

---

## 💡 Når du er i tvil

1. **Start enkelt** - implementer den mest direkte løsningen først
2. **Refaktorer ved behov** - ikke over-engineer på forhånd  
3. **Spør deg selv:** "Vil jeg forstå denne koden om 6 måneder?"
4. **Test edge cases** - spesielt timing og nettverksfeil

---

*"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away." - Antoine de Saint-Exupéry*
