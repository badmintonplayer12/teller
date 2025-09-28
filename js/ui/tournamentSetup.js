import { state } from '../state/matchState.js';
import { setBodyScroll } from '../dom.js';
import { showSplash } from './splash.js';

let mask;
let modal;
let nameInput;
let list;
let addBtn;
let closeBtn;
let backBtn;
let continueBtn;

const draft = {
  name: '',
  participants: []
};

function ensureElements(){
  if(!mask) mask = document.getElementById('tournamentMask');
  if(!mask) return false;
  if(!modal) modal = mask.querySelector('.tournamentModal');
  if(!nameInput) nameInput = document.getElementById('tournamentName');
  if(!list) list = document.getElementById('tournamentParticipants');
  if(!addBtn) addBtn = document.getElementById('tournamentAddParticipant');
  if(!closeBtn) closeBtn = document.getElementById('tournamentClose');
  if(!backBtn) backBtn = document.getElementById('tournamentBack');
  if(!continueBtn) continueBtn = document.getElementById('tournamentContinue');
  return true;
}

function bindEvents(){
  if(!ensureElements()) return;
  if(mask.dataset.bound) return;
  mask.dataset.bound = '1';

  if(addBtn){
    addBtn.addEventListener('click', function(){
      addParticipantRow('');
    });
  }

  if(closeBtn){
    closeBtn.addEventListener('click', function(){
      hideTournamentSetup();
      showSplash();
    });
  }

  if(backBtn){
    backBtn.addEventListener('click', function(){
      hideTournamentSetup();
      showSplash();
    });
  }

  if(nameInput){
    nameInput.addEventListener('input', function(){
      draft.name = nameInput.value;
      updateContinueButton();
    });
  }
}

function addParticipantRow(value){
  if(!ensureElements()) return;
  const li = document.createElement('li');
  li.className = 'participantRow';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'participantInput';
  input.placeholder = 'Deltaker ' + (list.children.length + 1);
  if(value) input.value = value;

  input.addEventListener('input', function(){
    persistParticipants();
    updateContinueButton();
  });

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

  li.appendChild(input);
  li.appendChild(removeBtn);
  list.appendChild(li);
  input.focus();
  persistParticipants();
  updateContinueButton();
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
  state.allowScoring = false;
  document.body.classList.remove('areas-active');

  mask.style.display = 'flex';
  mask.setAttribute('aria-hidden', 'false');
  setBodyScroll(false);

  if(!list.children.length){
    addParticipantRow('');
    addParticipantRow('');
  }

  if(draft.name){
    nameInput.value = draft.name;
  }else if(nameInput){
    nameInput.value = '';
    nameInput.placeholder = 'Turneringsnavn';
  }

  renumberPlaceholders();
  updateContinueButton();
  if(nameInput) nameInput.focus();
}

export function hideTournamentSetup(){
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
  setBodyScroll(true);
}

export function setupTournamentSetup(){
  bindEvents();
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
}

