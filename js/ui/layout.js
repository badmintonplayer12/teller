import { state } from '../state/matchState.js';
import { $ } from './dom.js';

export function setSidesDomTo(isALeftTarget){
  var wrap=$('#wrap'), A=$('#sideA'), B=$('#sideB'), div=document.querySelector('.divider');
  if(!(wrap&&A&&B&&div)) return;

  // Ta vare på "sanne" A/B med dagens layout
  var namesBefore = readABFromModalInputs();

  var aLeft=A.classList.contains('left');
  if(aLeft===isALeftTarget) return;

    wrap.classList.add('no-trans');
    try{
    if(isALeftTarget){
      A.classList.add('left'); A.classList.remove('right');
      B.classList.add('right'); B.classList.remove('left');
      wrap.insertBefore(A,wrap.firstElementChild);
      wrap.insertBefore(div,B);
      }else{
      B.classList.add('left');  B.classList.remove('right');
      A.classList.add('right'); A.classList.remove('left');
      wrap.insertBefore(B,wrap.firstElementChild);
      wrap.insertBefore(div,A);
      }
    }catch(e){}
    wrap.classList.remove('no-trans');

  // **Synk input-feltene til ny layout**
  if (!state.IS_SPECTATOR) {
    writeModalInputsFromAB(namesBefore.A, namesBefore.B);
    updateNameChips();
  }
}

export function startVisualSwap(done){
  if(state.swapping) return;
  state.swapping = true;

  // Ta vare på "sanne" A/B før vi bytter layout
  var namesBefore = readABFromModalInputs();

  var wrap=$('#wrap'), left=document.querySelector('.side.left'), right=document.querySelector('.side.right'), div=document.querySelector('.divider');
  if(!(wrap&&left&&right&&div)){state.swapping=false;return}

  wrap.classList.add('swap-go');
  var finished=false;
  function complete(){
    if(finished) return; finished=true;
    left.removeEventListener('transitionend',onEnd);
    right.removeEventListener('transitionend',onEnd);

      try{
        wrap.classList.add('no-trans');
        wrap.insertBefore(right,left);
      if(div.parentNode!==wrap) wrap.appendChild(div);
      wrap.insertBefore(div,left);
      left.classList.remove('left'); left.classList.add('right');
      right.classList.remove('right'); right.classList.add('left');
      }catch(e){}

    wrap.classList.remove('swap-go'); void wrap.offsetWidth; wrap.classList.remove('no-trans');

    // **VIKTIG:** Synk input-feltene til ny layout
    if (!state.IS_SPECTATOR) {
      writeModalInputsFromAB(namesBefore.A, namesBefore.B);
      updateNameChips();
    }

    fitScores();
    state.swapping = false;
    saveLiveState();
    (typeof pushStateNow === 'function' ? pushStateNow() : pushStateThrottled()); // flush isALeft nå

    if (typeof done === 'function') {  // …så kan vi gjøre "etter-animasjon"
      try { done(); } catch(_) {}
    }
  }
  function onEnd(e){ if(e.target!==left&&e.target!==right) return; complete() }

  left.addEventListener('transitionend',onEnd);
  right.addEventListener('transitionend',onEnd);
    setTimeout(complete,1200);
}

export function swapSides(){startVisualSwap()}

