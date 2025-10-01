// Enkel leser for kontroll-modus – ingen writes her.
import { state } from '../state/matchState.js';

var _boundRef = null;
var _onValue = null;

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
    
    // Kall eksisterende UI-oppdaterere hvis de finnes
    try { 
      if (typeof window.updateScores === 'function') window.updateScores(); 
    } catch(e){}
    try { 
      if (typeof window.fitScores === 'function') window.fitScores(); 
    } catch(e){}
    try { 
      if (typeof window.renderNames === 'function') window.renderNames(); 
    } catch(e){}
    try { 
      if (typeof window.renderFormatBadges === 'function') window.renderFormatBadges(); 
    } catch(e){}
  };
  ref.on('value', _onValue);
  return unbindControlRead;
}
