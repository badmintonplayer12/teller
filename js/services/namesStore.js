// js/services/namesStore.js
import { pushPrev } from './storage.js';

export function saveIndividual(name){
  if(!name) return;
  const n = String(name).trim();
  if(!n) return;
  // (Ingen filter på " / " her – både enkelt- og lagnavn kan lagres.
  // Filtrering skjer der vi leser ut kandidatene.)
  pushPrev(n);
}

export function saveFromAB(names, discipline){
  if(!names) return;
  // Singel: names.A og names.B er strenger
  if(discipline === 'single' || !discipline){
    if(typeof names.A === 'string') saveIndividual(names.A);
    if(typeof names.B === 'string') saveIndividual(names.B);
    return;
  }
  // Dobbel: names.{A,B}.players = [p1, p2]
  if(discipline === 'double'){
    if(names.A && Array.isArray(names.A.players)){
      names.A.players.forEach(saveIndividual);
    }
    if(names.B && Array.isArray(names.B.players)){
      names.B.players.forEach(saveIndividual);
    }
  }
}

export function bindNameInput(input){
  if(!input) return;
  // Save name when user types manually
  input.addEventListener('blur', function(){
    const name = this.value.trim();
    if(name && name.length > 0){
      saveIndividual(name);
    }
  });
}
