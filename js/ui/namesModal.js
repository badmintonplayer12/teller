import { state } from '../state/matchState.js';
import { $, setBodyScroll } from './dom.js';
import { getPrevNames, getRecentNames } from '../services/storage.js';
import { isALeft, readABFromModalInputs, writeModalInputsFromAB, updateNameChipsFromModal } from './layout.js';

export function showNameModal(startMode){
  state.nameEditMode=true;
  state.allowScoring=false;
  renderRecentOptions();
  $('#nameMask').style.display='flex';
  setBodyScroll(false);
  
  // Sett inn "sanne" A/B i modalen som venstre/høyre i henhold til layout
  var Aname = $('#nameA')?.value || 'Spiller A';
  var Bname = $('#nameB')?.value || 'Spiller B';
  // OBS: disse feltene har tidligere vært brukt «som kildedata».
  // Etter denne patchen blir de kun en buffer for A/B.
  writeModalInputsFromAB(Aname, Bname);
  updateNameChips();
  
  if(startMode){
    // Start kamp modus: vis Start og Avbryt
    $('#btnStart').style.display='inline-block';
    $('#btnSaveNames').style.display='none';
  } else {
    // Rediger navn modus: vis Lagre og Avbryt
    $('#btnStart').style.display='none';
    $('#btnSaveNames').style.display='inline-block';
  }
}

export function hideNameModal(){
  state.nameEditMode=false;
  $('#nameMask').style.display='none';
  setBodyScroll(true);
  updateEditableState();
}

export function updateEditableState(){
  var atStart=(state.scoreA===0&&state.scoreB===0&&state.setsA===0&&state.setsB===0&&state.currentSet===1&&!state.locked);
  if(!state.IS_SPECTATOR && (atStart||state.nameEditMode) && !state.allowScoring){
    document.body.classList.remove('areas-active')
  }else if(!state.IS_SPECTATOR){
    document.body.classList.add('areas-active')
  }
  // Viktig: ikke rør navnechips i spectator
  if (!state.IS_SPECTATOR) updateNameChips();
}

export function updateNameChips(){
  // I spectator skal navn KUN komme fra RTDB-snapshot (setNameChipsDirect)
  if (state.IS_SPECTATOR) return;
  updateNameChipsFromModal();
}

export function renderRecentOptions(){
  // Autocomplete funksjonalitet er nå integrert i input-feltene
  // Denne funksjonen er ikke lenger nødvendig, men beholdes for kompatibilitet
}

export { autocomplete };

export function autocomplete(input, listId) {
  var currentFocus = -1;
  
  input.addEventListener("input", function(e) {
    var val = this.value;
    var list = document.getElementById(listId);
    list.innerHTML = "";
    
    if (!val) {
      list.style.display = "none";
      return;
    }
    
    // Autocomplete bruker alle 100 navn
    var prevNames = getPrevNames();
    var matches = prevNames.filter(function(name) {
      return name.toLowerCase().indexOf(val.toLowerCase()) > -1;
    });
    
    if (matches.length === 0) {
      list.style.display = "none";
      return;
    }
    
    list.style.display = "block";
    matches.forEach(function(match) {
      var div = document.createElement("div");
      var strong = document.createElement("strong");
      strong.textContent = match.substr(0, val.length);
      var remainder = document.createTextNode(match.substr(val.length));
      div.appendChild(strong);
      div.appendChild(remainder);

      var hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.value = match;
      div.appendChild(hiddenInput);
      div.addEventListener("click", function(e) {
        input.value = this.getElementsByTagName("input")[0].value;
        list.style.display = "none";
        updateNameChips();
      });
      list.appendChild(div);
    });
  });
  
  input.addEventListener("keydown", function(e) {
    var list = document.getElementById(listId);
    var items = list.getElementsByTagName("div");
    
    if (e.keyCode === 40) { // Down arrow
      currentFocus++;
      addActive(items);
    } else if (e.keyCode === 38) { // Up arrow
      currentFocus--;
      addActive(items);
    } else if (e.keyCode === 13) { // Enter
      e.preventDefault();
      if (currentFocus > -1) {
        if (items[currentFocus]) {
          items[currentFocus].click();
        }
      }
    }
  });
  
  function addActive(items) {
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    if (items[currentFocus]) items[currentFocus].classList.add("autocomplete-active");
  }
  
  function removeActive(items) {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("autocomplete-active");
    }
  }
  
  // Close autocomplete when clicking outside
  document.addEventListener("click", function(e) {
    if (e.target !== input && e.target.className !== 'dropdown-btn') {
      document.getElementById(listId).style.display = "none";
    }
  });
}

export function toggleDropdown(fieldId) {
  var list = document.getElementById(fieldId + '-list');
  var input = document.getElementById(fieldId);
  
  if (list.style.display === "block") {
    list.style.display = "none";
    return;
  }
  
  // Vis de 6 siste navnene
  var recentNames = getRecentNames(6);
  list.innerHTML = "";
  
  if (recentNames.length === 0) {
    list.style.display = "none";
    return;
  }
  
  list.style.display = "block";
  recentNames.forEach(function(name) {
    var div = document.createElement("div");
    div.textContent = name;
    div.addEventListener("click", function(e) {
      input.value = name;
      list.style.display = "none";
      updateNameChips();
    });
    list.appendChild(div);
  });
}

export function onSaveNames(saveLiveState, pushStateThrottled){
  var n = readABFromModalInputs(); // {A,B} riktig uansett side
  var a = n.A, b = n.B;
  saveLastNames(a, b);
  hideNameModal();
  updateNameChips();
  state.allowScoring = true;
  saveLiveState();
  pushStateThrottled();
}

// Make toggleDropdown available globally for HTML onclick
window.toggleDropdown = toggleDropdown;

// Placeholder for dependencies
let saveLastNames;

export function setNamesModalDependencies(deps) {
  saveLastNames = deps.saveLastNames;
}
