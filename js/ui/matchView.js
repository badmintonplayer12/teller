import { state, saveLiveState, restoreLiveState, clearLiveState, namesState, normalizeNameEntry, alignNamesState, getDisplayName } from '../state/matchState.js';
import { setDigits, fitScores, queueFit, handleScoreBump, swapSides, setLayoutDependencies, readABFromModalInputs, writeModalInputsFromAB, clearWinner, isALeft, startVisualSwap, setSidesDomTo } from './layout.js';
import { showNameModal, hideNameModal, updateEditableState, updateNameChips, autocomplete, onSaveNames } from './namesModal.js';
import { loadMatches, saveMatches, saveLastNames, loadLastNames } from '../services/storage.js';
import { initShare, openShare, closeShare } from './share.js';
import { renderStats, showMatch } from './statsView.js';
import { setupMenu, renderMenu } from './menu.js';
import { hasActiveMatchState, getContinueLabel, isAtStart } from './session.js';
import { setupSplash, showSplash, hideSplash, syncSplashButtons, setSplashContinueState } from './splash.js';
import { setupTournamentSetup, showTournamentSetup } from './tournamentSetup.js';
import { getGameRef, ensureGameId, generateNewGameId } from '../services/firebase.js';
import { bindFirebaseSync, unbindFirebaseSync, setFirebaseSyncDependencies } from '../services/firebaseSync.js';
import { initWriteAccess, hasWriteAccess, claimWriteAccess, releaseWriteAccess, setWriteAccessDependencies, getWriteAccessStatus } from '../services/writeAccess.js';
import { setupTournamentOverview, hideTournamentOverview, renderTournamentOverview } from './tournamentOverview.js';
import { setupFirebase, pushStateThrottled, pushStateNow, spectatorShareUrl } from '../services/firebase.js';
import { toast, setBodyScroll, $ } from '../dom.js';
import { openModal, closeModal } from './modal.js';
import { qs, on, toggle } from '../util/domUtils.js';
import { LONGPRESS_MS, MOVE_THRESH } from '../constants.js';
import { bindNameInput } from '../services/namesStore.js';

/**
 * Match View Event Binding Contract:
 * 
 * enterMatch() - Binds all necessary event listeners for match interaction
 * exitMatch() - Removes all bound event listeners to prevent double-binding
 * 
 * This prevents duplicate event handlers when navigating in/out of match view
 */


function openFinishDialog(){
  const settled = (state.setsA >= 2 || state.setsB >= 2);
  showFinishDialog(!settled);
}

// Lokal helper: hent visningsnavn for A/B konsistent
function getCurrentDisplayNames(){
  const names = readABFromModalInputs();
  return {
    aDisplay: getDisplayName(names.A, 'A'),
    bDisplay: getDisplayName(names.B, 'B')
  };
}

const saveState = () => saveLiveState(readABFromModalInputs);

// Event binding state
let isMatchBound = false;
let boundHandlers = {
  scoreA: null,
  scoreB: null,
  leftArea: null,
  rightArea: null,
  keydown: null
};

// Teller read state
let _unsubCounter = null;

// Cache DOM elements for performance (used by counterRead.js)
const elA = document.getElementById('A_digits');
const elB = document.getElementById('B_digits');


// Lokalt suppress-vindu for å ignorere umiddelbar echo fra RTDB (ms tidsstempel per side)
let _localBumpSuppress = { A: 0, B: 0 };

setLayoutDependencies({
  saveLiveState: saveState,
  pushStateThrottled: () => pushStateThrottled(),
  pushStateNow: () => pushStateNow(),
  updateNameChips
});

// Gi teller-leseren tilgang til våre UI-oppdaterere (unngår window.*)
setFirebaseSyncDependencies({
  updateScores,
  fitScores,
  handleScoreBump,
  clearWinner,
  getSuppressUntil: (side) => _localBumpSuppress[side] || 0,
  startVisualSwap,
  setSidesDomTo
});

// Set up write access system
setWriteAccessDependencies({
  onWriteAccessChange: function(status) {
    console.log('[WRITE ACCESS] Access changed:', status);
    // Rebind Firebase with new write access status
    if (state.IS_COUNTER) {
      rebindFirebaseWithWriteAccess();
    }
  },
  pushStateNow: () => pushStateNow(),
  getGameRef: () => getGameRef()
});

let menuHandlers;
let shareInitialized = false;

// Helper function to rebind Firebase with current write access
function rebindFirebaseWithWriteAccess(){
  if (!state.IS_COUNTER) return;
  
  unbindFirebaseSync();
  
  var gid = ensureGameId();
  var ref = getGameRef(gid);
  if(ref){
    var role = state.IS_COCOUNTER ? 'cocounter' : 'counter';
    var canWrite = hasWriteAccess();
    console.log('[WRITE ACCESS] Rebinding Firebase - role:', role, 'canWrite:', canWrite);
    _unsubCounter = bindFirebaseSync({ role, ref, canWrite });
  }
}

export function mount(){
  setupMenu({ isSpectator: state.IS_SPECTATOR });
  menuHandlers = buildMenuHandlers();
  renderMenu(state.VIEW_MODE, menuHandlers);

  if(!shareInitialized){
    initShare({ getShareUrl: spectatorShareUrl });
    shareInitialized = true;
  }

  bindModalEvents();
  bindSummaryEvents();

  addEventListener('resize', queueFit);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);
  addEventListener('orientationchange', function(){ setTimeout(queueFit, 60); });

  setupSplash({ onStart: startMatchFlow, saveState: saveState });
  setupTournamentSetup();
  setupTournamentOverview();

  // Only setup Firebase if we're not just showing splash
  // Check if we have URL parameters that indicate we need Firebase
  const urlParams = new URLSearchParams(window.location.search);
  const hasGameParam = urlParams.has('game');
  const hasMode = urlParams.has('mode');
  
  if (hasGameParam || hasMode || state.IS_SPECTATOR || !document.body.classList.contains('splash-open')) {
    setupFirebase({ updateScores });
  }

  if(state.IS_SPECTATOR){
    document.body.classList.remove('areas-active');
    const menu = qs('#menuPanel');
    if(menu) menu.style.display = 'none';
  }else{
    maybeShowKebabHint();
  }

  updateScores();
  fitScores();
}

