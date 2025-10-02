// Firebase sync for alle roller - konsoliderer spectator.js + counterRead.js
import { state, getDisplayName } from '../state/matchState.js';
import { updateCurrentWriter } from './writeAccess.js';

// Firebase binding state
let _boundRef = null;
let _onValue = null;
let _currentRole = null;
let _writeErrorCount = 0; // Track consecutive write errors
let _suppressReadsUntil = 0; // Suppress reads after write errors

// Previous values for change detection
const prev = {
  scoreA: null,
  scoreB: null,
  setsA: null,
  setsB: null,
  isALeft: null
};

// Swap state to prevent loops (from counterRead.js)
let _swapInProgress = false;

// Spectator-specific state (from spectator.js)
let isSwapping = false;
let pendingZero = false;

// Injected UI callbacks (dependency injection pattern)
let _updateScores = function(){};
let _fitScores = function(){};
let _handleScoreBump = function(){};
let _clearWinner = function(){};
let _getSuppressUntil = function(){};
let _startVisualSwap = function(){};
let _setSidesDomTo = function(){};

/**
 * Set dependencies for UI callbacks
 * Replaces: setSpectatorDependencies + setCounterReadDependencies
 */
export function setFirebaseSyncDependencies(deps){
  deps = deps || {};
  if (typeof deps.updateScores === 'function') _updateScores = deps.updateScores;
  if (typeof deps.fitScores === 'function') _fitScores = deps.fitScores;
  if (typeof deps.handleScoreBump === 'function') _handleScoreBump = deps.handleScoreBump;
  if (typeof deps.clearWinner === 'function') _clearWinner = deps.clearWinner;
  if (typeof deps.getSuppressUntil === 'function') _getSuppressUntil = deps.getSuppressUntil;
  if (typeof deps.startVisualSwap === 'function') _startVisualSwap = deps.startVisualSwap;
  if (typeof deps.setSidesDomTo === 'function') _setSidesDomTo = deps.setSidesDomTo;
}

/**
 * Unbind Firebase listeners
 * Replaces: unbindCounterRead + spectator cleanup
 */
export function unbindFirebaseSync(){
  try {
    if (_boundRef && _onValue) _boundRef.off('value', _onValue);
  } catch (e) {}
  _boundRef = null;
  _onValue = null;
  _currentRole = null;
}

/**
 * Report Firebase write error to suppress conflicting reads
 */
export function reportFirebaseWriteError(error) {
  _writeErrorCount++;
  console.warn('[FIREBASE SYNC] Write error reported:', error, 'Count:', _writeErrorCount);
  
  // Suppress reads for increasing duration based on error count
  var suppressDuration = Math.min(_writeErrorCount * 1000, 10000); // Max 10 seconds
  _suppressReadsUntil = Date.now() + suppressDuration;
  
  console.log('[FIREBASE SYNC] Suppressing reads for', suppressDuration, 'ms');
}

/**
 * Clear write error state (call when write succeeds)
 */
export function clearFirebaseWriteErrors() {
  if (_writeErrorCount > 0) {
    console.log('[FIREBASE SYNC] Clearing write error state');
    _writeErrorCount = 0;
    _suppressReadsUntil = 0;
  }
}

/**
 * Set name chips directly (utility from spectator.js)
 */
export function setNameChipsDirect(nameA, nameB){
  var ca = document.getElementById('nameA_chip');
  var cb = document.getElementById('nameB_chip');
  
  // Handle both string and object formats
  const aDisplay = getDisplayName(nameA, 'A');
  const bDisplay = getDisplayName(nameB, 'B');
  
  if(ca) ca.textContent = aDisplay;
  if(cb) cb.textContent = bDisplay;
}

// Note: startVisualSwapSpectator removed - using injected _startVisualSwap instead

/**
 * Main Firebase sync function
 * Replaces: bindSpectatorHandlers + bindCounterReadHandlers
 * 
 * Roles:
 * - spectator: Read-only viewer
 * - counter: Active teller with write access
 * - cocounter: Medteller (same as counter but without current write access)
 */
