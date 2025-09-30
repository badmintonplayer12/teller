// js/ui/session.js
// Felles, ren og testbar hjelp for "aktiv kamp?" og "Fortsett"-etikett.

export function hasActiveMatchState(state){
  if(!state) return false;
  return !!(state.allowScoring ||
    state.scoreA > 0 ||
    state.scoreB > 0 ||
    state.setsA > 0 ||
    state.setsB > 0 ||
    (Array.isArray(state.setHistory) && state.setHistory.length > 0) ||
    state.betweenSets ||
    state.locked);
}

export function getContinueLabel(playMode){
  return playMode === 'tournament'
    ? 'Fortsett pågående turnering'
    : 'Fortsett pågående kamp';
}

// Ny: felles helper for "er vi ved helt fersk start av kamp?"
export function isAtStart(state){
  if(!state) return false;
  return (
    state.scoreA === 0 &&
    state.scoreB === 0 &&
    state.setsA === 0 &&
    state.setsB === 0 &&
    state.currentSet === 1 &&
    !state.locked
  );
}
