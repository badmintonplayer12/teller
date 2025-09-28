import { state } from './state/matchState.js';
import { mount, startMatchFlow, restoreFromStorage, applyRestoredState } from './ui/matchView.js';
import { showSplash, hideSplash } from './ui/splash.js';

function boot(){
  mount();

  const restored = restoreFromStorage();
  if(restored) applyRestoredState();

  if(state.IS_SPECTATOR){
    hideSplash();
    startMatchFlow({ restored: restored });
    return;
  }

  if(restored){
    hideSplash();
    startMatchFlow({ restored: true });
  }else{
    showSplash();
  }
}

document.addEventListener('DOMContentLoaded', boot);
