import { state, getDisplayName } from '../state/matchState.js';
import { $ } from '../dom.js';

let saveLiveStateBound = function(){};
let pushStateThrottled = function(){};
let pushStateNow = function(){};
let updateNameChips = function(){};

export function setLayoutDependencies(deps){
  saveLiveStateBound = deps.saveLiveState || saveLiveStateBound;
  pushStateThrottled = deps.pushStateThrottled || pushStateThrottled;
  pushStateNow = deps.pushStateNow || pushStateNow;
  updateNameChips = deps.updateNameChips || updateNameChips;
}

export function isALeft(){
  var left = document.querySelector('.side.left');
  return left && left.id === 'sideA';
}

export function readABFromModalInputs(){
  const discipline = state.matchDiscipline;
  
  if(discipline === 'double'){
    // Read double format
    const left1 = $('#nameA1')?.value || 'Spiller A';
    const left2 = $('#nameA2')?.value || 'Spiller A2';
    const right1 = $('#nameB1')?.value || 'Spiller B';
    const right2 = $('#nameB2')?.value || 'Spiller B2';
    
    // Read team names
    const teamNameA = $('#teamNameA')?.value?.trim() || '';
    const teamNameB = $('#teamNameB')?.value?.trim() || '';
    
    // Use team name if provided, otherwise use player names
    const leftDisplay = teamNameA ? teamNameA : (left1 + ' / ' + left2);
    const rightDisplay = teamNameB ? teamNameB : (right1 + ' / ' + right2);
    
    const leftVal = { players: [left1, left2], display: leftDisplay, teamName: teamNameA };
    const rightVal = { players: [right1, right2], display: rightDisplay, teamName: teamNameB };
    
    return isALeft()
      ? { A: leftVal,  B: rightVal }
      : { A: rightVal, B: leftVal };
  } else {
    // Read single format
    var leftVal = ($('#nameA')?.value || 'Spiller A');
    var rightVal = ($('#nameB')?.value || 'Spiller B');
    return isALeft()
      ? { A: leftVal,  B: rightVal }
      : { A: rightVal, B: leftVal };
  }
}

export function writeModalInputsFromAB(Aname, Bname){
  const discipline = state.matchDiscipline;
  
  if(discipline === 'double'){
    // Handle double format
    const aPlayers = Array.isArray(Aname?.players) ? Aname.players : [Aname || 'Spiller A', 'Spiller A2'];
    const bPlayers = Array.isArray(Bname?.players) ? Bname.players : [Bname || 'Spiller B', 'Spiller B2'];
    
    // Handle team names
    const aTeamName = Aname?.teamName || '';
    const bTeamName = Bname?.teamName || '';
    
    if(isALeft()){
      $('#nameA1').value = aPlayers[0] || 'Spiller A';
      $('#nameA2').value = aPlayers[1] || 'Spiller A2';
      $('#nameB1').value = bPlayers[0] || 'Spiller B';
      $('#nameB2').value = bPlayers[1] || 'Spiller B2';
      $('#teamNameA').value = aTeamName;
      $('#teamNameB').value = bTeamName;
    }else{
      $('#nameA1').value = bPlayers[0] || 'Spiller B';
      $('#nameA2').value = bPlayers[1] || 'Spiller B2';
      $('#nameB1').value = aPlayers[0] || 'Spiller A';
      $('#nameB2').value = aPlayers[1] || 'Spiller A2';
      $('#teamNameA').value = bTeamName;
      $('#teamNameB').value = aTeamName;
    }
  } else {
    // Handle single format
    const aStr = typeof Aname === 'string' ? Aname : (Aname?.display || Aname?.players?.[0] || 'Spiller A');
    const bStr = typeof Bname === 'string' ? Bname : (Bname?.display || Bname?.players?.[0] || 'Spiller B');
    
    if(isALeft()){
      $('#nameA').value = aStr;
      $('#nameB').value = bStr;
    }else{
      $('#nameA').value = bStr;
      $('#nameB').value = aStr;
    }
  }
}

export function updateNameChipsFromModal(){
  var names = readABFromModalInputs();
  var ca = $('#nameA_chip');
  var cb = $('#nameB_chip');
  
  // Handle both string and object formats
  const aDisplay = getDisplayName(names.A, 'A');
  const bDisplay = getDisplayName(names.B, 'B');
  
  if(ca) ca.textContent = aDisplay;
  if(cb) cb.textContent = bDisplay;
}

export function setSidesDomTo(isALeftTarget){
  var wrap = $('#wrap');
  var A = $('#sideA');
  var B = $('#sideB');
  var divider = document.querySelector('.divider');
  if(!(wrap && A && B && divider)) return;

  var namesBefore = readABFromModalInputs();

  var aIsLeft = A.classList.contains('left');
  if(aIsLeft === isALeftTarget) return;

  wrap.classList.add('no-trans');
  try{
    if(isALeftTarget){
      A.classList.add('left');
      A.classList.remove('right');
      B.classList.add('right');
      B.classList.remove('left');
      wrap.insertBefore(A, wrap.firstElementChild);
      wrap.insertBefore(divider, B);
    }else{
      B.classList.add('left');
      B.classList.remove('right');
      A.classList.add('right');
      A.classList.remove('left');
      wrap.insertBefore(B, wrap.firstElementChild);
      wrap.insertBefore(divider, A);
    }
  }catch(_){ }
  wrap.classList.remove('no-trans');

  if(!state.IS_SPECTATOR){
    writeModalInputsFromAB(namesBefore.A, namesBefore.B);
    updateNameChips();
  }
}

