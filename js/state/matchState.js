import { LS } from '../constants.js';
import { $ } from '../ui/dom.js';

export const state = {
  scoreA:0, scoreB:0,
  setsA:0, setsB:0,
  target:21, cap:30,
  currentSet:1,
  swappedAt11:false,
  locked:false, swapping:false,
  betweenSets:false,
  pendingSetWinner:null,
  setHistory:[],
  allowScoring:false,
  nameEditMode:false,
  namesSavedThisMatch:false,
  VIEW_MODE: 'match',
  IS_SPECTATOR: (new URL(location.href).searchParams.get('mode')||'control').toLowerCase()==='spectator'
};

export function saveLiveState(readABFromModalInputs){
  try{
    const n = readABFromModalInputs();
    const data = {
      scoreA:state.scoreA, scoreB:state.scoreB,
      setsA:state.setsA, setsB:state.setsB,
      currentSet:state.currentSet, swappedAt11:state.swappedAt11,
      locked:state.locked, setHistory:state.setHistory,
      names:{A:n.A,B:n.B},
      isALeft: $('#sideA')?.classList.contains('left') || false,
      winnerMsg: (document.getElementById('winnerMsg')?.textContent)||'',
      summaryVisible: (document.getElementById('summaryMask')?.style.display==='flex'),
      allowScoring:state.allowScoring,
      nameEditMode:state.nameEditMode,
      betweenSets:state.betweenSets
    };
    localStorage.setItem(LS.LIVE, JSON.stringify(data));
  }catch{}
}

export function restoreLiveState(writeModalInputsFromAB, updateNameChips, setSidesDomTo){
  try{
    const raw = localStorage.getItem(LS.LIVE); if(!raw) return false;
    const d = JSON.parse(raw);
    state.scoreA=d.scoreA||0; state.scoreB=d.scoreB||0;
    state.setsA=d.setsA||0; state.setsB=d.setsB||0;
    state.currentSet=d.currentSet||1; state.swappedAt11=!!d.swappedAt11;
    state.locked=!!d.locked; state.setHistory=Array.isArray(d.setHistory)?d.setHistory:[];
    writeModalInputsFromAB(d.names?.A||'Spiller A', d.names?.B||'Spiller B');
    updateNameChips?.();
    setSidesDomTo(!(d.isALeft===false));
    document.getElementById('winnerMsg').textContent = d.winnerMsg||'';
    if(d.summaryVisible){ const mask = document.getElementById('summaryMask'); if(mask){mask.style.display='flex';} }
    state.allowScoring=!!d.allowScoring; state.nameEditMode=!!d.nameEditMode; state.betweenSets=!!d.betweenSets;
    const ns=document.getElementById('nextSetBtn');
    if(ns) ns.style.display=(!state.IS_SPECTATOR && state.betweenSets)?'block':'none';
    return true;
  }catch{ return false; }
}

export function clearLiveState(){ try{ localStorage.removeItem(LS.LIVE) }catch{} }

