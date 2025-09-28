import { state } from './state/matchState.js';
import { mount, startMatchFlow, restoreFromStorage, applyRestoredState } from './ui/matchView.js';
import { showSplash, hideSplash, setSplashContinueState } from './ui/splash.js';

function boot(){
  mount();

  const restored = restoreFromStorage();
  if(restored) applyRestoredState();

  if(state.IS_SPECTATOR){
    hideSplash();
    startMatchFlow({ restored: restored });
    return;
  }

  const hasActiveMatch = restored && (
    state.allowScoring ||
    state.scoreA > 0 ||
    state.scoreB > 0 ||
    state.setsA > 0 ||
    state.setsB > 0 ||
    (Array.isArray(state.setHistory) && state.setHistory.length > 0) ||
    state.betweenSets ||
    state.locked
  );

  const continueLabel = state.playMode === 'tournament'
    ? 'Fortsett pågående turnering'
    : 'Fortsett pågående kamp';

  setSplashContinueState({
    visible: hasActiveMatch,
    label: continueLabel
  });

  showSplash();
}

document.addEventListener('DOMContentLoaded', boot);