export function startMatchFlow(opts){
  opts = opts || {};
  const restored = !!opts.restored;
  const skipSplash = !!opts.skipSplash;
  const continueMatch = !!opts.continueMatch;
  const directJoin = !!opts.directJoin; // Joining via shared URL
  const fromSplash = !!opts.fromSplash; // Started from splash screen
  let handledStart = false;
  
  // Setup Firebase when starting from splash (if not already done)
  if (fromSplash && !window.firebase) {
    console.log('[MATCH FLOW] Setting up Firebase from splash');
    setupFirebase({ updateScores });
  } else if (fromSplash && window.firebase) {
    console.log('[MATCH FLOW] Firebase already initialized, skipping setup');
  }

  if(!state.IS_SPECTATOR){
    if(continueMatch){
      // Check if we should go to tournament overview instead of auto-resuming match
      if(state.playMode === 'tournament' && state.ui && state.ui.nextNavHint === 'continueTournament'){
        // Navigate to tournament overview instead of auto-resuming
        import('./tournamentOverview.js').then(function(module){
          module.showTournamentOverview();
        });
        // Clear the navigation hint after use
        if(state.ui) state.ui.nextNavHint = null;
        return;
      }
      
      // Navigate to match URL for refresh support when continuing match
      try {
        import('../services/firebase.js').then(function(firebaseModule) {
          const gameId = firebaseModule.ensureGameId();
          const mode = state.IS_COCOUNTER ? 'cocounter' : 'counter';
          const matchUrl = firebaseModule.generateShareUrl(mode, gameId);
          window.history.replaceState({}, '', matchUrl);
          console.log('[CONTINUE MATCH] Navigated to match URL:', matchUrl);
        });
      } catch (e) {
        console.warn('[CONTINUE MATCH] Failed to navigate to match URL:', e);
      }
      
      handledStart = true;
    }

    if(!restored && !skipSplash && !continueMatch){
      if(state.playMode === 'tournament'){
        showTournamentSetup();
      }else{
        // Viktig: full reset før navn-modal for å unngå "låst" skjerm
        // Bruk samme løype som "Ny kamp"
        // Hopper over splash og åpner navn-modal via startNewMatch
        startNewMatch({ skipSplash: true });
      }
      handledStart = true;
    }

    // Handle direct join via shared URL - enable scoring immediately
    if(directJoin && !state.IS_SPECTATOR){
      state.allowScoring = true;
      handledStart = true;
    }
    
    if(!handledStart && !state.allowScoring){
      showNameModal(true);
    }
    updateNameChips();
  }

  updateEditableState();
  saveState();
  
  // Enter match view - bind event listeners
  enterMatch();
}

function bindCoreEvents(){
  if(!state.IS_SPECTATOR){
    // Store handlers for cleanup
    boundHandlers.scoreA = () => addPoint('A');
    boundHandlers.scoreB = () => addPoint('B');
    boundHandlers.leftArea = () => addPointByPosition('left');
    boundHandlers.rightArea = () => addPointByPosition('right');
    
    bindLongPressOne($('#scoreA'), () => removePoint('A'));
    bindLongPressOne($('#scoreB'), () => removePoint('B'));
    bindTap($('#scoreA'), boundHandlers.scoreA);
    bindTap($('#scoreB'), boundHandlers.scoreB);
    bindLongPressOne($('#leftArea'), () => removePointByPosition('left'));
    bindLongPressOne($('#rightArea'), () => removePointByPosition('right'));
    bindTap($('#leftArea'), boundHandlers.leftArea);
    bindTap($('#rightArea'), boundHandlers.rightArea);
  }

  const nameAInput = qs('#nameA');
  const nameBInput = qs('#nameB');
  const nameA1Input = qs('#nameA1');
  const nameA2Input = qs('#nameA2');
  const nameB1Input = qs('#nameB1');
  const nameB2Input = qs('#nameB2');
  const teamNameAInput = qs('#teamNameA');
  const teamNameBInput = qs('#teamNameB');
  
  if(nameAInput) {
    autocomplete(nameAInput, 'nameA-list');
    bindNameInput(nameAInput);
  }
  if(nameBInput) {
    autocomplete(nameBInput, 'nameB-list');
    bindNameInput(nameBInput);
  }
  if(nameA1Input) {
    autocomplete(nameA1Input, 'nameA1-list');
    bindNameInput(nameA1Input);
  }
  if(nameA2Input) {
    autocomplete(nameA2Input, 'nameA2-list');
    bindNameInput(nameA2Input);
  }
  if(nameB1Input) {
    autocomplete(nameB1Input, 'nameB1-list');
    bindNameInput(nameB1Input);
  }
  if(nameB2Input) {
    autocomplete(nameB2Input, 'nameB2-list');
    bindNameInput(nameB2Input);
  }
  
  // Add event listeners for team name inputs to update chips
  if(teamNameAInput) {
    on(teamNameAInput, 'input', updateNameChips);
    on(teamNameAInput, 'blur', updateNameChips);
  }
  if(teamNameBInput) {
    on(teamNameBInput, 'input', updateNameChips);
    on(teamNameBInput, 'blur', updateNameChips);
  }
}

function handleNameModalCancel(){
  // Check if we're in "start new match" mode vs "edit names" mode
  var startBtn = $('#btnStart');
  var isStartMode = startBtn && startBtn.style.display !== 'none';
  
  if(isStartMode){
    // Starting new match - cancel should abort the match entirely
    console.log('[NAME MODAL] Canceling new match start');
    
    // Clear any partial state
    state.allowScoring = false;
    state.nameEditMode = false;
    
    // Clear any saved state from the aborted match
    clearLiveState();
    
    // Return to splash
    hideNameModal();
    import('./splash.js').then(function(module) {
      module.showSplash();
    });
    
  } else {
    // Editing existing names - just close modal and continue
    console.log('[NAME MODAL] Canceling name edit');
    hideNameModal();
  }
}

