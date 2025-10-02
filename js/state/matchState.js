import { LS } from '../constants.js';
import { qs } from '../dom.js';

const MODE = (qs('mode') || 'counter').toLowerCase();

export const state = {
  scoreA: 0,
  scoreB: 0,
  setsA: 0,
  setsB: 0,
  target: 21,
  cap: 30,
  currentSet: 1,
  swappedAt11: false,
  locked: false,
  swapping: false,
  betweenSets: false,
  pendingSetWinner: null,
  setHistory: [],
  allowScoring: false, // Workflow: false = setup/name-editing, true = active match
  role: 'writer', // TODO: Implement proper role-gating in later PR
  nameEditMode: false,
  matchDiscipline: 'single',
  playMode: 'singleMatch',
  VIEW_MODE: 'match',
  IS_SPECTATOR: MODE === 'spectator',
  IS_COUNTER: MODE === 'counter' || MODE === 'cocounter',
  IS_COCOUNTER: MODE === 'cocounter',
  tournamentData: { name: '', participants: [], matches: [], locked: false },
  ui: { nextNavHint: null }
};

const DEFAULT_NAMES = {
  single: {
    A: { players: ['Spiller A'], display: 'Spiller A' },
    B: { players: ['Spiller B'], display: 'Spiller B' }
  },
  double: {
    A: { players: ['Spiller A', 'Spiller A2'], display: 'Spiller A / Spiller A2', teamName: '' },
    B: { players: ['Spiller B', 'Spiller B2'], display: 'Spiller B / Spiller B2', teamName: '' }
  }
};

export const namesState = cloneNames(DEFAULT_NAMES.single);

let saveTimer = 0;

export function defaultPlayerName(side, index){
  if(index === 0) return side === 'A' ? 'Spiller A' : 'Spiller B';
  return side === 'A' ? 'Spiller A2' : 'Spiller B2';
}

export function normalizeNameEntry(value, side, discipline){
  const target = discipline || state.matchDiscipline;
  let players = [];

  if(value){
    if(typeof value === 'string'){
      players = [value];
    }else if(Array.isArray(value)){
      players = value.slice();
    }else if(value.players){
      if(Array.isArray(value.players)){
        players = value.players.slice();
      }else if(typeof value.players === 'object'){
        if(value.players.p1) players.push(value.players.p1);
        if(value.players.p2) players.push(value.players.p2);
      }
    }
  }

  players = players.map(function(p){ return (p || '').toString().trim(); }).filter(Boolean);

  if(target === 'double'){
    if(players.length === 0) players.push(defaultPlayerName(side, 0));
    if(players.length === 1) players.push(defaultPlayerName(side, 1));
    players = players.slice(0, 2);
  }else{
    if(players.length === 0) players.push(defaultPlayerName(side, 0));
    players = players.slice(0, 1);
  }

  const teamName = (value && typeof value.teamName === 'string' && value.teamName.trim())
    ? value.teamName.trim()
    : '';

  const display = teamName ? teamName : (value && typeof value.display === 'string' && value.display.trim())
    ? value.display.trim()
    : players.join(' / ');

  return { players, display, teamName };
}

export function alignNamesState(discipline){
  const target = discipline || state.matchDiscipline;
  namesState.A = normalizeNameEntry(namesState.A, 'A', target);
  namesState.B = normalizeNameEntry(namesState.B, 'B', target);
}

export function cloneNames(source){
  return {
    A: { players: source.A.players.slice(), display: source.A.display, teamName: source.A.teamName || '' },
    B: { players: source.B.players.slice(), display: source.B.display, teamName: source.B.teamName || '' }
  };
}

export function getDisplayName(entry, side, discipline){
  return normalizeNameEntry(entry, side, discipline).display;
}

export function serializeNameForSync(entry, side, discipline){
  const normalized = normalizeNameEntry(entry, side, discipline);
  const payload = {
    display: normalized.display,
    players: { p1: normalized.players[0] || defaultPlayerName(side, 0) }
  };
  if(normalized.players[1]) payload.players.p2 = normalized.players[1];
  if(normalized.teamName) payload.teamName = normalized.teamName;
  return payload;
}

export function serializeNames(entries, discipline){
  const disc = discipline || state.matchDiscipline;
  return {
    A: serializeNameForSync(entries.A, 'A', disc),
    B: serializeNameForSync(entries.B, 'B', disc)
  };
}

export function setMatchDiscipline(value){
  if(!value || value === state.matchDiscipline) return;
  state.matchDiscipline = value;
  alignNamesState(value);
}

export function setPlayMode(value){
  if(!value || value === state.playMode) return;
  state.playMode = value;
}

