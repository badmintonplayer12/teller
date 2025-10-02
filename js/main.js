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
  
  // Clean URL when going to start (remove mode/game parameters)
  cleanUrlForSplash();
  
  // Show splash
  showSplash();
}

// Helper to clean URL parameters when returning to splash
function cleanUrlForSplash() {
  try {
    const url = new URL(window.location);
    const hasParams = url.searchParams.has('mode') || url.searchParams.has('game');
    
    if (hasParams) {
      url.searchParams.delete('mode');
      url.searchParams.delete('game');
      window.history.replaceState({}, '', url.toString());
    }
  } catch(e) {
    // Ignore URL manipulation errors
  }
}

// Router helper: Navigate to counter mode (removes cocounter from URL)
export function navigateToCounterMode() {
  try {
    const url = new URL(window.location);
    url.searchParams.delete('mode'); // Remove mode to default to counter
    window.history.replaceState({}, '', url.toString());
    
    // Re-initialize with new mode instead of full reload
    setTimeout(() => {
      window.location.reload(); // For now, still reload to ensure clean state
    }, 0);
  } catch(e) {
    console.warn('Failed to navigate to counter mode:', e);
    window.location.reload(); // Fallback
  }
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

  const params = parseQuery();
  
  // Router: Handle different URL modes
  switch(params.mode) {
    case 'dashboard':
      return bootDashboard(params);
    case 'spectator':
    case 'counter': 
    case 'cocounter':
      return bootMatch(params);
    default:
      return bootSplash();
  }
}

// Dashboard mode boot
function bootDashboard(params) {
  if (!params.game) {
    console.warn('Dashboard mode requires game ID, redirecting to splash');
    return bootSplash();
  }
  
  state.IS_DASHBOARD = true;
  // Initialize Firebase and bind dashboard handlers
  import('./services/firebase.js').then(function(module) {
    module.setupFirebase({});
    // Wait for Firebase to be ready, then bind handlers
    setTimeout(function() {
      if (window.firebase && firebase.database) {
        var db = firebase.database();
        var ref = db.ref('games/' + params.game);
        bindDashboardHandlers(ref, function(v) {
          var t = v && v.tournament;
          renderTournamentOverviewFromSnapshot(t, v);
        });
      }
    }, 1000);
  });
}

// Match mode boot (spectator/counter/cocounter)
function bootMatch(params) {
  if (!params.game) {
    console.warn('Match mode requires game ID, redirecting to splash');
    return bootSplash();
  }
  
  // Initialize Firebase (it will read game ID from URL)
  import('./services/firebase.js').then(function(module) {
    module.setupFirebase({});
    
    // Wait for Firebase to be ready, then start match
    setTimeout(function() {
      if (window.firebase && firebase.database) {
        startMatchFlow({ 
          restored: false, // Don't restore from storage when joining via URL
          skipSplash: true, // We already handled splash
          directJoin: true // Joining via shared URL - enable scoring immediately
        });
      } else {
        console.error('Firebase not ready, redirecting to splash');
        showSplash(); // Show splash if Firebase fails
        bootSplash();
      }
    }, 1000);
  }).catch(function(error) {
    console.error('Failed to load Firebase:', error);
    showSplash(); // Show splash if Firebase fails
    bootSplash();
  });
}

// Default splash boot
function bootSplash() {
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
