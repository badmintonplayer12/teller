import { state, clearLiveState } from '../state/matchState.js';
import { $ } from '../dom.js';
import { hasActiveMatchState, getContinueLabel } from './session.js';
import { openModal, closeModal } from './modal.js';

let splashMask;
let splashStartBtn;
let splashContinueBtn;
let disciplineButtons = [];
let modeButtons = [];
let startCallback = function(){};
let saveState = function(){};
// Confirm modal elements
let confirmMask, confirmOk, confirmCancel, confirmClose, confirmText;

// Bruk felles helper fra session.js

function hasActiveTournamentState(){
  return !!(state && state.tournamentData && !state.tournamentData.archived);
}

function hasActiveTournament(){
  // Sjekk faktisk aktiv turnering (ikke bare toggle)
  return !!(state && state.tournamentData && 
    state.tournamentData.name && 
    state.tournamentData.matches && 
    state.tournamentData.matches.length > 0 &&
    !state.tournamentData.archived);
}

function shouldShowContinue(){
  return hasActiveMatchState(state) || hasActiveTournamentState();
}

function ensureElements(){
  if(!splashMask) splashMask = document.getElementById('splashMask');
  if(!splashStartBtn) splashStartBtn = document.getElementById('splashStartBtn');
  if(!splashContinueBtn) splashContinueBtn = document.getElementById('splashContinueBtn');
  if(!disciplineButtons.length && splashMask) disciplineButtons = Array.from(splashMask.querySelectorAll('[data-discipline]'));
  if(!modeButtons.length && splashMask) modeButtons = Array.from(splashMask.querySelectorAll('[data-mode]'));
  // confirm modal bits
  if(!confirmMask) confirmMask = document.getElementById('confirmStartMask');
  if(!confirmOk) confirmOk = document.getElementById('confirmStartOk');
  if(!confirmCancel) confirmCancel = document.getElementById('confirmStartCancel');
  if(!confirmClose) confirmClose = document.getElementById('confirmStartClose');
  if(!confirmText) confirmText = document.getElementById('confirmStartText');
  return !!splashMask;
}

function openConfirmStart(onConfirm){
  if(!confirmMask) return onConfirm && onConfirm(false);
  // Sett rett tekst basert på faktisk aktiv state (ikke toggle)
  const isActiveTournament = hasActiveTournament();
  const message = isActiveTournament
    ? 'Dette vil avslutte og slette pågående turnering (alle kamper og resultater). Fortsette?'
    : 'Dette vil avslutte og slette pågående enkeltkamp. Fortsette?';
  if(confirmText) confirmText.textContent = message;

  // Fjern gamle lyttere (om noen) og bind på nytt
  if(confirmOk){ 
    confirmOk.onclick = () => { 
      closeModal('#confirmStartMask'); 
      
      // Clear all state before starting new match/tournament
      try { clearLiveState(); } catch(_) {}
      state.tournamentData = null;
      if (state.ui) state.ui.nextNavHint = null;
      setSplashContinueState({ visible: false });
      
      onConfirm && onConfirm(true); 
    }; 
  }
  if(confirmCancel){ confirmCancel.onclick = () => { closeModal('#confirmStartMask'); onConfirm && onConfirm(false); }; }
  if(confirmClose){ confirmClose.onclick = () => { closeModal('#confirmStartMask'); onConfirm && onConfirm(false); }; }

  openModal('#confirmStartMask', { closeOnBackdrop: true, closeOnEsc: true, focus: '#confirmStartCancel' });
}

function updateSplashButtons(){
  var showContinue = shouldShowContinue();
  if (splashContinueBtn){
    splashContinueBtn.style.display = showContinue ? '' : 'none';
    splashContinueBtn.disabled = !showContinue;
  }
}

export function setupSplash(options){
  options = options || {};
  startCallback = typeof options.onStart === 'function' ? options.onStart : startCallback;
  saveState = typeof options.saveState === 'function' ? options.saveState : saveState;
  if(!ensureElements()) return;
  if(splashMask.dataset.bound) return;
  splashMask.dataset.bound = '1';

  updateSplashButtons();
  if (state.ui && state.ui.requestSplashButtonsRefresh) {
    updateSplashButtons();
    state.ui.requestSplashButtonsRefresh = false;
  }

  syncSplashButtons();

  disciplineButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      var value = btn.getAttribute('data-discipline');
      if(!value || state.matchDiscipline === value) return;
      state.matchDiscipline = value;
      syncSplashButtons();
      saveState();
      
      // Update modal layout when discipline changes
      if(typeof window.updateModalLayout === 'function'){
        window.updateModalLayout();
      }
    });
  });

  modeButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      var value = btn.getAttribute('data-mode');
      if(!value || state.playMode === value) return;
      state.playMode = value;
      syncSplashButtons();
      saveState();
    });
  });

  if(splashStartBtn){
    splashStartBtn.addEventListener('click', function(){
      if(splashStartBtn.disabled) return;
      splashStartBtn.disabled = true;
      // Bekreft hvis dette potensielt sletter pågående data – pen modal
      if (hasActiveMatchState(state)) {
        openConfirmStart(function(ok){
          if(!ok){ splashStartBtn.disabled = false; return; }
          hideSplash();
          startCallback({ fromSplash: true });
          setTimeout(function(){ splashStartBtn.disabled = false; }, 400);
        });
      } else {
        hideSplash();
        startCallback({ fromSplash: true });
        setTimeout(function(){ splashStartBtn.disabled = false; }, 400);
      }
    });
  }
  if(splashContinueBtn){
    splashContinueBtn.addEventListener('click', function(){
      if(splashContinueBtn.disabled) return;
      splashContinueBtn.disabled = true;
      hideSplash();
      
      // Set navigation hint for tournament mode
      if(state.playMode === 'tournament'){
        state.ui.nextNavHint = 'continueTournament';
      }
      
      startCallback({ fromSplash: true, continueMatch: true, skipSplash: true, restored: true });
      setTimeout(function(){ splashContinueBtn.disabled = false; }, 400);
    });
  }
}

export function syncSplashButtons(){
  if(!ensureElements()) return;
  disciplineButtons.forEach(function(btn){
    var active = btn.getAttribute('data-discipline') === state.matchDiscipline;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  modeButtons.forEach(function(btn){
    var active = btn.getAttribute('data-mode') === state.playMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

export function showSplash(){
  if(!ensureElements()) return;
  splashMask.classList.add('show');
  splashMask.setAttribute('aria-hidden', 'false');
  document.body.classList.add('splash-open');
  document.body.classList.remove('areas-active');
}

export function hideSplash(){
  if(!ensureElements()) return;
  splashMask.classList.remove('show');
  splashMask.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('splash-open');
}

export function setSplashContinueState(options){
  if(!ensureElements()) return;
  const visible = !!(options && options.visible);
  if(splashContinueBtn){
    splashContinueBtn.style.display = visible ? 'block' : 'none';
    splashContinueBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    splashContinueBtn.tabIndex = visible ? 0 : -1;
    if(options && options.label){
      splashContinueBtn.textContent = options.label;
    }
  }
}
