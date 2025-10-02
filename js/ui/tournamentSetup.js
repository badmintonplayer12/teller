import { state, clearLiveState } from '../state/matchState.js';
// (fjernet ubrukte imports)
import { openModal, closeModal } from './modal.js';
import { hasActiveMatchState, getContinueLabel } from './session.js';
import { showSplash, setSplashContinueState, syncSplashButtons } from './splash.js';
import { goToStart } from '../main.js';
import { getRecentNames, getPrevNames } from '../services/storage.js';
import { saveIndividual } from '../services/namesStore.js';
import { generateSwissRoundOne } from '../services/tournament.js';
import { attachAutocomplete, toggleDropdownFor, updateDropdownButtons } from './autocomplete.js';
import { qs, on } from '../util/domUtils.js';

// Konfig: når turneringen låses
const TOURNAMENT_LOCK_MODE = 'onCreation'; // 'onCreation' | 'onFirstMatch'


let mask;
let modal;
let nameInput;
let list;
let addBtn;
let closeBtn;
let backBtn;
let continueBtn;

const draft = {
  name: 'Demo-turnering',
  participants: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
};

function ensureElements(){
  if(!mask) mask = document.getElementById('tournamentMask');
  if(!mask) return false;
  if(!modal) modal = mask.querySelector('.tournamentSetupPanel');
  if(!nameInput) nameInput = qs('#tournamentName');
  if(!list) list = qs('#tournamentParticipants');
  if(!addBtn) addBtn = qs('#tournamentAddParticipant');
  if(!closeBtn) closeBtn = qs('#tournamentClose');
  if(!backBtn) backBtn = qs('#tournamentBack');
  if(!continueBtn) continueBtn = qs('#tournamentContinue');
  return true;
}

function bindEvents(){
  if(!ensureElements()) return;
  if(mask.dataset.bound) return;
  mask.dataset.bound = '1';

  if(addBtn){
    on(addBtn, 'click', function(){
      addParticipantRow('');
    });
  }

  if(closeBtn){
    on(closeBtn, 'click', function(){
      hideTournamentSetup();
      goToStart({ from: 'setup' });
    });
  }

  if(backBtn){
    on(backBtn, 'click', function(){
      hideTournamentSetup();
      goToStart({ from: 'setup' });
    });
  }

  if(nameInput){
    on(nameInput, 'input', function(){
      draft.name = nameInput.value;
      updateContinueButton();
    });
  }

  if(continueBtn){
    continueBtn.addEventListener('click', function(){
      // Save participant names to the same storage as single match names
      saveTournamentParticipants();
      hideTournamentSetup();
      // Start the match with tournament mode
      startTournamentMatch();
    });
  }
}

function addParticipantRow(value){
  if(!ensureElements()) return;
  const li = document.createElement('li');
  li.className = 'participantRow';

  // Create autocomplete wrapper
  const autocompleteWrapper = document.createElement('div');
  autocompleteWrapper.className = 'autocomplete';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'participantInput';
  input.placeholder = 'Deltaker ' + (list.children.length + 1);
  if(value) input.value = value;

  // Set unique ID for input BEFORE creating autocomplete list
  input.id = 'participant' + Date.now() + Math.random().toString(36).substr(2, 9);

  // Create dropdown button
  const dropdownBtn = document.createElement('button');
  dropdownBtn.type = 'button';
  dropdownBtn.className = 'dropdown-btn';
  dropdownBtn.innerHTML = '&#x25BC;';
  dropdownBtn.onclick = function() { window.toggleTournamentDropdown(input.id); };

  // Create autocomplete list
  const autocompleteList = document.createElement('div');
  autocompleteList.id = input.id + '-list';
  autocompleteList.className = 'autocomplete-items';

  input.addEventListener('input', function(){
    persistParticipants();
    updateContinueButton();
  });
  
  // Save name to storage when user types (for autocomplete)
  input.addEventListener('blur', function(){
    const name = this.value.trim();
    if(name && name.length > 0){
      saveIndividual(name);
      updateDropdownButtons('#tournamentMask');
    }
  });

  // Add autocomplete functionality using shared helper
  attachAutocomplete(input, {
    listEl: autocompleteList,
    onSelect: () => {
      persistParticipants();
      updateContinueButton();
      updateDropdownButtons('#tournamentMask');
    }
  });

  // Assemble autocomplete wrapper
  autocompleteWrapper.appendChild(input);
  autocompleteWrapper.appendChild(dropdownBtn);
  autocompleteWrapper.appendChild(autocompleteList);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'participantRemove';
  removeBtn.textContent = 'Fjern';
  removeBtn.addEventListener('click', function(){
    list.removeChild(li);
    persistParticipants();
    renumberPlaceholders();
    updateContinueButton();
  });

  li.appendChild(autocompleteWrapper);
  li.appendChild(removeBtn);
  list.appendChild(li);
  input.focus();
  persistParticipants();
  updateContinueButton();
  updateDropdownButtons('#tournamentMask'); // oppdater lokalt innenfor turneringsmodal
}

