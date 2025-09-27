import { state } from '../state/matchState.js';
import { saveLiveState, restoreLiveState, clearLiveState } from '../state/matchState.js';
import { fitScores, queueFit, bumpPlus, bumpMinus, swapSides, setSidesDomTo, clearWinner, isALeft } from './layout.js';
import { readABFromModalInputs, writeModalInputsFromAB, updateNameChips, showNameModal, hideNameModal, updateEditableState, onSaveNames, autocomplete } from './namesModal.js';
import { loadMatches, saveMatches, saveLastNames, pushPrev, getRecentNames } from '../services/storage.js';
import { openShare, closeShare } from './share.js';
import { renderStats, showMatch } from './statsView.js';
import { setupFirebase, getStateForSync, pushStateThrottled, pushStateNow, spectatorShareUrl } from '../services/firebase.js';
import { bindSpectatorHandlers } from '../services/rtdbLive.js';
import { LONGPRESS_MS, MOVE_THRESH } from '../constants.js';
import { $, toast } from './dom.js';

// Set up dependencies for other modules
import { setLayoutDependencies } from './layout.js';
import { setNamesModalDependencies } from './namesModal.js';
import { setRtdbLiveDependencies } from '../services/rtdbLive.js';

export function mount() {
  // Set up cross-module dependencies
  setLayoutDependencies({
    saveLiveState: () => saveLiveState(readABFromModalInputs),
    pushStateThrottled,
    pushStateNow,
    updateNameChips
  });
  
  setNamesModalDependencies({
    saveLastNames
  });
  
  setRtdbLiveDependencies({
    updateScores
  });

  // Initialize Firebase and spectator mode if needed
  setupFirebase();
  
  if (state.IS_SPECTATOR) {
    const gid = new URL(location.href).searchParams.get('game');
    if (gid && window.firebase) {
      const db = firebase.database();
      const ref = db.ref('games/' + gid);
      bindSpectatorHandlers(ref);
    }
  }

  // Set up event listeners
  setupEventListeners();
  
  // Set up resize handlers
  addEventListener('resize', queueFit);
  if (window.visualViewport) visualViewport.addEventListener('resize', queueFit);
  addEventListener('orientationchange', function() { setTimeout(queueFit, 60) });
}

function setupEventListeners() {
  // Long-press and tap bindings
  if (!state.IS_SPECTATOR) {
    bindLongPressOne($('#scoreA'), function() { removePoint('A'); });
    bindLongPressOne($('#scoreB'), function() { removePoint('B'); });
    bindTap($('#scoreA'), function() { addPoint('A'); });
    bindTap($('#scoreB'), function() { addPoint('B'); });
    bindLongPressOne($('#leftArea'), function() { removePointByPosition('left'); });
    bindLongPressOne($('#rightArea'), function() { removePointByPosition('right'); });
    bindTap($('#leftArea'), function() { addPointByPosition('left'); });
    bindTap($('#rightArea'), function() { addPointByPosition('right'); });
  }

  // Name modal bindings
  const cancel = $('#btnCancelNames');
  if (cancel) cancel.addEventListener('click', hideNameModal);
  
  const save = $('#btnSaveNames');
  if (save) save.addEventListener('click', function() { 
    onSaveNames(() => saveLiveState(readABFromModalInputs), pushStateThrottled); 
    hideNameModal(); 
  });
  
  const start = $('#btnStart');
  if (start) start.addEventListener('click', function() { 
    onSaveNames(() => saveLiveState(readABFromModalInputs), pushStateThrottled); 
    state.allowScoring = true; 
    state.nameEditMode = false; 
    saveLiveState(readABFromModalInputs); 
    pushStateThrottled(); 
  });

  // Initialize autocomplete for both name fields
  const nameA = document.getElementById('nameA');
  const nameB = document.getElementById('nameB');
  if (nameA) autocomplete(nameA, 'nameA-list');
  if (nameB) autocomplete(nameB, 'nameB-list');

  // Summary modal bindings
  const closeBtn = document.getElementById('summaryClose');
  const closeSummaryBtn = document.getElementById('btnCloseSummary');
  const newMatchBtn = document.getElementById('btnNewMatch');
  const showSummaryBtn = document.getElementById('showSummaryBtn');
  const mask = document.getElementById('summaryMask');

  if (closeBtn) closeBtn.addEventListener('click', closeSummaryModal);
  if (closeSummaryBtn) closeSummaryBtn.addEventListener('click', closeSummaryModal);
  if (newMatchBtn) newMatchBtn.addEventListener('click', async function() { await closeSummaryModal(); startNewMatch(); });
  if (showSummaryBtn) showSummaryBtn.addEventListener('click', async function() { 
    const n = readABFromModalInputs();
    const nA = n.A, nB = n.B;
    const winnerName = (state.setsA === 2) ? nA : nB;
    await renderSummary(winnerName);
  });
  if (mask) mask.addEventListener('click', async function(e) { if (e.target === mask) await closeSummaryModal(); });

  // Next Set Button bindings
  const ns = document.getElementById('nextSetBtn');
  if (ns) ns.addEventListener('click', async function() { if (!state.IS_SPECTATOR) await advanceToNextSet(); });

  document.addEventListener('keydown', function(e) {
    if (state.IS_SPECTATOR) return;
    if (state.betweenSets && (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'n')) {
      e.preventDefault();
      advanceToNextSet();
    }
  });
}