function bindModalEvents(){
  const cancel = $('#btnCancelNames');
  if(cancel) on(cancel, 'click', handleNameModalCancel);

  const saveBtn = $('#btnSaveNames');
  if(saveBtn) on(saveBtn, 'click', function(){
    onSaveNames(saveState, () => pushStateThrottled());
  });

  const startBtn = $('#btnStart');
  if(startBtn) startBtn.addEventListener('click', function(){
    onSaveNames(saveState, () => pushStateThrottled());
    state.allowScoring = true;
    state.nameEditMode = false;
    saveState();
  });
}

function bindSummaryEvents(){
  const closeBtn = document.getElementById('summaryClose');
  const closeSummaryBtn = document.getElementById('btnCloseSummary');
  const newMatchBtn = document.getElementById('btnNewMatch');
  const quickStartBtn = document.getElementById('btnQuickStart');
  const finishMatchBtn = document.getElementById('btnFinishMatch');
  const showSummaryBtn = document.getElementById('showSummaryBtn');
  const mask = document.getElementById('summaryMask');
  const nextSetBtn = document.getElementById('nextSetBtn');

  // Handle tournament mode button click
  if(finishMatchBtn) {
    finishMatchBtn.addEventListener('click', function(){
      if(state.playMode !== 'tournament') return;
      openFinishDialog();
    });
  }
  
  if(newMatchBtn) {
    newMatchBtn.style.display = state.playMode === 'tournament' ? 'none' : 'inline-block';
  }
  
  if(quickStartBtn) {
    quickStartBtn.style.display = state.playMode === 'tournament' ? 'none' : 'inline-block';
  }

  if(closeBtn) closeBtn.addEventListener('click', closeSummaryModal);
  if(closeSummaryBtn) closeSummaryBtn.addEventListener('click', closeSummaryModal);
  if(newMatchBtn) newMatchBtn.addEventListener('click', function(){ closeSummaryModal(); startNewMatch(); });
  if(quickStartBtn) quickStartBtn.addEventListener('click', function(){ 
    closeSummaryModal(); 
    if(state.playMode === 'tournament'){
      // In tournament mode, keep same format but reset scores
      startNewMatch({ skipSplash: true });
    } else {
      // In single match mode, use quick start
      startNewMatch({ skipSplash: true });
    }
  });
  if(showSummaryBtn) showSummaryBtn.addEventListener('click', function(){
    const names = readABFromModalInputs();
    const aDisplay = getDisplayName(names.A, 'A');
    const bDisplay = getDisplayName(names.B, 'B');
    const winnerName = (state.setsA === 2) ? aDisplay : bDisplay;
    renderSummary(winnerName);
  });
  if(mask) mask.addEventListener('click', function(e){ if(e.target === mask) closeSummaryModal(); });
  if(nextSetBtn) nextSetBtn.addEventListener('click', function(){ if(!state.IS_SPECTATOR) advanceToNextSet(); });

  // Store keydown handler for cleanup
  boundHandlers.keydown = function(e){
    if(state.IS_SPECTATOR) return;
    if(state.betweenSets && (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'n')){
      e.preventDefault();
      advanceToNextSet();
    }
  };
  document.addEventListener('keydown', boundHandlers.keydown);
}

/**
 * Enter match view - bind all necessary event listeners
 */
export function enterMatch(){
  if(isMatchBound) return; // Prevent double-binding
  
  bindCoreEvents();
  
  // Initialize write access system
  if(state.IS_COUNTER) {
    initWriteAccess();
  }
  
  // Bind teller read handlers for live updates
  if(state.IS_COUNTER) {
    rebindFirebaseWithWriteAccess();
  }
  
  isMatchBound = true;
}

/**
 * Exit match view - remove all bound event listeners
 */
export function exitMatch(){
  if(!isMatchBound) return;
  
  // Remove event listeners
  if(boundHandlers.scoreA && $('#scoreA')) {
    $('#scoreA').removeEventListener('click', boundHandlers.scoreA);
  }
  if(boundHandlers.scoreB && $('#scoreB')) {
    $('#scoreB').removeEventListener('click', boundHandlers.scoreB);
  }
  if(boundHandlers.leftArea && $('#leftArea')) {
    $('#leftArea').removeEventListener('click', boundHandlers.leftArea);
  }
  if(boundHandlers.rightArea && $('#rightArea')) {
    $('#rightArea').removeEventListener('click', boundHandlers.rightArea);
  }
  if(boundHandlers.keydown) {
    document.removeEventListener('keydown', boundHandlers.keydown);
  }
  
  // Clean up teller read handlers
  try { 
    if (_unsubCounter) _unsubCounter(); 
  } catch(e){}
  try { 
    unbindFirebaseSync(); 
  } catch(e){}
  _unsubCounter = null;
  
  // Reset state
  isMatchBound = false;
  boundHandlers = {
    scoreA: null,
    scoreB: null,
    leftArea: null,
    rightArea: null,
    keydown: null
  };
  
  // Reset suppress window
  _localBumpSuppress.A = _localBumpSuppress.B = 0;
}

function updateTournamentActionButtons(){
  const finishBtn = document.getElementById('btnFinishMatch');
  const isTournament = state.playMode === 'tournament';
  const completedSets = state.setsA >= 2 || state.setsB >= 2;
  if(finishBtn) finishBtn.style.display = isTournament && completedSets ? 'inline-block' : 'none';
}