function persistParticipants(){
  if(!list) return;
  draft.participants = Array.from(list.querySelectorAll('.participantInput')).map(function(input){
    return input.value.trim();
  });
}

function renumberPlaceholders(){
  if(!list) return;
  Array.from(list.querySelectorAll('.participantInput')).forEach(function(input, idx){
    if(!input.value){
      input.placeholder = 'Deltaker ' + (idx + 1);
    }
  });
}

function updateContinueButton(){
  if(!continueBtn) return;
  const filled = draft.participants.filter(function(name){ return name.length > 0; });
  continueBtn.disabled = filled.length < 2 || !(draft.name && draft.name.trim().length);
}

export function showTournamentSetup(){
  if(!ensureElements()) return;
  
  // Guard: blokker tilgang til setup når turneringen er låst
  if(state.tournamentData && state.tournamentData.locked){
    // Redirect til oversikt hvis noen prøver å gå direkte hit via URL/historikk
    import('./tournamentOverview.js').then(function(module){
      module.showTournamentOverview();
    });
    return;
  }
  
  state.allowScoring = false;
  document.body.classList.remove('areas-active');

  openModal('#tournamentMask');

  // Clear existing participants if any
  if(list.children.length > 0){
    list.innerHTML = '';
  }

  // Add participants from draft
  if(draft.participants && draft.participants.length > 0){
    draft.participants.forEach(name => {
      addParticipantRow(name);
    });
  } else {
    // Fallback: add empty rows if no participants
    addParticipantRow('');
    addParticipantRow('');
  }

  // Set tournament name
  if(nameInput){
    nameInput.value = draft.name || '';
    if(!draft.name){
      nameInput.placeholder = 'Turneringsnavn';
    }
  }

  renumberPlaceholders();
  updateContinueButton();
  updateDropdownButtons('#tournamentMask'); // oppdater lokalt innenfor turneringsmodal
  if(nameInput) nameInput.focus();
}

export function hideTournamentSetup(){
  if(!ensureElements()) return;
  closeModal('#tournamentMask');
}

export function toggleTournamentDropdown(inputId){
  const input = document.getElementById(inputId);
  const list = document.getElementById(inputId + '-list');
  const dropdownBtn = input?.parentElement?.querySelector('.dropdown-btn');
  
  if(!input || !list) return;
  
  // Don't show dropdown if button is hidden (no saved names)
  if(dropdownBtn && dropdownBtn.classList.contains('hidden')) return;

  toggleDropdownFor(input, list, () => getRecentNames(8));
}


export function setupTournamentSetup(){
  bindEvents();
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
}

function saveTournamentParticipants(){
  if(!list) return;
  
  // ELEGANT: Clear any existing match state before creating tournament
  // This prevents single match data from leaking into tournament mode
  console.log('[TOURNAMENT SETUP] Clearing existing match state before tournament creation');
  
  // Reset match state to clean slate
  state.scoreA = 0;
  state.scoreB = 0;
  state.setsA = 0;
  state.setsB = 0;
  state.currentSet = 1;
  state.swappedAt11 = false;
  state.locked = false;
  state.betweenSets = false;
  state.pendingSetWinner = null;
  state.setHistory = [];
  state.allowScoring = false;
  state.nameEditMode = false;
  
  // Clear localStorage to prevent restoration of old single match data
  clearLiveState(true); // Force clear even in tournament mode
  
  // Get all participant names
  const participants = Array.from(list.querySelectorAll('.participantInput')).map(function(input){
    return input.value.trim();
  }).filter(function(name){ return name.length > 0; });
  
  // Save each participant name to the same storage as single match names
  participants.forEach(saveIndividual);
  
  // Generate Swiss tournament Round 1 matches with placeholder rounds
  const tournamentData = generateSwissRoundOne(participants);
  
  // Store tournament data for later use
  state.tournamentData = {
    name: draft.name,
    participants: participants,
    matches: tournamentData.round1.concat(tournamentData.placeholderRounds),
    matchStates: {},
    locked: TOURNAMENT_LOCK_MODE === 'onCreation' ? true : false
  };
  
  // Oppdater dropdown-knapper etter lagring av navn
  updateDropdownButtons('#tournamentMask');
}

function startTournamentMatch(){
  // Import and show tournament overview instead of starting match directly
  import('./tournamentOverview.js').then(function(module){
    module.renderTournamentOverview();
    module.showTournamentOverview();
  });
}

// Make toggleTournamentDropdown available globally
window.toggleTournamentDropdown = toggleTournamentDropdown;