export function startVisualSwap(done){
  if(state.swapping) return;
  state.swapping = true;

  var namesBefore = readABFromModalInputs();
  var wrap = $('#wrap');
  var left = document.querySelector('.side.left');
  var right = document.querySelector('.side.right');
  var divider = document.querySelector('.divider');
  if(!(wrap && left && right && divider)){
    state.swapping = false;
    return;
  }

  wrap.classList.add('swap-go');
  var finished = false;

  function complete(){
    if(finished) return;
    finished = true;
    left.removeEventListener('transitionend', onEnd);
    right.removeEventListener('transitionend', onEnd);

    try{
      wrap.classList.add('no-trans');
      wrap.insertBefore(right, left);
      if(divider.parentNode !== wrap) wrap.appendChild(divider);
      wrap.insertBefore(divider, left);
      left.classList.remove('left');
      left.classList.add('right');
      right.classList.remove('right');
      right.classList.add('left');
    }catch(_){ }

    wrap.classList.remove('swap-go');
    void wrap.offsetWidth;
    wrap.classList.remove('no-trans');

    if(!state.IS_SPECTATOR){
      writeModalInputsFromAB(namesBefore.A, namesBefore.B);
      updateNameChips();
    }

    fitScores();
    state.swapping = false;
    saveLiveStateBound();
    if(typeof pushStateNow === 'function') pushStateNow();

    if(typeof done === 'function'){
      try{ done(); }catch(_){ }
    }
  }

  function onEnd(e){
    if(e.target !== left && e.target !== right) return;
    complete();
  }

  left.addEventListener('transitionend', onEnd);
  right.addEventListener('transitionend', onEnd);
  setTimeout(complete, 1200);
}

export function swapSides(){
  startVisualSwap();
}

export function setDigits(score, prefix){
  var tens = Math.floor(score / 10);
  var ones = score % 10;
  var tensEl = document.getElementById(prefix + '_tens');
  var onesEl = document.getElementById(prefix + '_ones');
  if(score < 10){
    if(tensEl){
      tensEl.textContent = '0';
      tensEl.classList.add('ghost');
    }
  }else{
    if(tensEl){
      tensEl.textContent = String(tens);
      tensEl.classList.remove('ghost');
    }
  }
  if(onesEl) onesEl.textContent = String(ones);
}

export function fitScores(){
  if(state.IS_SPECTATOR && (
      document.getElementById('A_digits')?.classList.contains('pop') ||
      document.getElementById('A_digits')?.classList.contains('popMinus') ||
      document.getElementById('B_digits')?.classList.contains('pop') ||
      document.getElementById('B_digits')?.classList.contains('popMinus')
    )) return;

  document.body.classList.add('measuring');
  var base = 100;
  var scoreAEl = $('#scoreA');
  var scoreBEl = $('#scoreB');
  if(!(scoreAEl && scoreBEl)){
    document.body.classList.remove('measuring');
    return;
  }

  scoreAEl.style.fontSize = base + 'px';
  scoreBEl.style.fontSize = base + 'px';

  var nameAH = ($('#sideA .name')||{}).offsetHeight || 0;
  var nameBH = ($('#sideB .name')||{}).offsetHeight || 0;

  function padY(el){
    var cs = getComputedStyle(el);
    return (parseFloat(cs.paddingTop)||0) + (parseFloat(cs.paddingBottom)||0);
  }

  function padX(el){
    var cs = getComputedStyle(el);
    return (parseFloat(cs.paddingLeft)||0) + (parseFloat(cs.paddingRight)||0);
  }

  var availHA = Math.max(40, ($('#sideA')?.clientHeight || 0) - nameAH - padY($('#sideA')));
  var availHB = Math.max(40, ($('#sideB')?.clientHeight || 0) - nameBH - padY($('#sideB')));
  var availWA = Math.max(40, ($('#sideA .scoreBox')?.clientWidth || 0) - padX(scoreAEl));
  var availWB = Math.max(40, ($('#sideB .scoreBox')?.clientWidth || 0) - padX(scoreBEl));

  var aRect = $('#A_digits').getBoundingClientRect();
  var bRect = $('#B_digits').getBoundingClientRect();

  var scaleA = Math.min(availWA/Math.max(1,aRect.width), availHA/Math.max(1,aRect.height));
  var scaleB = Math.min(availWB/Math.max(1,bRect.width), availHB/Math.max(1,bRect.height));
  var font = Math.floor(base * Math.max(0.01, Math.min(scaleA, scaleB)));

  scoreAEl.style.fontSize = font + 'px';
  scoreBEl.style.fontSize = font + 'px';
  document.body.classList.remove('measuring');
  saveLiveStateBound();
}

export const queueFit = (function(){
  var raf = 0;
  var timeout = 0;
  return function(){
    cancelAnimationFrame(raf);
    clearTimeout(timeout);
    raf = requestAnimationFrame(function(){
      fitScores();
      timeout = setTimeout(fitScores, 60);
    });
  };
})();

export function bumpPlus(el){
  if(!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(function(){ el.classList.remove('pop'); }, 550);
}

export function bumpMinus(el){
  if(!el) return;
  el.classList.remove('popMinus');
  void el.offsetWidth;
  el.classList.add('popMinus');
  setTimeout(function(){ el.classList.remove('popMinus'); }, 550);
}

export function handleScoreBump(prevScore, newScore, element){
  if(prevScore !== null && newScore !== prevScore) {
    ((newScore > prevScore) ? bumpPlus : bumpMinus)(element);
  }
}

export function clearWinner(){
  ['#scoreA','#scoreB'].forEach(function(sel){
    var el = $(sel);
    if(el) el.classList.remove('winner');
  });
  ['#nameA_chip','#nameB_chip'].forEach(function(sel){
    var el = $(sel);
    if(el) el.classList.remove('winnerName');
  });
}
