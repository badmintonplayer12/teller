import { state } from './state/matchState.js';
import { mount, startMatchFlow, restoreFromStorage, applyRestoredState } from './ui/matchView.js';
import { showSplash, hideSplash, setSplashContinueState } from './ui/splash.js';
import { hasActiveMatchState, getContinueLabel } from './ui/session.js';
import { setupStatsModal } from './ui/statsView.js';
import { bindDashboardHandlers, ensureGameId } from './services/firebase.js';
import { renderTournamentOverviewFromSnapshot } from './ui/tournamentOverview.js';
import { initHeader } from './ui/header.js';

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
  initHeader();

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
  console.log('[BOOT] bootMatch called with params:', params);
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
        console.log('[BOOT] Checking mode for offline handling:', params.mode);
        // Check if this is an offline situation (cocounter trying to join)
        if (params.mode === 'cocounter' || params.mode === 'spectator') {
          console.log('[BOOT] Attempting to show offline modal for:', params.mode);
          // Show offline choice modal for cocounter/spectator
          import('./ui/modal.js').then(({ openModal }) => {
            console.log('[BOOT] Modal module loaded, attempting to open modal');
            const modal = document.querySelector('#offlineChoiceMask');
            console.log('[BOOT] Modal element found:', !!modal);
            console.log('[BOOT] Modal classes before open:', modal?.className);
            console.log('[BOOT] Modal display before open:', modal?.style.display);
            // Remove hidden class before opening modal
            modal?.classList.remove('hidden');
            openModal('#offlineChoiceMask');
            console.log('[BOOT] Modal classes after open:', modal?.className);
            console.log('[BOOT] Modal display after open:', modal?.style.display);
            // Update modal text for cocounter/spectator
            const title = modal?.querySelector('h2');
            const description = modal?.querySelector('p');
            const retryBtn = modal?.querySelector('[data-retry]');
            const localBtn = modal?.querySelector('[data-local]');
            
            if (title) title.textContent = 'Får ikke kontakt med server';
            if (description) description.textContent = 'Vi kan ikke koble til kampen. Sjekk nettverksforbindelsen din.';
            if (localBtn) localBtn.textContent = 'Avbryt';
            
            retryBtn?.addEventListener('click', () => {
              window.location.reload(); // Simple retry
            }, { once: true });
            
            localBtn?.addEventListener('click', () => {
              // Go to splash (avbryt)
              showSplash();
              bootSplash();
            }, { once: true });
          }).catch(err => {
            console.error('[BOOT] Failed to load modal module:', err);
          });
        } else {
          showSplash(); // Show splash if Firebase fails for counter
          bootSplash();
        }
      }
    }, 1000);
  }).catch(function(error) {
    console.error('Failed to load Firebase:', error);
    // Check if this is an offline situation (cocounter trying to join)
    if (params.mode === 'cocounter' || params.mode === 'spectator') {
      // Show offline choice modal for cocounter/spectator
      import('./ui/modal.js').then(({ openModal }) => {
        openModal('#offlineChoiceMask');
        // Update modal text for cocounter/spectator
        const modal = document.querySelector('#offlineChoiceMask');
        const title = modal?.querySelector('h2');
        const description = modal?.querySelector('p');
        const retryBtn = modal?.querySelector('[data-retry]');
        const localBtn = modal?.querySelector('[data-local]');
        
        if (title) title.textContent = 'Får ikke kontakt med server';
        if (description) description.textContent = 'Vi kan ikke koble til kampen. Sjekk nettverksforbindelsen din.';
        if (localBtn) localBtn.textContent = 'Avbryt';
        
        retryBtn?.addEventListener('click', () => {
          window.location.reload(); // Simple retry
        }, { once: true });
        
        localBtn?.addEventListener('click', () => {
          // Go to splash (avbryt)
          showSplash();
          bootSplash();
        }, { once: true });
      });
    } else {
      showSplash(); // Show splash if Firebase fails for counter
      bootSplash();
    }
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
