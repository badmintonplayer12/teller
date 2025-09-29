import { state } from '../state/matchState.js';
import { setBodyScroll } from '../dom.js';
import { showSplash } from './splash.js';
import { getRecentNames, getPrevNames, pushPrev } from '../services/storage.js';
import { generateSwissRoundOne } from '../services/tournament.js';

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
      pushPrev(name);
      updateTournamentDropdownButtons();
    }
  });

  // Add autocomplete functionality - implement directly for tournament modal
  var currentFocus = -1;
  
  input.addEventListener('input', function(){
    var val = this.value;
    var list = autocompleteList;
    if(!list) return;
    list.innerHTML = '';

    if(!val){
      list.style.display = 'none';
      return;
    }

    // Filter out team names and only show individual player names
    var matches = getPrevNames().filter(function(name){
      // Skip team names (names that don't contain " / " and are not individual player names)
      if(name.includes(' / ')) return false; // This is a team name
      return name.toLowerCase().indexOf(val.toLowerCase()) > -1;
    });
    if(!matches.length){
      list.style.display = 'none';
      return;
    }

    list.style.display = 'block';
    currentFocus = -1;
    matches.forEach(function(match){
      var div = document.createElement('div');
      var strong = document.createElement('strong');
      strong.textContent = match.substr(0, val.length);
      var remainder = document.createTextNode(match.substr(val.length));
      div.appendChild(strong);
      div.appendChild(remainder);

      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.value = match;
      div.appendChild(hidden);
      div.addEventListener('click', function(){
        const selectedName = this.querySelector('input').value;
        input.value = selectedName;
        list.style.display = 'none';
        persistParticipants();
        updateContinueButton();
        // Save the selected name to storage
        pushPrev(selectedName);
        updateTournamentDropdownButtons();
      });
      list.appendChild(div);
    });
  });

  // Keyboard navigation for autocomplete
  input.addEventListener('keydown', function(e){
    var list = autocompleteList;
    if(!list) return;
    
    if(e.keyCode === 40){ // Down arrow
      e.preventDefault();
      currentFocus++;
      if(currentFocus >= list.children.length) currentFocus = 0;
      addActive(list);
    } else if(e.keyCode === 38){ // Up arrow
      e.preventDefault();
      currentFocus--;
      if(currentFocus < 0) currentFocus = list.children.length - 1;
      addActive(list);
    } else if(e.keyCode === 13){ // Enter
      e.preventDefault();
      if(currentFocus > -1){
        list.children[currentFocus].click();
      }
    } else if(e.keyCode === 27){ // Escape
      list.style.display = 'none';
    }
  });

  // Close autocomplete when clicking outside
  document.addEventListener('click', function(e){
    if(!autocompleteWrapper.contains(e.target)){
      autocompleteList.style.display = 'none';
    }
  });

  function addActive(list){
    removeActive(list);
    if(currentFocus >= 0 && currentFocus < list.children.length){
      list.children[currentFocus].classList.add('autocomplete-active');
    }
  }

  function removeActive(list){
    for(var i = 0; i < list.children.length; i++){
      list.children[i].classList.remove('autocomplete-active');
    }
  }

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
  updateTournamentDropdownButtons(); // Update dropdown buttons after adding participant
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
  updateTournamentDropdownButtons(); // Update dropdown buttons when showing tournament setup
  if(nameInput) nameInput.focus();
}

export function hideTournamentSetup(){
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
  setBodyScroll(true);
}

export function toggleTournamentDropdown(inputId){
  var list = document.getElementById(inputId + '-list');
  var input = document.getElementById(inputId);
  var dropdownBtn = input?.parentElement?.querySelector('.dropdown-btn');
  
  if(!list || !input) return;
  
  // Don't show dropdown if button is hidden (no saved names)
  if(dropdownBtn && dropdownBtn.classList.contains('hidden')) return;

  if(list.style.display === 'block'){
    list.style.display = 'none';
    return;
  }

  // Use the same logic as name modal - show 8 recent names, filtered to exclude team names
  var recent = getRecentNames(8).filter(function(name){
    return !name.includes(' / '); // Skip team names
  });
  list.innerHTML = '';
  if(!recent.length){
    list.style.display = 'none';
    return;
  }

  list.style.display = 'block';
  recent.forEach(function(name){
    var div = document.createElement('div');
    div.textContent = name;
    div.addEventListener('click', function(){
      input.value = name;
      list.style.display = 'none';
      persistParticipants();
      updateContinueButton();
      // Save the selected name to storage
      pushPrev(name);
      updateTournamentDropdownButtons();
    });
    list.appendChild(div);
  });
}

export function updateTournamentDropdownButtons(){
  const availableNames = getPrevNames().filter(name => !name.includes(' / '));
  const hasNames = availableNames.length > 0;
  
  // Get all dropdown buttons in tournament setup
  const dropdownButtons = document.querySelectorAll('#tournamentMask .dropdown-btn');
  
  dropdownButtons.forEach(btn => {
    if(hasNames){
      btn.classList.remove('hidden');
      btn.parentElement.querySelector('input').classList.remove('no-dropdown');
    } else {
      btn.classList.add('hidden');
      btn.parentElement.querySelector('input').classList.add('no-dropdown');
    }
  });
}

export function setupTournamentSetup(){
  bindEvents();
  if(!ensureElements()) return;
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
}

function saveTournamentParticipants(){
  if(!list) return;
  
  // Get all participant names
  const participants = Array.from(list.querySelectorAll('.participantInput')).map(function(input){
    return input.value.trim();
  }).filter(function(name){ return name.length > 0; });
  
  // Save each participant name to the same storage as single match names
  participants.forEach(function(name){
    pushPrev(name);
  });
  
  // Generate Swiss tournament Round 1 matches with placeholder rounds
  const tournamentData = generateSwissRoundOne(participants);
  
  // Store tournament data for later use
  state.tournamentData = {
    name: draft.name,
    participants: participants,
    matches: tournamentData.round1.concat(tournamentData.placeholderRounds),
    matchStates: {}
  };
  
  // Update dropdown buttons after saving names
  updateTournamentDropdownButtons();
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

