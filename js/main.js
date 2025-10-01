import { state } from './state/matchState.js';
import { mount, startMatchFlow, restoreFromStorage, applyRestoredState } from './ui/matchView.js';
import { showSplash, hideSplash, setSplashContinueState } from './ui/splash.js';
import { hasActiveMatchState, getContinueLabel } from './ui/session.js';
import { setupStatsModal } from './ui/statsView.js';
import { bindDashboardHandlers, ensureGameId } from './services/firebase.js';
import { renderTournamentOverviewFromSnapshot } from './ui/tournamentOverview.js';

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

function parseQuery(){
  try {
    var params = new URL(location.href).searchParams;
    return {
      mode: params.get('mode'),
      game: params.get('game')
    };
  } catch(_) {
    return {};
  }
}

function boot(){
  mount();
  setupStatsModal();

  // Check for dashboard mode
  var q = parseQuery();
  if (q.mode === 'dashboard' && q.game) {
    state.IS_DASHBOARD = true;
    // Initialize Firebase and bind dashboard handlers
    import('./services/firebase.js').then(function(module) {
      module.setupFirebase({});
      // Wait for Firebase to be ready, then bind handlers
      setTimeout(function() {
        if (window.firebase && firebase.database) {
          var db = firebase.database();
          var ref = db.ref('games/' + q.game);
          bindDashboardHandlers(ref, function(v) {
            var t = v && v.tournament;
            renderTournamentOverviewFromSnapshot(t, v);
          });
        }
      }, 1000);
    });
    return;
  }

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
