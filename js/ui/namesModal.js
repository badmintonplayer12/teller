import { state } from '../state/matchState.js';
import { setBodyScroll, $ } from '../dom.js';
import { saveLastNames, getRecentNames, getPrevNames, pushPrev } from '../services/storage.js';
import { readABFromModalInputs, writeModalInputsFromAB, updateNameChipsFromModal } from './layout.js';

export function updateDropdownButtons(){
  const availableNames = getPrevNames().filter(name => !name.includes(' / '));
  const hasNames = availableNames.length > 0;
  
  // Get all dropdown buttons
  const dropdownButtons = document.querySelectorAll('.dropdown-btn');
  
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
  updateDropdownButtons();
  
  var mask = $('#nameMask');
  if(mask) mask.style.display = 'flex';
  setBodyScroll(false);

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
  var mask = $('#nameMask');
  if(mask) mask.style.display = 'none';
  setBodyScroll(true);
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
  var currentFocus = -1;

  input.addEventListener('input', function(){
    var val = this.value;
    var list = document.getElementById(listId);
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
        input.value = this.querySelector('input').value;
        list.style.display = 'none';
        updateNameChips();
      });
      list.appendChild(div);
    });
  });

  input.addEventListener('keydown', function(e){
    var list = document.getElementById(listId);
    if(!list) return;
    var items = list.getElementsByTagName('div');
    if(!items.length) return;

    if(e.key === 'ArrowDown'){
      currentFocus++;
      addActive(items);
    }else if(e.key === 'ArrowUp'){
      currentFocus--;
      addActive(items);
    }else if(e.key === 'Enter'){
      e.preventDefault();
      if(currentFocus > -1 && items[currentFocus]){
        items[currentFocus].click();
      }
    }
  });

  function addActive(items){
    removeActive(items);
    if(currentFocus >= items.length) currentFocus = 0;
    if(currentFocus < 0) currentFocus = items.length - 1;
    if(items[currentFocus]) items[currentFocus].classList.add('autocomplete-active');
  }

  function removeActive(items){
    for(var i=0;i<items.length;i++) items[i].classList.remove('autocomplete-active');
  }

  document.addEventListener('click', function(e){
    if(e.target !== input && e.target.className !== 'dropdown-btn'){
      var list = document.getElementById(listId);
      if(list) list.style.display = 'none';
    }
  });
}

export function toggleDropdown(fieldId){
  var list = document.getElementById(fieldId + '-list');
  var input = document.getElementById(fieldId);
  var dropdownBtn = input?.parentElement?.querySelector('.dropdown-btn');
  
  if(!list || !input) return;
  
  // Don't show dropdown if button is hidden (no saved names)
  if(dropdownBtn && dropdownBtn.classList.contains('hidden')) return;

  if(list.style.display === 'block'){
    list.style.display = 'none';
    return;
  }

  // Filter out team names and only show individual player names
  var recent = getRecentNames(6).filter(function(name){
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
      updateNameChips();
    });
    list.appendChild(div);
  });
}

export function onSaveNames(saveLiveState, pushStateThrottled){
  var names = readABFromModalInputs();
  
  // Extract display names for saving to localStorage
  const aDisplay = typeof names.A === 'string' ? names.A : names.A?.display || 'Spiller A';
  const bDisplay = typeof names.B === 'string' ? names.B : names.B?.display || 'Spiller B';
  
  saveLastNames(aDisplay, bDisplay);
  
  // Also save individual player names for autocomplete (if double format)
  if(state.matchDiscipline === 'double' && typeof names.A === 'object' && names.A.players) {
    names.A.players.forEach(player => {
      if(player && player.trim()) pushPrev(player.trim());
    });
  }
  if(state.matchDiscipline === 'double' && typeof names.B === 'object' && names.B.players) {
    names.B.players.forEach(player => {
      if(player && player.trim()) pushPrev(player.trim());
    });
  }
  
  hideNameModal();
  updateNameChips();
  updateDropdownButtons(); // Update dropdown buttons after saving names
  state.allowScoring = true;
  if(typeof saveLiveState === 'function') saveLiveState();
  if(typeof pushStateThrottled === 'function') pushStateThrottled();
}

window.toggleDropdown = toggleDropdown;
window.updateModalLayout = updateModalLayout;
