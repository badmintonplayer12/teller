import { state } from '../state/matchState.js';
import { setBodyScroll, $ } from '../dom.js';
import { openModal, closeModal } from './modal.js';
import { saveLastNames, getRecentNames } from '../services/storage.js';
import { saveIndividual, saveFromAB } from '../services/namesStore.js';
import { readABFromModalInputs, writeModalInputsFromAB, updateNameChipsFromModal } from './layout.js';
import { attachAutocomplete, toggleDropdownFor, updateDropdownButtons } from './autocomplete.js';


export function updateModalLayout(){
  const singleNames = $('#singleNames');
  const doubleNames = $('#doubleNames');
  const nameCard = $('.nameCard');
  
  if(state.matchDiscipline === 'double'){
    if(singleNames) singleNames.style.display = 'none';
    if(doubleNames) doubleNames.style.display = 'grid';
    if(nameCard) nameCard.classList.add('double');
  } else {
    if(singleNames) singleNames.style.display = 'grid';
    if(doubleNames) doubleNames.style.display = 'none';
    if(nameCard) nameCard.classList.remove('double');
  }
}

export function showNameModal(startMode){
  state.nameEditMode = true;
  state.allowScoring = false;
  renderRecentOptions();
  
  // Show/hide appropriate name fields based on discipline
  updateModalLayout();
  
  // Update dropdown button visibility based on available names
  updateDropdownButtons('#nameMask');
  
  openModal('#nameMask', {
    focus: state.matchDiscipline === 'double' ? '#teamNameA' : '#nameA'
  });

  // Load current names into modal
  const currentNames = readABFromModalInputs();
  writeModalInputsFromAB(currentNames.A, currentNames.B);
  updateNameChips();

  var startBtn = $('#btnStart');
  var saveBtn = $('#btnSaveNames');
  if(startMode){
    if(startBtn) startBtn.style.display = 'inline-block';
    if(saveBtn) saveBtn.style.display = 'none';
  }else{
    if(startBtn) startBtn.style.display = 'none';
    if(saveBtn) saveBtn.style.display = 'inline-block';
  }
}

export function hideNameModal(){
  state.nameEditMode = false;
  closeModal('#nameMask');
  updateEditableState();
}

export function updateEditableState(){
  var atStart = (state.scoreA === 0 && state.scoreB === 0 && state.setsA === 0 && state.setsB === 0 && state.currentSet === 1 && !state.locked);
  if(!state.IS_SPECTATOR && (atStart || state.nameEditMode) && !state.allowScoring){
    document.body.classList.remove('areas-active');
  }else if(!state.IS_SPECTATOR){
    document.body.classList.add('areas-active');
  }
  if(!state.IS_SPECTATOR) updateNameChips();
}

export function updateNameChips(){
  if(state.IS_SPECTATOR) return;
  updateNameChipsFromModal();
}

export function renderRecentOptions(){
  // Autocomplete dropdown handles this dynamically.
}

export function autocomplete(input, listId){
  const listEl = document.getElementById(listId);
  if(!listEl) return;
  
  attachAutocomplete(input, {
    listEl,
    onSelect: () => {
      updateNameChips();
      updateDropdownButtons('#nameMask');
    }
  });
}

export function toggleDropdown(fieldId){
  const input = document.getElementById(fieldId);
  const list = document.getElementById(fieldId + '-list');
  const btn = input?.parentElement?.querySelector('.dropdown-btn');
  
  if(!input || !list || (btn && btn.classList.contains('hidden'))) return;
  
  toggleDropdownFor(input, list, () => getRecentNames(8));
}

export function onSaveNames(saveLiveState, pushStateThrottled){
  var names = readABFromModalInputs();
  
  // Extract display names for saving to localStorage
  const aDisplay = typeof names.A === 'string' ? names.A : names.A?.display || 'Spiller A';
  const bDisplay = typeof names.B === 'string' ? names.B : names.B?.display || 'Spiller B';
  
  saveLastNames(aDisplay, bDisplay);
  
  // lagre alle relevante navn via helper
  saveFromAB(names, state.matchDiscipline);
  
  hideNameModal();
  updateNameChips();
  updateDropdownButtons('#nameMask'); // oppdater lokalt innenfor modal
  state.allowScoring = true;
  if(typeof saveLiveState === 'function') saveLiveState();
  if(typeof pushStateThrottled === 'function') pushStateThrottled();
}

window.toggleDropdown = toggleDropdown;
window.updateModalLayout = updateModalLayout;
