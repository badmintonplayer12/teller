// Enkel leser for kontroll-modus – ingen writes her.
import { state } from '../state/matchState.js';

var _boundRef = null;
var _onValue = null;

// Previous values for bump detection
const prev = {
  scoreA: null,
  scoreB: null,
  setsA: null,
  setsB: null
};

// Injiserte UI-callbacks (unngå window.*)
let _updateScores = function(){};
let _fitScores = function(){};
let _handleScoreBump = function(){};

export function setControlReadDependencies(deps){
  deps = deps || {};
  if (typeof deps.updateScores === 'function') _updateScores = deps.updateScores;
  if (typeof deps.fitScores === 'function') _fitScores = deps.fitScores;
  if (typeof deps.handleScoreBump === 'function') _handleScoreBump = deps.handleScoreBump;
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
    
    // Oppdater UI via injiserte callbacks
    try { _updateScores(); } catch(_){}
    try { _fitScores(); } catch(_){}
    
    // Bump effects for score changes (like spectator)
    try { 
      _handleScoreBump(prevScoreA, state.scoreA, document.getElementById('A_digits')); 
    } catch(_){}
    try { 
      _handleScoreBump(prevScoreB, state.scoreB, document.getElementById('B_digits')); 
    } catch(_){}
    
    // Update previous values
    prev.scoreA = state.scoreA;
    prev.scoreB = state.scoreB;
    prev.setsA = state.setsA;
    prev.setsB = state.setsB;
  };
  ref.on('value', _onValue);
  return unbindControlRead;
}
