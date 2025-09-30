import { state } from './state/matchState.js';
import { mount, startMatchFlow, restoreFromStorage, applyRestoredState } from './ui/matchView.js';
import { showSplash, hideSplash, setSplashContinueState } from './ui/splash.js';
import { hasActiveMatchState, getContinueLabel } from './ui/session.js';
import { setupStatsModal } from './ui/statsView.js';

// Felles helper for å gå til start uten å slette state
export function goToStart(options){
  options = options || {};
  if (!state.ui) state.ui = {};
  state.ui.requestSplashButtonsRefresh = true; // hint splash om å oppdatere knapper
  
  // Close any open modals
  try { 
    const closeAllModals = window.closeAllModals;
    if (closeAllModals) closeAllModals(); 
  } catch(_) {}
  
  // Show splash
  showSplash();
}

function boot(){
  mount();
  setupStatsModal();

  const restored = restoreFromStorage();
  if(restored) applyRestoredState();

  if(state.IS_SPECTATOR){
    hideSplash();
    startMatchFlow({ restored: restored });
    return;
  }

  const hasActiveMatch = restored && hasActiveMatchState(state);
  const continueLabel = getContinueLabel(state.playMode);

  setSplashContinueState({
    visible: hasActiveMatch,
    label: continueLabel
  });

  showSplash();
}

document.addEventListener('DOMContentLoaded', boot);