// Score logic
export function setDigits(sc, p) {
  const t = Math.floor(sc / 10), o = sc % 10;
  const te = $('#' + p + '_tens'), oe = $('#' + p + '_ones');
  if (sc < 10) {
    te.textContent = '0';
    te.classList.add('ghost');
  } else {
    te.textContent = String(t);
    te.classList.remove('ghost');
  }
  oe.textContent = String(o);
}

export function updateScores() {
  setDigits(state.scoreA, 'A'); 
  setDigits(state.scoreB, 'B');

  const cA = document.getElementById('setCounterA');
  const cB = document.getElementById('setCounterB');
  if (cA) { cA.textContent = String(state.setsA); cA.style.display = (state.setsA > 0 ? 'flex' : 'none'); }
  if (cB) { cB.textContent = String(state.setsB); cB.style.display = (state.setsB > 0 ? 'flex' : 'none'); }

  const setsEl = document.getElementById('sets');
  if (setsEl) { setsEl.textContent = 'Sett: ' + state.setsA + '-' + state.setsB; }

  updateEditableState();
  saveLiveState(readABFromModalInputs);
}

export function addPoint(s) {
  if (!state.allowScoring || state.locked || state.swapping || state.IS_SPECTATOR) return;
  if (s === 'A') state.scoreA++; else state.scoreB++;
  maybeSaveNamesOnStart();
  checkSetEnd();
  updateScores();
  bumpPlus($(s === 'A' ? '#scoreA' : '#scoreB'));
  fitScores();
  pushStateThrottled();
}

export function removePoint(s) {
  if (!state.allowScoring || state.locked || state.swapping || state.IS_SPECTATOR) return;
  if (s === 'A' && state.scoreA > 0) state.scoreA--;
  if (s === 'B' && state.scoreB > 0) state.scoreB--;
  updateScores();
  bumpMinus($(s === 'A' ? '#scoreA' : '#scoreB'));
  fitScores();
  pushStateThrottled();
}

export function addPointByPosition(pos) {
  const isA = document.querySelector('.side.left').id === 'sideA';
  addPoint((pos === 'left') ? (isA ? 'A' : 'B') : (isA ? 'B' : 'A'));
}

export function removePointByPosition(pos) {
  const isA = document.querySelector('.side.left').id === 'sideA';
  removePoint((pos === 'left') ? (isA ? 'A' : 'B') : (isA ? 'B' : 'A'));
}

// Set logic
export function pushSetToHistory(a, b) {
  const w = (a > b) ? 'A' : (b > a ? 'B' : '-');
  state.setHistory.push({ set: state.currentSet, a: a, b: b, winner: w });
  console.log('Sett lagret:', { set: state.currentSet, a: a, b: b, winner: w });
  console.log('setHistory nå:', state.setHistory);
  saveLiveState(readABFromModalInputs);
}