export function resetNamesForDiscipline(discipline){
  const defaults = cloneNames(DEFAULT_NAMES[discipline] || DEFAULT_NAMES.single);
  namesState.A = defaults.A;
  namesState.B = defaults.B;
}

export function saveLiveState(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    try{
      alignNamesState();
      const snapshot = serializeNames(namesState, state.matchDiscipline);
      const data = {
        scoreA: state.scoreA,
        scoreB: state.scoreB,
        setsA: state.setsA,
        setsB: state.setsB,
        currentSet: state.currentSet,
        swappedAt11: state.swappedAt11,
        locked: state.locked,
        setHistory: state.setHistory,
        names: snapshot,
        format: { discipline: state.matchDiscipline, playMode: state.playMode },
        isALeft: document.querySelector('.side.left')?.id === 'sideA',
        summaryVisible: document.getElementById('summaryMask')?.style.display === 'flex',
        allowScoring: state.allowScoring,
        nameEditMode: state.nameEditMode,
        betweenSets: state.betweenSets,
        tournamentData: state.playMode === 'tournament' ? state.tournamentData : null
      };
      localStorage.setItem(LS.LIVE, JSON.stringify(data));
    }catch(_){ }
  }, 80);
}

export function restoreLiveState(options){
  const {
    writeModalInputsFromNames,
    updateNameChips,
    setSidesDomTo,
    syncSplashButtons
  } = options || {};

  try{
    const raw = localStorage.getItem(LS.LIVE);
    if(!raw) return false;
    const d = JSON.parse(raw);

    state.scoreA = d.scoreA || 0;
    state.scoreB = d.scoreB || 0;
    state.setsA = d.setsA || 0;
    state.setsB = d.setsB || 0;
    state.currentSet = d.currentSet || 1;
    state.swappedAt11 = !!d.swappedAt11;
    state.locked = !!d.locked;
    state.setHistory = Array.isArray(d.setHistory) ? d.setHistory : [];
    state.allowScoring = !!d.allowScoring;
    state.nameEditMode = !!d.nameEditMode;
    state.betweenSets = !!d.betweenSets;
    state.matchDiscipline = d.matchDiscipline || d.format?.discipline || 'single';
    state.playMode = d.playMode || d.format?.playMode || 'singleMatch';
    // Only restore tournament data if in tournament mode
    if(state.playMode === 'tournament'){
      state.tournamentData = d.tournamentData || null;
    } else {
      state.tournamentData = null;
    }

    const storedNames = d.names;
    if(storedNames && storedNames.A && storedNames.B){
      namesState.A = normalizeNameEntry(storedNames.A, 'A', state.matchDiscipline);
      namesState.B = normalizeNameEntry(storedNames.B, 'B', state.matchDiscipline);
    }else if(Array.isArray(storedNames)){
      namesState.A = normalizeNameEntry(storedNames[0], 'A', state.matchDiscipline);
      namesState.B = normalizeNameEntry(storedNames[1], 'B', state.matchDiscipline);
    }else{
      namesState.A = normalizeNameEntry(storedNames?.A || 'Spiller A', 'A', state.matchDiscipline);
      namesState.B = normalizeNameEntry(storedNames?.B || 'Spiller B', 'B', state.matchDiscipline);
    }
    
    // Migrate old string format to new object format if needed
    if(typeof namesState.A === 'string'){
      namesState.A = normalizeNameEntry(namesState.A, 'A', state.matchDiscipline);
    }
    if(typeof namesState.B === 'string'){
      namesState.B = normalizeNameEntry(namesState.B, 'B', state.matchDiscipline);
    }

    alignNamesState();

    if(writeModalInputsFromNames){
      writeModalInputsFromNames(namesState);
    }
    if(updateNameChips) updateNameChips();
    if(setSidesDomTo) setSidesDomTo(!(d.isALeft === false));


    const summaryMask = document.getElementById('summaryMask');
    if(summaryMask) summaryMask.style.display = d.summaryVisible ? 'flex' : 'none';

    const nextSetBtn = document.getElementById('nextSetBtn');
    if(nextSetBtn) nextSetBtn.style.display = (!state.IS_SPECTATOR && state.betweenSets) ? 'block' : 'none';

    if(syncSplashButtons) syncSplashButtons();
    return true;
  }catch(_){
    return false;
  }
}

export function clearLiveState(force = false){
  try{
    localStorage.removeItem(LS.LIVE);
    // Only clear tournament data if not in tournament mode, unless forced
    if(force || state.playMode !== 'tournament'){
      state.tournamentData = null;
    }
  }catch(_){ }
}
