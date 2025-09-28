import { LS } from '../constants.js';

export function loadMatches(){
  try{
    const raw = localStorage.getItem(LS.MATCHES);
    return raw ? JSON.parse(raw) : [];
  }catch(_){
    return [];
  }
}

export function saveMatches(list){
  try{
    localStorage.setItem(LS.MATCHES, JSON.stringify(list));
  }catch(_){ }
}

export function saveLastNames(a,b){
  try{
    localStorage.setItem(LS.LAST, JSON.stringify([a,b]));
  }catch(_){ }
  pushPrev(a);
  pushPrev(b);
}

export function loadLastNames(){
  try{
    const raw = localStorage.getItem(LS.LAST);
    return raw ? JSON.parse(raw) : null;
  }catch(_){
    return null;
  }
}

export function getPrevNames(){
  try{
    const arr = JSON.parse(localStorage.getItem(LS.PREV) || '[]');
    return Array.isArray(arr) ? arr : [];
  }catch(_){
    return [];
  }
}

export function setPrevNames(arr){
  try{
    localStorage.setItem(LS.PREV, JSON.stringify(arr.slice(0,100)));
  }catch(_){ }
}

export function pushPrev(name){
  // Handle both string and object formats
  const nameStr = typeof name === 'string' ? name : (name?.display || name?.teamName || '');
  const trimmed = (nameStr || '').trim();
  if(!trimmed) return;
  
  // Don't save team names (names containing " / ") to autocomplete
  if(trimmed.includes(' / ')) return;
  
  const arr = getPrevNames().filter(function(x){ return x !== trimmed; });
  arr.unshift(trimmed);
  setPrevNames(arr);
}

export function getRecentNames(limit){
  const arr = getPrevNames();
  return arr.slice(0, limit || 6);
}
