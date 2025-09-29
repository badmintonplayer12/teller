import { state } from '../state/matchState.js';
import { setSidesDomTo, fitScores, queueFit, bumpPlus, bumpMinus, clearWinner } from '../ui/layout.js';

let updateScores = function(){};

const prev = {
  isALeft: null,
  scoreA: null,
  scoreB: null,
  setsA: null,
  setsB: null
};

let isSwapping = false;
let pendingZero = false;

export function setSpectatorDependencies(deps){
  updateScores = deps.updateScores || updateScores;
}

export function setNameChipsDirect(nameA, nameB){
  var ca = document.getElementById('nameA_chip');
  var cb = document.getElementById('nameB_chip');
  
  // Handle both string and object formats
  const aDisplay = typeof nameA === 'string' ? nameA : (nameA?.display || nameA?.players?.join(' / ') || 'Spiller A');
  const bDisplay = typeof nameB === 'string' ? nameB : (nameB?.display || nameB?.players?.join(' / ') || 'Spiller B');
  
  if(ca) ca.textContent = aDisplay;
  if(cb) cb.textContent = bDisplay;
}

export function startVisualSwapSpectator(done){
  if(isSwapping) return;
  isSwapping = true;
  var wrap = document.getElementById('wrap');
  var left = document.querySelector('.side.left');
  var right = document.querySelector('.side.right');
  var divider = document.querySelector('.divider');
  if(!(wrap && left && right && divider)){
    isSwapping = false;
    if(typeof done === 'function') done();
    return;
  }
  if(wrap.classList.contains('swap-go')){
    isSwapping = false;
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
    fitScores();
    isSwapping = false;
    if(pendingZero){
      pendingZero = false;
      state.scoreA = 0;
      state.scoreB = 0;
      updateScores();
      document.getElementById('A_digits')?.classList.remove('pop','popMinus');
      document.getElementById('B_digits')?.classList.remove('pop','popMinus');
    }
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

export function bindSpectatorHandlers(ref){
  ref.off();
  ref.on('value', function(snap){
    var v = snap.val();
    if(!v) return;

    var nextIsALeft = !!v.isALeft;
    var a = Number(v.scores?.A || 0);
    var b = Number(v.scores?.B || 0);
    var setsA = Number(v.sets?.A || 0);
    var setsB = Number(v.sets?.B || 0);

    var isSetChange = (prev.setsA != null && (prev.setsA !== setsA || prev.setsB !== setsB));
    var dropToZero = (a === 0 && b === 0) && ((prev.scoreA > 0) || (prev.scoreB > 0));
    var wantSwap = (prev.isALeft !== null) && (prev.isALeft !== nextIsALeft);

    if(dropToZero && (wantSwap || isSwapping)){
      pendingZero = true;
      a = typeof prev.scoreA === 'number' ? prev.scoreA : a;
      b = typeof prev.scoreB === 'number' ? prev.scoreB : b;
    }

    state.scoreA = a;
    state.scoreB = b;
    state.setsA = setsA;
    state.setsB = setsB;
    state.currentSet = Number(v.currentSet || state.currentSet);

    setNameChipsDirect(v.names?.A, v.names?.B);

    if(prev.isALeft === null){
      setSidesDomTo(nextIsALeft);
    }else if(prev.isALeft !== nextIsALeft){
      startVisualSwapSpectator();
    }

    updateScores();

    var suppressBumps = isSetChange || dropToZero;
    var elA = document.getElementById('A_digits');
    var elB = document.getElementById('B_digits');

    if(!suppressBumps){
      if(prev.scoreA != null && a !== prev.scoreA) ((a > prev.scoreA) ? bumpPlus : bumpMinus)(elA);
      if(prev.scoreB != null && b !== prev.scoreB) ((b > prev.scoreB) ? bumpPlus : bumpMinus)(elB);
    }else{
      elA?.classList.remove('pop','popMinus');
      elB?.classList.remove('pop','popMinus');
    }

    clearWinner();
    if(v.msg && v.msg.indexOf('GRATULERER') > -1){
      if(a > b){
        document.getElementById('scoreA')?.classList.add('winner');
        document.getElementById('nameA_chip')?.classList.add('winnerName');
      }else{
        document.getElementById('scoreB')?.classList.add('winner');
        document.getElementById('nameB_chip')?.classList.add('winnerName');
      }
    }

    if(prev.isALeft === null || prev.isALeft !== nextIsALeft) queueFit();
    if(prev.setsA != null && (prev.setsA !== setsA || prev.setsB !== setsB)) queueFit();

    prev.isALeft = nextIsALeft;
    prev.scoreA = state.scoreA;
    prev.scoreB = state.scoreB;
    prev.setsA = state.setsA;
    prev.setsB = state.setsB;
  }, function(err){
    console.warn('RTDB lesefeil', err && err.code);
  });
}
