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
  const defaults = ['Spiller A', 'Spiller B'];

  function toTrimmed(value){
    if(value === undefined || value === null) return '';
    return value.toString().trim();
  }

  function coerceEntry(entry, fallback){
    if(entry === undefined || entry === null) return fallback;

    if(typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'){
      const str = toTrimmed(entry);
      return str || fallback;
    }

    if(Array.isArray(entry)){
      const joined = entry.map(toTrimmed).filter(Boolean).join(' / ');
      return joined || fallback;
    }

    if(typeof entry === 'object'){
      if(typeof entry.display === 'string' && entry.display.trim()){
        return entry.display.trim();
      }
      if(typeof entry.teamName === 'string' && entry.teamName.trim()){
        return entry.teamName.trim();
      }

      var players = [];
      if(Array.isArray(entry.players)){
        players = entry.players.slice();
      }else if(entry.players && typeof entry.players === 'object'){
        if(Object.prototype.hasOwnProperty.call(entry.players, 'p1')) players.push(entry.players.p1);
        if(Object.prototype.hasOwnProperty.call(entry.players, 'p2')) players.push(entry.players.p2);
        if(Object.prototype.hasOwnProperty.call(entry.players, 'p3')) players.push(entry.players.p3);
      }else if(Array.isArray(entry.names)){
        players = entry.names.slice();
      }

      if(players.length){
        const joinedPlayers = players.map(toTrimmed).filter(Boolean).join(' / ');
        if(joinedPlayers) return joinedPlayers;
      }
    }

    return fallback;
  }

  function readEntry(data, index){
    if(Array.isArray(data)){
      return data[index];
    }
    if(!data || typeof data !== 'object') return null;

    const side = index === 0 ? 'A' : 'B';
    const keys = [
      side,
      side.toLowerCase(),
      String(index),
      index === 0 ? 'left' : 'right',
      index === 0 ? 'teamA' : 'teamB'
    ];

    for(var i = 0; i < keys.length; i++){
      var key = keys[i];
      if(Object.prototype.hasOwnProperty.call(data, key)) return data[key];
    }

    return null;
  }

  try{
    const raw = localStorage.getItem(LS.LAST);
    if(!raw) return null;

    const parsed = JSON.parse(raw);
    const values = [readEntry(parsed, 0), readEntry(parsed, 1)];

    let hasStoredValue = false;
    const normalized = defaults.map(function(fallback, index){
      const value = values[index];
      if(value !== undefined && value !== null) hasStoredValue = true;
      return coerceEntry(value, fallback);
    });

    return hasStoredValue ? normalized : null;
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