export function checkSetEnd() {
  const leadOk = Math.abs(state.scoreA - state.scoreB) >= 2 || state.scoreA === state.cap || state.scoreB === state.cap;

  if ((state.scoreA >= state.target || state.scoreB >= state.target) && leadOk) {
    // Hvem vant settet?
    const winner = (state.scoreA > state.scoreB) ? 'A' : 'B';

    // Logg settet (til historikk/tabell)
    pushSetToHistory(state.scoreA, state.scoreB);

    // Blir kampen avgjort av dette settet?
    const willFinish = (winner === 'A') ? (state.setsA + 1 >= 2) : (state.setsB + 1 >= 2);

    if (willFinish) {
      // Oppdater sett-teller og avslutt kampen NÅ (ingen "Neste sett"-knapp)
      if (winner === 'A') state.setsA++; else state.setsB++;
      state.locked = true; state.betweenSets = false; state.pendingSetWinner = null;

      const n = readABFromModalInputs();
      const wName = (winner === 'A') ? n.A : n.B;
      const lName = (winner === 'A') ? n.B : n.A;

      $('#winnerMsg').textContent =
        '🎉 GRATULERER ' + wName.toUpperCase() + '! DU VANT KAMPEN!\n' +
        '👏 BRA JOBBA ' + lName.toUpperCase() + ', DU GJORDE DITT BESTE.';

      if (winner === 'A') {
        $('#scoreA')?.classList.add('winner');
        $('#nameA_chip')?.classList.add('winnerName');
      } else {
        $('#scoreB')?.classList.add('winner');
        $('#nameB_chip')?.classList.add('winnerName');
      }

      // Vis sammendragsknappen
      const summaryBtn = document.getElementById('showSummaryBtn');
      if (summaryBtn) summaryBtn.style.display = 'block';

      // Lagre kampen i historikk
      const obj = { ts: Date.now(), names: { A: n.A, B: n.B }, sets: state.setHistory.slice(), winner: wName };
      const arr = loadMatches(); arr.unshift(obj); saveMatches(arr); saveLastNames(n.A, n.B);

      updateScores(); fitScores(); saveLiveState(readABFromModalInputs); pushStateThrottled();
      return;
    }

    // --- Sett pause mellom sett (stopp på 21) ---
    // Øk sett-telleren NÅ, men behold 21–x på skjermen
    if (winner === 'A') state.setsA++; else state.setsB++;
    state.pendingSetWinner = winner;
    state.betweenSets = true;
    state.locked = true;

    // Vis "Neste sett" bare i kontroll-modus
    const ns = document.getElementById('nextSetBtn');
    if (ns && !state.IS_SPECTATOR) ns.style.display = 'block';

    updateScores(); fitScores(); saveLiveState(readABFromModalInputs); pushStateThrottled();
    return;
  }

  // Autoswap ved 11 i tredje sett (uendret)
  if (state.currentSet === 3 && !state.swappedAt11 && (state.scoreA === 11 || state.scoreB === 11)) {
    swapSides();
    state.swappedAt11 = true;
  }

  saveLiveState(readABFromModalInputs);
}

export async function advanceToNextSet() {
  if (!state.betweenSets) return;

  // Lås under animasjonen og skjul knappen
  state.locked = true;
  const ns = document.getElementById('nextSetBtn');
  if (ns) ns.style.display = 'none';

  // Forbered ny setttilstand (men ikke rør poeng før etter swap)
  state.currentSet++;
  state.swappedAt11 = false;

  // Use the layout module's swap function
  const { startVisualSwap } = await import('./layout.js');
  startVisualSwap(function afterSwap() {
    // Nå er animasjonen ferdig – nullstill poeng
    state.scoreA = 0;
    state.scoreB = 0;

    state.betweenSets = false;
    state.pendingSetWinner = null;
    state.locked = false;

    updateScores();
    fitScores();
    saveLiveState(readABFromModalInputs);

    // Vent litt lenger enn CSS-transition (1s) før vi sender 0–0 til RTDB
    setTimeout(function() {
      if (typeof pushStateNow === 'function') pushStateNow();
      else pushStateThrottled();
    }, 1050); // justér om du endrer animasjonsvarighet
  });
}

// Reset functions
export function resetSet() {
  state.betweenSets = false; state.pendingSetWinner = null;
  const ns = document.getElementById('nextSetBtn');
  if (ns) ns.style.display = 'none';
  state.scoreA = 0; state.scoreB = 0; state.swappedAt11 = false;
  updateScores(); fitScores(); saveLiveState(readABFromModalInputs); pushStateThrottled();
}

export function startNewMatch() {
  state.betweenSets = false; state.pendingSetWinner = null;
  const ns = document.getElementById('nextSetBtn');
  if (ns) ns.style.display = 'none';
  state.scoreA = 0; state.scoreB = 0; state.setsA = 0; state.setsB = 0; state.currentSet = 1; state.swappedAt11 = false; state.locked = false; state.setHistory = [];
  $('#winnerMsg').textContent = '';
  clearWinner(); closeSummaryModal();
  const summaryBtn = document.getElementById('showSummaryBtn');
  if (summaryBtn) summaryBtn.style.display = 'none';
  document.body.classList.remove('areas-active');
  state.allowScoring = false; state.nameEditMode = false;
  updateEditableState(); updateScores(); fitScores(); saveLiveState(readABFromModalInputs); pushStateThrottled();
  showNameModal(true);
}