// Finish dialog event listeners
(function bindFinishDialogEvents(){
  const mask = document.getElementById('finishMatchMask');
  if(!mask) return;

  const btnPlayed = document.getElementById('finishMatchPlayed');
  const btnWalkoverA = document.getElementById('finishMatchWalkoverA');
  const btnWalkoverB = document.getElementById('finishMatchWalkoverB');
  const btnCancel = document.getElementById('finishMatchCancel');

  btnPlayed?.addEventListener('click', function(){
    finalizeTournamentMatch({ type: 'played' });
    hideFinishDialog();
    toast('Kampen er ferdig. Resultatet er lagret.');
  });

  btnWalkoverA?.addEventListener('click', function(){
    finalizeTournamentMatch({ type: 'walkover', winnerSide: 'A' });
    hideFinishDialog();
    toast('Walkover registrert. Lag A får seieren.');
  });

  btnWalkoverB?.addEventListener('click', function(){
    finalizeTournamentMatch({ type: 'walkover', winnerSide: 'B' });
    hideFinishDialog();
    toast('Walkover registrert. Lag B får seieren.');
  });

  btnCancel?.addEventListener('click', hideFinishDialog);
  // Lokal backdrop-lytter ikke nødvendig lenger når modal.js håndterer dette
})();

function showFinishDialog(disablePlayed) {
  const mask = document.getElementById('finishMatchMask');
  if(!mask) return;
  openModal('#finishMatchMask', { closeOnBackdrop: true, closeOnEsc: true });
  
  const playedBtn = document.getElementById('finishMatchPlayed');
  const info = document.getElementById('finishMatchInfo');
  const walkA = document.getElementById('finishMatchWalkoverA');
  const walkB = document.getElementById('finishMatchWalkoverB');
  
  if(!disablePlayed){
    if(playedBtn){
      playedBtn.style.display = 'block';
      playedBtn.disabled = false;
    }
    if(walkA) walkA.style.display = 'none';
    if(walkB) walkB.style.display = 'none';
    if(info) info.style.display = 'none';
  }else{
    if(playedBtn) playedBtn.style.display = 'none';
    if(info){
      info.style.display = 'block';
      info.textContent = 'Fullfør settene (best av tre) før du kan markere kampen som spilt.';
    }
    if(walkA) walkA.style.display = 'block';
    if(walkB) walkB.style.display = 'block';
  }
  
  document.getElementById('finishMatchHint').textContent = disablePlayed
    ? 'Walkover kan registreres selv om kampen ikke er spilt ferdig.'
    : 'Velg hvordan du vil avslutte kampen.';
}

function hideFinishDialog(){
  const mask = document.getElementById('finishMatchMask');
  if(!mask) return;
  closeModal('#finishMatchMask');
  
  const playedBtn = document.getElementById('finishMatchPlayed');
  const info = document.getElementById('finishMatchInfo');
  const walkA = document.getElementById('finishMatchWalkoverA');
  const walkB = document.getElementById('finishMatchWalkoverB');
  if(playedBtn){
    playedBtn.style.display = 'block';
    playedBtn.disabled = false;
  }
  if(walkA) walkA.style.display = 'block';
  if(walkB) walkB.style.display = 'block';
  if(info) info.style.display = 'none';
}

function updateScores(){
  setDigits(state.scoreA, 'A');
  setDigits(state.scoreB, 'B');

  const counterA = document.getElementById('setCounterA');
  const counterB = document.getElementById('setCounterB');
  if(counterA){
    counterA.textContent = String(state.setsA);
    counterA.style.display = state.setsA > 0 ? 'flex' : 'none';
  }
  if(counterB){
    counterB.textContent = String(state.setsB);
    counterB.style.display = state.setsB > 0 ? 'flex' : 'none';
  }

  const setsEl = document.getElementById('sets');
  if(setsEl){
    setsEl.textContent = 'Sett: ' + state.setsA + '-' + state.setsB;
    setsEl.style.display = (state.setsA + state.setsB) > 0 ? 'block' : 'none';
  }

  updateEditableState();
  
  // Update "Neste sett" button visibility
  const nextSetBtn = document.getElementById('nextSetBtn');
  if(nextSetBtn) nextSetBtn.style.display = (!state.IS_SPECTATOR && state.betweenSets) ? 'block' : 'none';
  
  // Save tournament match state
  if(state.playMode === 'tournament' && state.tournamentData?.activeMatchId){
    const id = state.tournamentData.activeMatchId;
    const store = state.tournamentData.matchStates || (state.tournamentData.matchStates = {});
    const entry = store[id] || (store[id] = {
      scoreA: 0, scoreB: 0, setsA: 0, setsB: 0,
      currentSet: 1, setHistory: [], locked: false,
      betweenSets: false, pendingSetWinner: null,
      swappedAt11: false, status: 'pending'
    });
    entry.scoreA = state.scoreA;
    entry.scoreB = state.scoreB;
    entry.setsA = state.setsA;
    entry.setsB = state.setsB;
    entry.currentSet = state.currentSet;
    entry.setHistory = state.setHistory.slice();
    entry.locked = state.locked;
    entry.betweenSets = state.betweenSets;
    entry.pendingSetWinner = state.pendingSetWinner;
    entry.swappedAt11 = state.swappedAt11;
    if(entry.status === 'pending' && (state.scoreA > 0 || state.scoreB > 0 || state.setHistory.length)){
      entry.status = 'in-progress';
    }
  }
  
  // Update tournament overview if visible
  renderTournamentOverview();
  
  // Update tournament action buttons
  updateTournamentActionButtons();
  
  // Bump effects handled by counterRead.js for live updates
  // Local bump logic removed to prevent double bump
  
  saveState();
}


