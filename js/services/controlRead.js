// Enkel leser for kontroll-modus – ingen writes her.
import { state } from '../state/matchState.js';

var _boundRef = null;
var _onValue = null;

// Previous values for bump detection and swap detection
const prev = {
  scoreA: null,
  scoreB: null,
  setsA: null,
  setsB: null,
  isALeft: null
};

// Swap suppression to prevent loops
let _lastSwapTime = 0;
const SWAP_SUPPRESS_MS = 2000; // 2 seconds


// Injiserte UI-callbacks (unngå window.*)
let _updateScores = function(){};
let _fitScores = function(){};
let _handleScoreBump = function(){};
let _getSuppressUntil = function(){};
let _startVisualSwap = function(){};
let _setSidesDomTo = function(){};

export function setControlReadDependencies(deps){
  deps = deps || {};
  if (typeof deps.updateScores === 'function') _updateScores = deps.updateScores;
  if (typeof deps.fitScores === 'function') _fitScores = deps.fitScores;
  if (typeof deps.handleScoreBump === 'function') _handleScoreBump = deps.handleScoreBump;
  if (typeof deps.getSuppressUntil === 'function') _getSuppressUntil = deps.getSuppressUntil;
  if (typeof deps.startVisualSwap === 'function') _startVisualSwap = deps.startVisualSwap;
  if (typeof deps.setSidesDomTo === 'function') _setSidesDomTo = deps.setSidesDomTo;
}


export function unbindControlRead(){
  try {
    if (_boundRef && _onValue) _boundRef.off('value', _onValue);
  } catch (e) {}
  _boundRef = null;
  _onValue = null;
}

export function bindControlReadHandlers(ref){
  unbindControlRead(); // sikre én binding
  if (!ref) return function(){};
  _boundRef = ref;
  _onValue = function(snap){
    var v = snap && snap.val ? snap.val() : null;
    if (!v) return;
    
    console.log('[FIREBASE READ] Received data:', {
      scores: v.scores, sets: v.sets, currentSet: v.currentSet
    });
    
    
    // Store previous values for bump detection
    var prevScoreA = prev.scoreA;
    var prevScoreB = prev.scoreB;
    
    // Hydrer felter vi viser i kontroll
    if (v.scores){
      state.scoreA = v.scores.A|0;
      state.scoreB = v.scores.B|0;
    }
    if (v.sets){
      state.setsA = v.sets.A|0;
      state.setsB = v.sets.B|0;
    }
    if (typeof v.currentSet !== 'undefined') state.currentSet = v.currentSet|0;
    if (typeof v.isALeft !== 'undefined') state.isALeft = !!v.isALeft;
    if (v.names) {
      state.nameA = v.names.A;
      state.nameB = v.names.B;
    }
    if (v.format) state.format = v.format;
    if (typeof v.msg !== 'undefined') state.msg = v.msg;
    
    // Handle side swapping based on isALeft changes (with suppression)
    var nextIsALeft = !!state.isALeft;
    if(prev.isALeft === null){
      // First load - set DOM to match state
      try { _setSidesDomTo(nextIsALeft); } catch(_){}
    } else if(prev.isALeft !== nextIsALeft){
      // Side swap detected - check if we should suppress
      var now = Date.now();
      if(now - _lastSwapTime > SWAP_SUPPRESS_MS){
        console.log('[SWAP DEBUG] Side swap detected - executing');
        _lastSwapTime = now;
        try { _startVisualSwap(); } catch(_){}
      } else {
        console.log('[SWAP DEBUG] Side swap detected but suppressed (too recent)');
      }
    }
    
    // Oppdater UI via injiserte callbacks
    try { _updateScores(); } catch(_){}
    try { _fitScores(); } catch(_){}
    
    // Suppress bumps logic (like spectator)
    var isSetChange = (prev.setsA != null) && (prev.setsA !== state.setsA || prev.setsB !== state.setsB);
    var dropToZero = (state.scoreA === 0 && state.scoreB === 0) && ((prev.scoreA > 0) || (prev.scoreB > 0));
    var suppressBumps = isSetChange || dropToZero;
    
    if(suppressBumps) {
      // Remove existing bump classes
      var elA = document.getElementById('A_digits');
      var elB = document.getElementById('B_digits');
      if(elA) elA.classList.remove('pop', 'popMinus');
      if(elB) elB.classList.remove('pop', 'popMinus');
    } else {
      // Bump effects for score changes with echo-guard
      var now = Date.now();
      if (prevScoreA !== null && state.scoreA !== prevScoreA) {
        if (now >= _getSuppressUntil('A')) {
          try { 
            _handleScoreBump(prevScoreA, state.scoreA, document.getElementById('A_digits')); 
          } catch(_){}
        }
      }
      if (prevScoreB !== null && state.scoreB !== prevScoreB) {
        if (now >= _getSuppressUntil('B')) {
          try { 
            _handleScoreBump(prevScoreB, state.scoreB, document.getElementById('B_digits')); 
          } catch(_){}
        }
      }
    }
    
    // Update previous values
    prev.scoreA = state.scoreA;
    prev.scoreB = state.scoreB;
    prev.setsA = state.setsA;
    prev.setsB = state.setsB;
    prev.isALeft = nextIsALeft;
  };
  ref.on('value', _onValue);
  return unbindControlRead;
}