export function bindFirebaseSync(options){
  const { role, ref, canWrite = false } = options;
  
  unbindFirebaseSync(); // Ensure clean binding
  if (!ref) return function(){};
  
  _boundRef = ref;
  _currentRole = role;
  
  _onValue = function(snap){
    var v = snap && snap.val ? snap.val() : null;
    if (!v) return;
    
    // Suppress reads if we're having write permission issues
    if (_suppressReadsUntil > Date.now()) {
      console.log('[FIREBASE READ] Suppressing read due to recent write errors');
      return;
    }
    
    // Debug logging for counter role
    if (role === 'counter') {
      console.log('[FIREBASE READ] Received data:', {
        scores: v.scores, sets: v.sets, currentSet: v.currentSet
      });
    }
    
    // Extract values
    var nextIsALeft = !!v.isALeft;
    var a = Number(v.scores?.A || 0);
    var b = Number(v.scores?.B || 0);
    var setsA = Number(v.sets?.A || 0);
    var setsB = Number(v.sets?.B || 0);
    
    // Store previous values for bump detection (counter role)
    var prevScoreA = prev.scoreA;
    var prevScoreB = prev.scoreB;
    
    // Spectator-specific logic for set changes and zero drops
    if (role === 'spectator') {
      var isSetChange = (prev.setsA != null && (prev.setsA !== setsA || prev.setsB !== setsB));
      var dropToZero = (a === 0 && b === 0) && ((prev.scoreA > 0) || (prev.scoreB > 0));
      var wantSwap = (prev.isALeft !== null) && (prev.isALeft !== nextIsALeft);

      if(dropToZero && (wantSwap || isSwapping)){
        pendingZero = true;
        a = typeof prev.scoreA === 'number' ? prev.scoreA : a;
        b = typeof prev.scoreB === 'number' ? prev.scoreB : b;
      }
    }
    
    // Update state
    state.scoreA = a;
    state.scoreB = b;
    state.setsA = setsA;
    state.setsB = setsB;
    state.currentSet = Number(v.currentSet || state.currentSet);
    state.isALeft = nextIsALeft;
    
    // Update names
    if (v.names) {
      state.nameA = v.names.A;
      state.nameB = v.names.B;
    }
    if (v.format) {
      state.format = v.format;
      // Update match discipline and play mode from format data
      if (v.format.discipline && v.format.discipline !== state.matchDiscipline) {
        console.log('[FIREBASE SYNC] Updating matchDiscipline from', state.matchDiscipline, 'to', v.format.discipline);
        state.matchDiscipline = v.format.discipline;
        // Update UI to reflect discipline change - use setTimeout to avoid timing issues
        if (typeof window.updateModalLayout === 'function') {
          setTimeout(() => {
            try {
              window.updateModalLayout();
            } catch(error) {
              console.warn('[FIREBASE SYNC] Failed to update modal layout:', error);
            }
          }, 100);
        }
      }
      if (v.format.playMode && v.format.playMode !== state.playMode) {
        console.log('[FIREBASE SYNC] Updating playMode from', state.playMode, 'to', v.format.playMode);
        state.playMode = v.format.playMode;
      }
    }
    if (typeof v.msg !== 'undefined') state.msg = v.msg;
    
    // Update current writer (for counter/cocounter roles)
    // Skip in local-only mode to prevent incorrect write access assignment
    if (typeof v.currentWriter !== 'undefined' && (role === 'counter' || role === 'cocounter') && !window._badmintonLocalOnlyMode) {
      updateCurrentWriter(v.currentWriter);
    }
    
    // Set name chips
    setNameChipsDirect(v.names?.A, v.names?.B);
    
    // Handle side swapping
    if(prev.isALeft === null){
      // First load - set DOM to match state
      try { _setSidesDomTo(nextIsALeft); } catch(_){}
    } else if(prev.isALeft !== nextIsALeft){
      // Side swap detected
      console.log('[SWAP DEBUG] Side swap detected - prev.isALeft:', prev.isALeft, 'nextIsALeft:', nextIsALeft, 'role:', role, '_swapInProgress:', _swapInProgress, 'state.swapping:', state.swapping);
      
      if (role === 'spectator') {
        try { _startVisualSwap(); } catch(_){}
      } else if ((role === 'counter' || role === 'cocounter') && !_swapInProgress && !state.swapping) {
        // Counter role: use disable/enable pattern to prevent loops
        console.log('[SWAP DEBUG] Side swap detected - executing with disable/enable pattern');
        _swapInProgress = true;
        
        // Temporarily disable Firebase reads during swap
        unbindFirebaseSync();
        
        try { 
          _startVisualSwap(() => {
            // Re-enable Firebase reads AFTER swap animation AND score reset is complete
            console.log('[SWAP DEBUG] Re-enabling Firebase reads after swap completion');
            _swapInProgress = false;
            // Note: Rebinding should be handled by calling code
          });
        } catch(error) {
          console.warn('[SWAP DEBUG] Swap failed, re-enabling reads:', error);
          _swapInProgress = false;
          // Don't rebind on error to avoid loops
        }
      }
    }
    
    // Update UI
    _updateScores();
    
    // Get DOM elements (used by both roles)
    var elA = document.getElementById('A_digits');
    var elB = document.getElementById('B_digits');
    
    // Handle bump effects (role-specific logic)
    if ((role === 'counter' || role === 'cocounter') && canWrite) {
      // Counter/CoCounter with write access: Check for score changes and trigger bumps (with suppression)
      if (prevScoreA !== null && prevScoreA !== state.scoreA) {
        var suppressUntil = _getSuppressUntil('A');
        if (suppressUntil && Date.now() < suppressUntil) {
          console.log('[FIREBASE DEBUG] Player A bump suppressed due to recent local action');
        } else {
          console.log('[FIREBASE DEBUG] Player A score changed, triggering bump');
          try { _handleScoreBump(prevScoreA, state.scoreA, elA); } catch(_){}
        }
      }
      
      if (prevScoreB !== null && prevScoreB !== state.scoreB) {
        var suppressUntil = _getSuppressUntil('B');
        if (suppressUntil && Date.now() < suppressUntil) {
          console.log('[FIREBASE DEBUG] Player B bump suppressed due to recent local action');
        } else {
          console.log('[FIREBASE DEBUG] Player B score changed, triggering bump');
          try { _handleScoreBump(prevScoreB, state.scoreB, elB); } catch(_){}
        }
      }
    } else if (role === 'counter' || role === 'cocounter') {
      // Counter/CoCounter without write access: Show bumps from Firebase changes (no suppression)
      if (prevScoreA !== null && prevScoreA !== state.scoreA) {
        try { _handleScoreBump(prevScoreA, state.scoreA, elA); } catch(_){}
      }
      if (prevScoreB !== null && prevScoreB !== state.scoreB) {
        try { _handleScoreBump(prevScoreB, state.scoreB, elB); } catch(_){}
      }
    } else if (role === 'spectator') {
      // Spectator: Handle bump effects with suppression logic
      try{ _fitScores(); }catch(_){}
      
      var isSetChange = (prev.setsA != null && (prev.setsA !== setsA || prev.setsB !== setsB));
      var dropToZero = (a === 0 && b === 0) && ((prev.scoreA > 0) || (prev.scoreB > 0));
      var suppressBumps = isSetChange || dropToZero;

      if(!suppressBumps && prevScoreA !== null && prevScoreB !== null){
        try { _handleScoreBump(prevScoreA, a, elA); } catch(_){}
        try { _handleScoreBump(prevScoreB, b, elB); } catch(_){}
      }else{
        elA?.classList.remove('pop','popMinus');
        elB?.classList.remove('pop','popMinus');
      }
      
      // Queue fit for layout changes
      if(prev.isALeft === null || prev.isALeft !== nextIsALeft) try{ _fitScores(); }catch(_){}
      if(prev.setsA != null && (prev.setsA !== setsA || prev.setsB !== setsB)) try{ _fitScores(); }catch(_){}
    }
    
    // Winner highlighting (shared by both roles)
    try { 
      _clearWinner();
      
      // Mark winner based on sets (best of three)
      var finished = (setsA >= 2) || (setsB >= 2);
      if (finished) {
        if (setsA > setsB) {
          var sa = document.getElementById('scoreA');
          var na = document.getElementById('nameA_chip');
          if (sa) sa.classList.add('winner');
          if (na) na.classList.add('winnerName');
        } else if (setsB > setsA) {
          var sb = document.getElementById('scoreB');
          var nb = document.getElementById('nameB_chip');
          if (sb) sb.classList.add('winner');
          if (nb) nb.classList.add('winnerName');
        }
      }
    } catch(_){}
    
    // Update previous values for next comparison
    prev.scoreA = state.scoreA;
    prev.scoreB = state.scoreB;
    prev.setsA = state.setsA;
    prev.setsB = state.setsB;
    prev.isALeft = nextIsALeft;
  };
  
  // Bind Firebase listener
  if (role === 'spectator') {
    ref.off(); // Clean slate for spectator
  }
  ref.on('value', _onValue);
  
  return unbindFirebaseSync;
}

// Legacy function removed - spectator.js fully replaced