function addPoint(side){
  // Workflow checks: Is match ready for scoring?
  if(!state.allowScoring || state.locked || state.swapping) return;
  
  // Security check: Does user have write access? (handles spectator + counter/cocounter)
  if(!hasWriteAccess()) {
    if(state.IS_SPECTATOR) {
      // Spectators shouldn't even see score buttons, but just in case
      return;
    } else {
      toast('Du har ikke skrivetilgang. Klikk "Ta kontroll" for å telle poeng.');
      return;
    }
  }
  
  var oldScore = side === 'A' ? state.scoreA : state.scoreB;
  if(side === 'A') state.scoreA++; else state.scoreB++;
  var newScore = side === 'A' ? state.scoreA : state.scoreB;
  
  // Immediate local bump for responsiveness
  var now = Date.now();
  if (side === 'A' && elA) {
    handleScoreBump(oldScore, newScore, elA);
    _localBumpSuppress.A = now + 250;
  } else if (side === 'B' && elB) {
    handleScoreBump(oldScore, newScore, elB);
    _localBumpSuppress.B = now + 250;
  }
  
  // (ikke nødvendig lenger – navn lagres når de settes i modal/turnering)
  checkSetEnd();
  updateScores();
  
  fitScores();
  pushStateThrottled();
}

function removePoint(side){
  // Workflow checks: Is match ready for scoring?
  if(!state.allowScoring || state.locked || state.swapping) return;
  
  // Security check: Does user have write access? (handles spectator + counter/cocounter)
  if(!hasWriteAccess()) {
    if(state.IS_SPECTATOR) {
      // Spectators shouldn't even see score buttons, but just in case
      return;
    } else {
      toast('Du har ikke skrivetilgang. Klikk "Ta kontroll" for å telle poeng.');
      return;
    }
  }
  
  var oldScore = side === 'A' ? state.scoreA : state.scoreB;
  if(side === 'A' && state.scoreA > 0) state.scoreA--;
  if(side === 'B' && state.scoreB > 0) state.scoreB--;
  var newScore = side === 'A' ? state.scoreA : state.scoreB;
  
  // Immediate local bump for responsiveness
  var now = Date.now();
  if (side === 'A' && elA) {
    handleScoreBump(oldScore, newScore, elA);
    _localBumpSuppress.A = now + 250;
  } else if (side === 'B' && elB) {
    handleScoreBump(oldScore, newScore, elB);
    _localBumpSuppress.B = now + 250;
  }
  
  updateScores();
  
  fitScores();
  pushStateThrottled();
}

function addPointByPosition(pos){
  const aLeft = isALeft();
  addPoint((pos === 'left') ? (aLeft ? 'A' : 'B') : (aLeft ? 'B' : 'A'));
}

function removePointByPosition(pos){
  const aLeft = isALeft();
  removePoint((pos === 'left') ? (aLeft ? 'A' : 'B') : (aLeft ? 'B' : 'A'));
}

function pushSetToHistory(a, b){
  const winner = (a > b) ? 'A' : (b > a ? 'B' : '-');
  state.setHistory.push({ set: state.currentSet, a: a, b: b, winner: winner });
  saveState();
}

function renderSummary(finalWinnerName){
  const names = readABFromModalInputs();
  const sumNameA = document.getElementById('sumNameA');
  const sumNameB = document.getElementById('sumNameB');
  const { aDisplay, bDisplay } = getCurrentDisplayNames();
  
  if(sumNameA) sumNameA.textContent = aDisplay;
  if(sumNameB) sumNameB.textContent = bDisplay;

  // Update player names row for double format
  const playersRow = document.getElementById('summaryPlayersRow');
  const sumPlayersA = document.getElementById('sumPlayersA');
  const sumPlayersB = document.getElementById('sumPlayersB');
  
  if(state.matchDiscipline === 'double' && typeof names.A === 'object' && names.A.players) {
    // Show player names row for double format
    if(playersRow) playersRow.style.display = 'table-row';
    
    // Show individual player names
    const aPlayers = names.A.players.join(' / ');
    const bPlayers = names.B.players.join(' / ');
    
    if(sumPlayersA) sumPlayersA.textContent = aPlayers;
    if(sumPlayersB) sumPlayersB.textContent = bPlayers;
  } else {
    // Hide player names row for single format
    if(playersRow) playersRow.style.display = 'none';
  }

  // Update format indicator
  const formatIndicator = document.getElementById('summaryFormat');
  if(formatIndicator){
    const formatText = state.matchDiscipline === 'double' ? '(Dobbel)' : '(Singel)';
    formatIndicator.textContent = formatText;
  }
  
  // Update quick start button text based on play mode
  const quickStartBtn = document.getElementById('btnQuickStart');
  if(quickStartBtn){
    if(state.playMode === 'tournament'){
      quickStartBtn.textContent = '⚡ Neste kamp';
    } else {
      quickStartBtn.textContent = '⚡ Hurtigstart';
    }
  }

  const body = document.getElementById('summaryBody');
  if(body){
    body.innerHTML = '';
    state.setHistory.forEach(function(set){
      const tr = document.createElement('tr');
      const tdSet = document.createElement('td'); tdSet.textContent = String(set.set); tr.appendChild(tdSet);
      const tdA = document.createElement('td'); tdA.textContent = String(set.a); tr.appendChild(tdA);
      const tdB = document.createElement('td'); tdB.textContent = String(set.b); tr.appendChild(tdB);
      const tdW = document.createElement('td');
      const winnerDisplay = set.winner === 'A' ? aDisplay : (set.winner === 'B' ? bDisplay : '—');
      tdW.textContent = winnerDisplay;
      tr.appendChild(tdW);
      body.appendChild(tr);
    });
  }

  const winnerEl = document.getElementById('summaryWinner');
  if(winnerEl) winnerEl.textContent = finalWinnerName ? ('🎉 ' + finalWinnerName + ' vant kampen! 🎉') : '';

  openModal('#summaryMask');
  saveState();
}