// Summary modal
export async function renderSummary(finalWinnerName) {
  console.log('renderSummary() kalt med winner:', finalWinnerName);
  console.log('setHistory lengde:', state.setHistory.length);
  console.log('setHistory innhold:', state.setHistory);

  const n = readABFromModalInputs();
  const nA = n.A, nB = n.B;

  const hA = document.getElementById('sumNameA');
  const hB = document.getElementById('sumNameB');
  if (hA) hA.textContent = nA;
  if (hB) hB.textContent = nB;

  const body = document.getElementById('summaryBody');
  if (!body) {
    console.log('FEIL: summaryBody element ikke funnet!');
    return;
  }
  body.innerHTML = '';

  for (let i = 0; i < state.setHistory.length; i++) {
    const s = state.setHistory[i];
    const tr = document.createElement('tr');

    const tdSet = document.createElement('td'); tdSet.textContent = String(s.set); tr.appendChild(tdSet);
    const tdA = document.createElement('td'); tdA.textContent = String(s.a); tr.appendChild(tdA);
    const tdB = document.createElement('td'); tdB.textContent = String(s.b); tr.appendChild(tdB);
    const tdW = document.createElement('td');
    tdW.textContent = s.winner === 'A' ? nA : (s.winner === 'B' ? nB : '—');
    tr.appendChild(tdW);

    body.appendChild(tr);
    console.log('Rad lagt til:', s);
  }

  const winEl = document.getElementById('summaryWinner');
  if (winEl) winEl.textContent = finalWinnerName ? ('🎉 ' + finalWinnerName + ' vant kampen! 🎉') : '';

  // Vis modal
  const mask = document.getElementById('summaryMask');
  if (mask) {
    mask.style.display = 'flex';
    const { setBodyScroll } = await import('./dom.js');
    setBodyScroll(true);
    console.log('summaryMask satt til display: flex');
  } else {
    console.log('FEIL: summaryMask element ikke funnet!');
  }
  saveLiveState(readABFromModalInputs);
}

export async function closeSummaryModal() {
  const mask = document.getElementById('summaryMask');
  if (mask) {
    mask.style.display = 'none';
    const { setBodyScroll } = await import('./dom.js');
    setBodyScroll(false);
  }
}

// Fullscreen
export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

// Long-press/tap binding
export function bindLongPressOne(el, action) {
  let tid = 0, px = 0, py = 0, down = false, didLong = false, scrollY0 = 0;
  let swallowNextClick = false; // <- blokker kun neste click etter long-press

  function vibrate(m) { try { if (navigator.vibrate) navigator.vibrate(m) } catch (_) {} }

  function start(x, y) {
    down = true; didLong = false;
    px = x; py = y; scrollY0 = window.scrollY;
    clearTimeout(tid);
    tid = setTimeout(function() {
      if (!down || didLong) return;
      didLong = true;
      swallowNextClick = true;   // blokker release-klikket én gang
      action();
      vibrate(60);
    }, LONGPRESS_MS);
  }

  function cancel() { down = false; clearTimeout(tid) }

  // Blokker bare DET FØRSTE klikket etter en long-press-release
  el.addEventListener('click', function(e) {
    if (swallowNextClick) {
      swallowNextClick = false;          // brukt opp
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  el.addEventListener('pointerdown', function(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
    // Ny gest: sørg for at vi IKKE lenger blokkerer – muliggjør umiddelbar +1
    swallowNextClick = false;
    start(e.clientX, e.clientY);
  }, { passive: true });

  el.addEventListener('pointermove', function(e) {
    if (!down) return;
    if (Math.hypot(e.clientX - px, e.clientY - py) > MOVE_THRESH ||
      Math.abs(window.scrollY - scrollY0) > 2) {
      cancel();
    }
  }, { passive: true });

  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'blur']
    .forEach(function(ev) {
      el.addEventListener(ev, function() { cancel() }, { passive: true });
    });
}

export function bindTap(el, fn) { el && el.addEventListener('click', fn) }

// Helper functions
function maybeSaveNamesOnStart() {
  if (state.namesSavedThisMatch) return;
  const atStart = (state.scoreA === 0 && state.scoreB === 0 && state.setsA === 0 && state.setsB === 0 && state.currentSet === 1 && !state.locked);
  if (!atStart) {
    const n = readABFromModalInputs();
    saveLastNames(n.A, n.B);
    state.namesSavedThisMatch = true;
  }
}

// Menu handlers
export function getMenuHandlers() {
  return {
    onShare: () => openShare(spectatorShareUrl),
    onNewMatch: startNewMatch,
    onResetSet: resetSet,
    onSwap: swapSides,
    onEditNames: () => showNameModal(false),
    onClear: () => {
      try {
        localStorage.clear();
        toast('Lagret data slettet');
      } catch (e) {
        toast('Kunne ikke slette');
      }
      location.reload();
    },
    onFullscreen: toggleFullscreen,
    onStats: () => renderStats(loadMatches(), (mode) => { state.VIEW_MODE = mode; }, renderMenu),
    onBackToMatch: async () => {
      const { setBodyScroll } = await import('./dom.js');
      showMatch(() => { state.VIEW_MODE = 'match'; }, renderMenu, setBodyScroll, updateEditableState, fitScores);
    },
    onCloseShare: closeShare
  };
}

// Placeholder for renderMenu - will be imported when needed
let renderMenu;
