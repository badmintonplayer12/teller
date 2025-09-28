import { state } from '../state/matchState.js';
import { $ } from '../dom.js';

let splashMask;
let splashStartBtn;
let disciplineButtons = [];
let modeButtons = [];
let startCallback = function(){};
let saveState = function(){};

function ensureElements(){
  if(!splashMask) splashMask = document.getElementById('splashMask');
  if(!splashStartBtn) splashStartBtn = document.getElementById('splashStartBtn');
  if(!disciplineButtons.length && splashMask) disciplineButtons = Array.from(splashMask.querySelectorAll('[data-discipline]'));
  if(!modeButtons.length && splashMask) modeButtons = Array.from(splashMask.querySelectorAll('[data-mode]'));
  return !!splashMask;
}

export function setupSplash(options){
  options = options || {};
  startCallback = typeof options.onStart === 'function' ? options.onStart : startCallback;
  saveState = typeof options.saveState === 'function' ? options.saveState : saveState;
  if(!ensureElements()) return;
  if(splashMask.dataset.bound) return;
  splashMask.dataset.bound = '1';

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
      hideSplash();
      startCallback({ fromSplash: true });
      setTimeout(function(){ splashStartBtn.disabled = false; }, 400);
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