function checkSetEnd(){
  const leadOk = Math.abs(state.scoreA - state.scoreB) >= 2 || state.scoreA === state.cap || state.scoreB === state.cap;
  if((state.scoreA >= state.target || state.scoreB >= state.target) && leadOk){
    const winner = (state.scoreA > state.scoreB) ? 'A' : 'B';
    pushSetToHistory(state.scoreA, state.scoreB);

    const willFinish = (winner === 'A') ? (state.setsA + 1 >= 2) : (state.setsB + 1 >= 2);
    if(willFinish){
      if(winner === 'A') state.setsA++; else state.setsB++;
      state.locked = true;
      state.betweenSets = false;
      state.pendingSetWinner = null;

      const { aDisplay, bDisplay } = getCurrentDisplayNames();
      const winnerName = winner === 'A' ? aDisplay : bDisplay;

      if(winner === 'A'){
        toggle(qs('#scoreA'), 'winner', true);
        toggle(qs('#nameA_chip'), 'winnerName', true);
      }else{
        toggle(qs('#scoreB'), 'winner', true);
        toggle(qs('#nameB_chip'), 'winnerName', true);
      }

      const summaryBtn = document.getElementById('showSummaryBtn');
      if(summaryBtn) summaryBtn.style.display = 'block';

      const matchObj = { ts: Date.now(), names: { A: aDisplay, B: bDisplay }, sets: state.setHistory.slice(), winner: winnerName };
      const arr = loadMatches();
      arr.unshift(matchObj);
      saveMatches(arr);
      saveLastNames(aDisplay, bDisplay);

      updateScores();
      fitScores();
      saveState();
      pushStateThrottled();
      return;
    }

    if(winner === 'A') state.setsA++; else state.setsB++;
    state.pendingSetWinner = winner;
    state.betweenSets = true;
    state.locked = true;

    const nextSetBtn = document.getElementById('nextSetBtn');
    if(nextSetBtn && !state.IS_SPECTATOR) nextSetBtn.style.display = 'block';

    updateScores();
    fitScores();
    saveState();
    pushStateThrottled();
    return;
  }

  const isDecider = (state.setsA === 1 && state.setsB === 1);
  if(state.currentSet === 3 && isDecider && !state.swappedAt11 && (state.scoreA === 11 || state.scoreB === 11)){
    startVisualSwap();
    state.swappedAt11 = true;
  }

  saveState();
}

function advanceToNextSet(){
  if(!state.betweenSets) return;
  state.locked = true;
  const nextSetBtn = document.getElementById('nextSetBtn');
  if(nextSetBtn) nextSetBtn.style.display = 'none';

  state.currentSet++;
  state.swappedAt11 = false;

  startVisualSwap(function(){
    state.scoreA = 0;
    state.scoreB = 0;
    state.betweenSets = false;
    state.pendingSetWinner = null;
    state.locked = false;
    updateScores();
    fitScores();
    saveState();
    setTimeout(function(){ pushStateNow(); }, 1050);
  });
}

function resetSet(){
  state.betweenSets = false;
  state.pendingSetWinner = null;
  state.scoreA = 0;
  state.scoreB = 0;
  state.swappedAt11 = false;
  const nextSetBtn = document.getElementById('nextSetBtn');
  if(nextSetBtn) nextSetBtn.style.display = 'none';
  updateScores();
  fitScores();
  saveState();
  pushStateThrottled();
}

function startNewMatch(opts){
  opts = opts || {};
  const skipSplash = !!opts.skipSplash;
  
  console.log('[STATE RESET] startNewMatch called with opts:', opts);
  console.log('[STATE RESET] Current state before reset:', {
    scoreA: state.scoreA, scoreB: state.scoreB,
    setsA: state.setsA, setsB: state.setsB,
    currentSet: state.currentSet, playMode: state.playMode
  });
  
  // Generate new game ID for new match to avoid permission conflicts
  generateNewGameId();
  
  // Navigate to match URL for refresh support
  try {
    import('../services/firebase.js').then(function(firebaseModule) {
      const matchUrl = firebaseModule.generateShareUrl('counter', firebaseModule.ensureGameId());
      window.history.replaceState({}, '', matchUrl);
      console.log('[NEW MATCH] Navigated to match URL:', matchUrl);
    });
  } catch (e) {
    console.warn('[NEW MATCH] Failed to navigate to match URL:', e);
  }
  
  // Firebase should already be initialized from startMatchFlow
  // No need to set it up again here
  console.log('[NEW MATCH] Firebase status:', !!window.firebase);
  
  // ELEGANT: When starting new match from splash, ensure user becomes counter (not cocounter)
  if (!skipSplash && window.location.search.includes('mode=cocounter')) {
    console.log('[STATE RESET] Removing cocounter mode from URL for new match');
    // Use router function instead of direct reload
    import('../main.js').then(function(module) {
      module.navigateToCounterMode();
    });
    return;
  }
  
  // Tøm lagret live-state for å unngå at locked/betweenSets lekker inn i ny kamp
  // (clearLiveState lar turneringsdata stå, hvis playMode === 'tournament')
  clearLiveState();
  
  state.betweenSets = false;
  state.pendingSetWinner = null;
  state.scoreA = 0;
  state.scoreB = 0;
  state.setsA = 0;
  state.setsB = 0;
  state.currentSet = 1;
  state.swappedAt11 = false;
  state.locked = false;
  state.setHistory = [];
  // fjernet: flagget brukes ikke lenger
  state.allowScoring = false;
  state.nameEditMode = false;
  // Only clear tournament data if not in tournament mode
  if(state.playMode !== 'tournament'){
    state.tournamentData = null;
  }

  const nextSetBtn = document.getElementById('nextSetBtn');
  if(nextSetBtn) nextSetBtn.style.display = 'none';
  const summaryBtn = document.getElementById('showSummaryBtn');
  if(summaryBtn) summaryBtn.style.display = 'none';
  clearWinner();
  closeSummaryModal();
  document.body.classList.remove('areas-active');

  updateEditableState();
  updateScores();
  fitScores();
  saveState();
  
  // ELEGANT: Temporarily disable Firebase reads during reset to prevent race condition
  console.log('[STATE RESET] Temporarily disabling Firebase reads during reset');
  unbindFirebaseSync();
  
  console.log('[STATE RESET] Pushing reset state to Firebase');
  
  const reEnableFirebaseReads = () => {
    console.log('[STATE RESET] Re-enabling Firebase reads');
    if(state.IS_COUNTER) {
      rebindFirebaseWithWriteAccess();
    }
  };
  
  if(typeof pushStateNow === 'function') {
    // Try to use promise-based approach if pushStateNow returns a promise
    const pushResult = pushStateNow();
    if(pushResult && typeof pushResult.then === 'function') {
      // Promise-based - wait for actual completion
      pushResult
        .then(() => {
          console.log('[STATE RESET] Firebase push completed successfully');
          reEnableFirebaseReads();
        })
        .catch((error) => {
          console.warn('[STATE RESET] Firebase push failed, re-enabling reads anyway:', error);
          reEnableFirebaseReads();
        });
    } else {
      // Fallback to timeout if not promise-based
      console.log('[STATE RESET] Using timeout fallback (no promise support)');
      setTimeout(reEnableFirebaseReads, 300); // Slightly longer for safety
    }
  } else {
    // Throttled push fallback
    pushStateThrottled();
    setTimeout(reEnableFirebaseReads, 800); // Longer for throttled
  }
  
  setSplashContinueState({ visible: false });
  
  console.log('[STATE RESET] State after reset:', {
    scoreA: state.scoreA, scoreB: state.scoreB,
    setsA: state.setsA, setsB: state.setsB,
    currentSet: state.currentSet, allowScoring: state.allowScoring
  });
  
  if(skipSplash){
    // Quick start - go directly to name modal
    showNameModal(true);
  } else {
    // Normal flow - show splash
    showSplash();
  }
}

