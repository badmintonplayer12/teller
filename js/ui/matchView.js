import { state, saveLiveState, restoreLiveState, clearLiveState } from '../state/matchState.js';
import { setDigits, fitScores, queueFit, bumpPlus, bumpMinus, swapSides, setLayoutDependencies, readABFromModalInputs, writeModalInputsFromAB, clearWinner, isALeft, startVisualSwap, setSidesDomTo } from './layout.js';
import { showNameModal, hideNameModal, updateEditableState, updateNameChips, autocomplete, onSaveNames } from './namesModal.js';
import { loadMatches, saveMatches, saveLastNames, loadLastNames } from '../services/storage.js';
import { initShare, openShare, closeShare } from './share.js';
import { renderStats, showMatch } from './statsView.js';
import { setupMenu, renderMenu } from './menu.js';
import { setupSplash, showSplash, hideSplash, syncSplashButtons, setSplashContinueState } from './splash.js';
import { setupTournamentSetup, showTournamentSetup } from './tournamentSetup.js';
import { setupFirebase, pushStateThrottled, pushStateNow, spectatorShareUrl } from '../services/firebase.js';
import { setSpectatorDependencies } from '../services/spectator.js';
import { toast, setBodyScroll, $ } from '../dom.js';
import { LONGPRESS_MS, MOVE_THRESH } from '../constants.js';

const saveState = () => saveLiveState(readABFromModalInputs);

setLayoutDependencies({
  saveLiveState: saveState,
  pushStateThrottled: () => pushStateThrottled(),
  pushStateNow: () => pushStateNow(),
  updateNameChips
});

let menuHandlers;
let shareInitialized = false;

export function mount(){
  setupMenu({ isSpectator: state.IS_SPECTATOR });
  menuHandlers = buildMenuHandlers();
  renderMenu(state.VIEW_MODE, menuHandlers);

  if(!shareInitialized){
    initShare({ getShareUrl: spectatorShareUrl });
    shareInitialized = true;
  }

  bindCoreEvents();
  bindModalEvents();
  bindSummaryEvents();

  addEventListener('resize', queueFit);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);
  addEventListener('orientationchange', function(){ setTimeout(queueFit, 60); });

  setupSplash({ onStart: startMatchFlow, saveState: saveState });
  setupTournamentSetup();

  setupFirebase({ updateScores });
  setSpectatorDependencies({ updateScores });

  if(state.IS_SPECTATOR){
    document.body.classList.remove('areas-active');
    const menu = document.getElementById('menuPanel');
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
  let handledStart = false;

  if(!state.IS_SPECTATOR){
    if(continueMatch){
      handledStart = true;
    }

    if(!restored && !skipSplash && !continueMatch){
      if(state.playMode === 'tournament'){
        showTournamentSetup();
      }else{
        const last = loadLastNames();
        const nameAInput = document.getElementById('nameA');
        const nameBInput = document.getElementById('nameB');
        if(nameAInput) nameAInput.value = (last && last[0]) || 'Spiller A';
        if(nameBInput) nameBInput.value = (last && last[1]) || 'Spiller B';
        showNameModal(true);
      }
      handledStart = true;
    }

    if(!handledStart && !state.allowScoring){
      showNameModal(true);
    }
    updateNameChips();
  }

  updateEditableState();
  saveState();
}

function bindCoreEvents(){
  if(!state.IS_SPECTATOR){
    bindLongPressOne($('#scoreA'), () => removePoint('A'));
    bindLongPressOne($('#scoreB'), () => removePoint('B'));
    bindTap($('#scoreA'), () => addPoint('A'));
    bindTap($('#scoreB'), () => addPoint('B'));
    bindLongPressOne($('#leftArea'), () => removePointByPosition('left'));
    bindLongPressOne($('#rightArea'), () => removePointByPosition('right'));
    bindTap($('#leftArea'), () => addPointByPosition('left'));
    bindTap($('#rightArea'), () => addPointByPosition('right'));
  }

  const nameAInput = document.getElementById('nameA');
  const nameBInput = document.getElementById('nameB');
  const nameA1Input = document.getElementById('nameA1');
  const nameA2Input = document.getElementById('nameA2');
  const nameB1Input = document.getElementById('nameB1');
  const nameB2Input = document.getElementById('nameB2');
  const teamNameAInput = document.getElementById('teamNameA');
  const teamNameBInput = document.getElementById('teamNameB');
  
  if(nameAInput) autocomplete(nameAInput, 'nameA-list');
  if(nameBInput) autocomplete(nameBInput, 'nameB-list');
  if(nameA1Input) autocomplete(nameA1Input, 'nameA1-list');
  if(nameA2Input) autocomplete(nameA2Input, 'nameA2-list');
  if(nameB1Input) autocomplete(nameB1Input, 'nameB1-list');
  if(nameB2Input) autocomplete(nameB2Input, 'nameB2-list');
  
  // Add event listeners for team name inputs to update chips
  if(teamNameAInput) {
    teamNameAInput.addEventListener('input', updateNameChips);
    teamNameAInput.addEventListener('blur', updateNameChips);
  }
  if(teamNameBInput) {
    teamNameBInput.addEventListener('input', updateNameChips);
    teamNameBInput.addEventListener('blur', updateNameChips);
  }
}

