import { LS } from '../constants.js';

export function loadMatches(){ try{ return JSON.parse(localStorage.getItem(LS.MATCHES)||'[]') }catch{ return [] } }
export function saveMatches(list){ try{ localStorage.setItem(LS.MATCHES, JSON.stringify(list)) }catch{} }

export function saveLastNames(a,b){ try{ localStorage.setItem(LS.LAST, JSON.stringify([a,b])) }catch{} }
export function loadLastNames(){ try{ return JSON.parse(localStorage.getItem(LS.LAST)||'[]') }catch{ return [] } }

export function getPrevNames(){ try{ const arr=JSON.parse(localStorage.getItem(LS.PREV)||'[]'); return Array.isArray(arr)?arr:[] }catch{ return [] } }
export function setPrevNames(arr){ try{ localStorage.setItem(LS.PREV, JSON.stringify(arr.slice(0,100))) }catch{} }
export function pushPrev(n){
  n=(n||'').trim(); if(!n) return;
  const arr=getPrevNames().filter(x=>x!==n); arr.unshift(n); setPrevNames(arr);
}
export function getRecentNames(limit){ return getPrevNames().slice(0,limit||6); }