export function finalizeTournamentMatch(options){
  const matchId = state.tournamentData.activeMatchId;
  if(!matchId) return;
  
  const store = state.tournamentData.matchStates || (state.tournamentData.matchStates = {});
  const entry = store[matchId] || (store[matchId] = {
    scoreA: 0, scoreB: 0, setsA: 0, setsB: 0,
    currentSet: 1, setHistory: [], locked: false,
    betweenSets: false, pendingSetWinner: null,
    swappedAt11: false, status: 'pending'
  });
  
  if(options.type === 'played') {
    entry.status = 'completed';
    entry.finalScore = {
      scoreA: state.scoreA,
      scoreB: state.scoreB,
      setsA: state.setsA,
      setsB: state.setsB,
      setHistory: state.setHistory.slice()
    };
  } else if(options.type === 'walkover') {
    entry.status = 'walkover';
    entry.walkoverWinner = options.winnerSide;
    entry.finalScore = null;
  }
  
  state.locked = true;
  state.allowScoring = false;
  
  // Set scroll target for tournament overview
  state.tournamentData.scrollTargetMatchId = matchId;
  
  renderTournamentOverview();
  saveState();
  pushStateThrottled();
  
  // Optionally open overview
  showTournamentOverview();
}

export function startTournamentMatch(matchId){
  // Look up the match in tournament data
  const match = state.tournamentData.matches.find(m => m.id === matchId);
  if(!match) {
    console.log('Match not found:', matchId);
    return;
  }

  // Hide tournament overview and show match view
  hideTournamentOverview();
  showMatch();

  // Set tournament mode and active match
  state.playMode = 'tournament';
  state.tournamentData.activeMatchId = matchId;

  // Rebuild menu with tournament handlers
  menuHandlers = buildMenuHandlers();
  renderMenu(state.VIEW_MODE, menuHandlers);
  
  // Update button visibility for tournament mode
  bindSummaryEvents();
  
  // Update tournament action buttons
  updateTournamentActionButtons();

  // Load or create match state
  const matchState = state.tournamentData.matchStates[matchId];
  if (matchState) {
    // Restore existing match state
    state.scoreA = matchState.scoreA;
    state.scoreB = matchState.scoreB;
    state.setsA = matchState.setsA;
    state.setsB = matchState.setsB;
    state.currentSet = matchState.currentSet;
    state.setHistory = matchState.setHistory;
    state.locked = matchState.locked;
    state.betweenSets = matchState.betweenSets;
    state.pendingSetWinner = matchState.pendingSetWinner;
    state.swappedAt11 = matchState.swappedAt11;
  } else {
    // Create fresh match state
    const fresh = {
      scoreA: 0, scoreB: 0,
      setsA: 0, setsB: 0,
      currentSet: 1,
      setHistory: [],
      locked: false,
      betweenSets: false,
      pendingSetWinner: null,
      swappedAt11: false,
      status: 'pending'
    };
    state.tournamentData.matchStates[matchId] = fresh;
    
    // Initialize state with fresh values
    state.scoreA = fresh.scoreA;
    state.scoreB = fresh.scoreB;
    state.setsA = fresh.setsA;
    state.setsB = fresh.setsB;
    state.currentSet = fresh.currentSet;
    state.setHistory = fresh.setHistory;
    state.locked = fresh.locked;
    state.betweenSets = fresh.betweenSets;
    state.pendingSetWinner = fresh.pendingSetWinner;
    state.swappedAt11 = fresh.swappedAt11;
  }
  
  // fjernet: flagget brukes ikke lenger
  state.allowScoring = false;

  // Hide UI elements
  const nextSetBtn = document.getElementById('nextSetBtn');
  const summaryBtn = document.getElementById('showSummaryBtn');
  if(nextSetBtn) nextSetBtn.style.display = 'none';
  if(summaryBtn) summaryBtn.style.display = 'none';
  
  clearWinner();
  closeSummaryModal();

  // Set player names
  writeModalInputsFromAB(match.playerA || 'Spiller A', match.playerB || 'Spiller B');
  
  // Sync modal values to namesState
  const seededNames = readABFromModalInputs();
  namesState.A = normalizeNameEntry(seededNames.A, 'A', state.matchDiscipline);
  namesState.B = normalizeNameEntry(seededNames.B, 'B', state.matchDiscipline);
  alignNamesState(state.matchDiscipline);
  
  updateNameChips();

  // Mark names as saved and enable scoring
    // fjernet: flagget brukes ikke lenger
  state.allowScoring = true;
  updateEditableState();
  updateScores();
  fitScores();
  saveState();
  pushStateThrottled();
}