function bindModalEvents(){
  const cancel = $('#btnCancelNames');
  if(cancel) cancel.addEventListener('click', hideNameModal);

  const saveBtn = $('#btnSaveNames');
  if(saveBtn) saveBtn.addEventListener('click', function(){
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
  const showSummaryBtn = document.getElementById('showSummaryBtn');
  const mask = document.getElementById('summaryMask');
  const nextSetBtn = document.getElementById('nextSetBtn');

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
    const aDisplay = typeof names.A === 'string' ? names.A : names.A?.display || names.A?.players?.join(' / ') || 'Spiller A';
    const bDisplay = typeof names.B === 'string' ? names.B : names.B?.display || names.B?.players?.join(' / ') || 'Spiller B';
    const winnerName = (state.setsA === 2) ? aDisplay : bDisplay;
    renderSummary(winnerName);
  });
  if(mask) mask.addEventListener('click', function(e){ if(e.target === mask) closeSummaryModal(); });
  if(nextSetBtn) nextSetBtn.addEventListener('click', function(){ if(!state.IS_SPECTATOR) advanceToNextSet(); });

  document.addEventListener('keydown', function(e){
    if(state.IS_SPECTATOR) return;
    if(state.betweenSets && (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'n')){
      e.preventDefault();
      advanceToNextSet();
    }
  });
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
  saveState();
}

function maybeSaveNamesOnStart(){
  if(state.namesSavedThisMatch) return;
  const atStart = (state.scoreA === 0 && state.scoreB === 0 && state.setsA === 0 && state.setsB === 0 && state.currentSet === 1 && !state.locked);
  if(!atStart){
    const names = readABFromModalInputs();
    saveLastNames(names.A, names.B);
    state.namesSavedThisMatch = true;
  }
}

function addPoint(side){
  if(!state.allowScoring || state.locked || state.swapping || state.IS_SPECTATOR) return;
  if(side === 'A') state.scoreA++; else state.scoreB++;
  maybeSaveNamesOnStart();
  checkSetEnd();
  updateScores();
  bumpPlus(document.getElementById(side === 'A' ? 'A_digits' : 'B_digits'));
  fitScores();
  pushStateThrottled();
}

function removePoint(side){
  if(!state.allowScoring || state.locked || state.swapping || state.IS_SPECTATOR) return;
  if(side === 'A' && state.scoreA > 0) state.scoreA--;
  if(side === 'B' && state.scoreB > 0) state.scoreB--;
  updateScores();
  bumpMinus(document.getElementById(side === 'A' ? 'A_digits' : 'B_digits'));
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
  
  // Handle both string and object formats
  const aDisplay = typeof names.A === 'string' ? names.A : names.A?.display || names.A?.players?.join(' / ') || 'Spiller A';
  const bDisplay = typeof names.B === 'string' ? names.B : names.B?.display || names.B?.players?.join(' / ') || 'Spiller B';
  
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

  const mask = document.getElementById('summaryMask');
  if(mask){
    mask.style.display = 'flex';
    setBodyScroll(true);
  }
  saveState();
}

function buildWinnerMsg(winnerName, loserName){
  return '🎉 GRATULERER ' + winnerName.toUpperCase() + '! DU VANT KAMPEN!\n' +
         '👏 BRA JOBBA ' + loserName.toUpperCase() + ', DU GJORDE DITT BESTE.';
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

      const names = readABFromModalInputs();
      const aDisplay = typeof names.A === 'string' ? names.A : names.A?.display || names.A?.players?.join(' / ') || 'Spiller A';
      const bDisplay = typeof names.B === 'string' ? names.B : names.B?.display || names.B?.players?.join(' / ') || 'Spiller B';
      const winnerName = winner === 'A' ? aDisplay : bDisplay;
      const loserName = winner === 'A' ? bDisplay : aDisplay;
      const msg = buildWinnerMsg(winnerName, loserName);
      const msgEl = document.getElementById('winnerMsg');
      if(msgEl) msgEl.textContent = msg;

      if(winner === 'A'){
        document.getElementById('scoreA')?.classList.add('winner');
        document.getElementById('nameA_chip')?.classList.add('winnerName');
      }else{
        document.getElementById('scoreB')?.classList.add('winner');
        document.getElementById('nameB_chip')?.classList.add('winnerName');
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

  if(state.currentSet === 3 && !state.swappedAt11 && (state.scoreA === 11 || state.scoreB === 11)){
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
  state.namesSavedThisMatch = false;
  state.allowScoring = false;
  state.nameEditMode = false;

  const nextSetBtn = document.getElementById('nextSetBtn');
  if(nextSetBtn) nextSetBtn.style.display = 'none';
  const summaryBtn = document.getElementById('showSummaryBtn');
  if(summaryBtn) summaryBtn.style.display = 'none';
  const winnerMsg = document.getElementById('winnerMsg');
  if(winnerMsg) winnerMsg.textContent = '';
  clearWinner();
  closeSummaryModal();
  document.body.classList.remove('areas-active');

  updateEditableState();
  updateScores();
  fitScores();
  saveState();
  pushStateThrottled();
  setSplashContinueState({ visible: false });
  
  if(skipSplash){
    // Quick start - go directly to name modal
    showNameModal(true);
  } else {
    // Normal flow - show splash
    showSplash();
  }
}

function closeSummaryModal(){
  const mask = document.getElementById('summaryMask');
  if(mask){
    mask.style.display = 'none';
    setBodyScroll(false);
  }
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
    onNewMatch: startNewMatch,
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

export function applyRestoredState(){
  updateScores();
  fitScores();
  const mask = document.getElementById('summaryMask');
  if(mask && mask.style.display === 'flex') setBodyScroll(true);
}

export function restoreFromStorage(){
  return restoreLiveState({
    writeModalInputsFromAB: writeModalInputsFromAB,
    updateNameChips: updateNameChips,
    setSidesDomTo: setSidesDomTo,
    syncSplashButtons: syncSplashButtons
  });
}

export { updateScores, renderSummary, closeSummaryModal, resetSet, startNewMatch };