export function fitScores(){
  if (state.IS_SPECTATOR && (
      document.getElementById('A_digits')?.classList.contains('pop') ||
      document.getElementById('A_digits')?.classList.contains('popMinus') ||
      document.getElementById('B_digits')?.classList.contains('pop') ||
      document.getElementById('B_digits')?.classList.contains('popMinus')
    )) return;

  document.body.classList.add('measuring');var base=100,sA=$('#scoreA'),sB=$('#scoreB');if(!sA||!sB){document.body.classList.remove('measuring');return}sA.style.fontSize=base+'px';sB.style.fontSize=base+'px';var nameAH=(($('#sideA .name')||{}).offsetHeight)||0;var nameBH=(($('#sideB .name')||{}).offsetHeight)||0;function padY(e){var cs=getComputedStyle(e);return (parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)}var availHA=Math.max(40,(($('#sideA')||{}).clientHeight||0)-nameAH-padY($('#sideA')));var availHB=Math.max(40,(($('#sideB')||{}).clientHeight||0)-nameBH-padY($('#sideB')));function padX(e){var cs=getComputedStyle(e);return (parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0)}var availWA=Math.max(40,(($('#sideA .scoreBox')||{}).clientWidth||0)-padX(sA));var availWB=Math.max(40,(($('#sideB .scoreBox')||{}).clientWidth||0)-padX(sB));var aRect=$('#A_digits').getBoundingClientRect();var bRect=$('#B_digits').getBoundingClientRect();var scaleA=Math.min(availWA/Math.max(1,aRect.width),availHA/Math.max(1,aRect.height));var scaleB=Math.min(availWB/Math.max(1,bRect.width),availHB/Math.max(1,bRect.height));var f=Math.floor(base*Math.max(.01,Math.min(scaleA,scaleB)));sA.style.fontSize=f+'px';sB.style.fontSize=f+'px';document.body.classList.remove('measuring');saveLiveState()
}

export var queueFit=(function(){var raf=0,t=0;return function(){cancelAnimationFrame(raf);clearTimeout(t);raf=requestAnimationFrame(function(){fitScores();t=setTimeout(fitScores,60)})}})();

export function bumpPlus(el){if(!el)return;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');setTimeout(function(){el.classList.remove('pop')},550)}
export function bumpMinus(el){if(!el)return;el.classList.remove('popMinus');void el.offsetWidth;el.classList.add('popMinus');setTimeout(function(){el.classList.remove('popMinus')},550)}

export function clearWinner(){['#scoreA','#scoreB'].forEach(function(sel){var e=$(sel);if(e)e.classList.remove('winner')});['#nameA_chip','#nameB_chip'].forEach(function(sel){var e=$(sel);if(e)e.classList.remove('winnerName')})}

export function isALeft() {
  var left = document.querySelector('.side.left');
  return left && left.id === 'sideA';
}

// Leser verdiene slik brukeren ser dem i modalen (Venstre/Høyre),
// og returnerer et konsistent {A, B} uansett sidebytte.
export function readABFromModalInputs() {
  var leftVal  = ($('#nameA')?.value || 'Spiller A'); // label: Venstre
  var rightVal = ($('#nameB')?.value || 'Spiller B'); // label: Høyre
  return isALeft()
    ? { A: leftVal,  B: rightVal }
    : { A: rightVal, B: leftVal  };
}

// Når du skal fylle modalen, ta utgangspunkt i «sanne» A/B
// og speil dem til Venstre/Høyre basert på gjeldende sideoppsett.
export function writeModalInputsFromAB(Aname, Bname) {
  if (isALeft()) {
    $('#nameA').value = Aname;  // Venstre viser A
    $('#nameB').value = Bname;  // Høyre viser B
  } else {
    $('#nameA').value = Bname;  // Venstre viser B (A står til høyre)
    $('#nameB').value = Aname;  // Høyre viser A
  }
}

// Oppdater chipper basert på "sanne" A/B utledet fra modalen.
export function updateNameChipsFromModal() {
  var n = readABFromModalInputs();
  var ca = $('#nameA_chip'), cb = $('#nameB_chip');
  if (ca) ca.textContent = n.A;
  if (cb) cb.textContent = n.B;
}

// Placeholder imports that will be resolved by the calling modules
let saveLiveState, pushStateThrottled, pushStateNow, updateNameChips;

// These will be set by the calling module
export function setLayoutDependencies(deps) {
  saveLiveState = deps.saveLiveState;
  pushStateThrottled = deps.pushStateThrottled;
  pushStateNow = deps.pushStateNow;
  updateNameChips = deps.updateNameChips;
}

// Re-export the functions that are used elsewhere
export { readABFromModalInputs, writeModalInputsFromAB, updateNameChipsFromModal };