function closeSummaryModal(){
  closeModal('#summaryMask');
}

function bindLongPressOne(el, action){
  if(!el) return;
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let down = false;
  let didLong = false;
  let scrollY0 = 0;
  let swallowNextClick = false;

  function vibrate(ms){
    try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(_){ }
  }

  function start(x, y){
    down = true;
    didLong = false;
    startX = x;
    startY = y;
    scrollY0 = window.scrollY;
    clearTimeout(timer);
    timer = setTimeout(function(){
      if(!down || didLong) return;
      didLong = true;
      swallowNextClick = true;
      action();
      vibrate(60);
    }, LONGPRESS_MS);
  }

  function cancel(){
    down = false;
    clearTimeout(timer);
  }

  el.addEventListener('click', function(e){
    if(swallowNextClick){
      swallowNextClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  el.addEventListener('pointerdown', function(e){
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    if(el.setPointerCapture) el.setPointerCapture(e.pointerId);
    swallowNextClick = false;
    start(e.clientX, e.clientY);
  }, { passive: true });

  el.addEventListener('pointermove', function(e){
    if(!down) return;
    if(Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESH || Math.abs(window.scrollY - scrollY0) > 2){
      cancel();
    }
  }, { passive: true });

  ['pointerup','pointercancel','pointerleave','lostpointercapture','blur'].forEach(function(evt){
    el.addEventListener(evt, cancel, { passive: true });
  });
}

function bindTap(el, fn){
  if(el) el.addEventListener('click', fn);
}

function maybeShowKebabHint(){
  try{
    if(!localStorage.getItem('badm_kebab_tip_v1')){
      const kebab = document.getElementById('kebab');
      if(kebab){
        kebab.classList.add('pulse');
        setTimeout(function(){
          kebab.classList.remove('pulse');
          localStorage.setItem('badm_kebab_tip_v1', '1');
        }, 2600);
      }
    }
  }catch(_){ }
}

function buildMenuHandlers(){
  return {
    onShare: () => openShare(),
    onNewMatch: () => {
      // Gå til start uten å nullstille state. Oppdater "Fortsett"-knappen live.
      const visible = hasActiveMatchState(state);
      const continueLabel = getContinueLabel(state.playMode);
      try { closeAllModals && closeAllModals(); } catch(_) {}
      setSplashContinueState({ visible, label: continueLabel }); // styrer vis/tekst
      // Oppdater "valgknappene" på splash til dagens mode/disciplin
      syncSplashButtons();
      if (typeof window.updateModalLayout === 'function') window.updateModalLayout();
      showSplash();
    },
    onResetSet: resetSet,
    onSwap: swapSides,
    onEditNames: () => showNameModal(false),
    onClear: () => {
      try{ localStorage.clear(); toast('Lagret data slettet'); }
      catch(_){ toast('Kunne ikke slette'); }
      location.reload();
    },
    onFullscreen: toggleFullscreen,
    onStats: () => renderStats(loadMatches(), mode => { state.VIEW_MODE = mode; }, renderMenu, menuHandlers),
    onTournamentOverview: state.playMode === 'tournament' ? () => showTournamentOverview() : undefined,
    onFinishMatch: state.playMode === 'tournament' ? () => openFinishDialog() : undefined,
    onOpenDashboard: state.playMode === 'tournament' ? () => openDashboard() : undefined,
    onOpenCounter: () => openCounterTab(),
    onClaimWrite: state.IS_COUNTER ? () => {
      if(claimWriteAccess()) {
        toast('Du har nå skrivetilgang');
      } else {
        toast('Du har allerede skrivetilgang');
      }
    } : undefined,
    onReleaseWrite: state.IS_COUNTER ? () => {
      if(releaseWriteAccess()) {
        toast('Skrivetilgang frigitt');
      } else {
        toast('Du har ikke skrivetilgang å frigi');
      }
    } : undefined,
    onBackToMatch: () => {
      showMatch();
      state.VIEW_MODE = 'match';
      renderMenu(state.VIEW_MODE, menuHandlers);
      updateEditableState();
      fitScores();
    }
  };
}

function toggleFullscreen(){
  if(!document.fullscreenElement){
    if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }else{
    if(document.exitFullscreen) document.exitFullscreen();
  }
}

function openDashboard(){
  if(!state.tournamentData) return;
  
  // Get game ID from Firebase
  import('../services/firebase.js').then(function(module) {
    var gameId = module.ensureGameId();
    if(!gameId) return;
    
    var url = location.origin + location.pathname + '?mode=dashboard&game=' + encodeURIComponent(gameId);
    window.open(url, '_blank');
  });
}

function openCounterTab(){
  // Get game ID and open new teller tab
  var gameId = ensureGameId();
  if(!gameId) return;
  
  var url = location.origin + location.pathname + '?game=' + encodeURIComponent(gameId);
  window.open(url, '_blank');
}

export function applyRestoredState(){
  updateScores();
  fitScores();
  
  // Rebuild menu for tournament mode after restore
  if(state.playMode === 'tournament' && state.tournamentData){
    menuHandlers = buildMenuHandlers();
    renderMenu(state.VIEW_MODE, menuHandlers);
    updateTournamentActionButtons();
  }
  
  const mask = document.getElementById('summaryMask');
  if(mask && mask.style.display === 'flex') setBodyScroll(false);
}

export function restoreFromStorage(){
  return restoreLiveState({
    writeModalInputsFromNames: names => writeModalInputsFromAB(names.A, names.B),
    updateNameChips,
    setSidesDomTo,
    syncSplashButtons
  });
}

export { updateScores, renderSummary, closeSummaryModal, resetSet, startNewMatch };
