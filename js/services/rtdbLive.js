import { state } from '../state/matchState.js';
import { qs } from '../constants.js';
import { $ } from '../ui/dom.js';
import { setSidesDomTo, fitScores, queueFit, bumpPlus, bumpMinus, clearWinner } from '../ui/layout.js';

var __spectPrev = { isALeft: null, A: null, B: null, setsA: null, setsB: null };
var __spectIsSwapping = false;     // ny
var __spectPendingZero = false;    // ny

export function setNameChipsDirect(Aname, Bname){
  var ca = document.getElementById('nameA_chip');
  var cb = document.getElementById('nameB_chip');
  if (ca) ca.textContent = Aname || 'Spiller A';
  if (cb) cb.textContent = Bname || 'Spiller B';
}

// Swap-ANIMASJON for spectator (ingen modal-synk)
export function startVisualSwapSpectator(done){
  var wrap = document.getElementById('wrap');
  var left = document.querySelector('.side.left');
  var right = document.querySelector('.side.right');
  var div = document.querySelector('.divider');
  if (!(wrap && left && right && div)) { if (typeof done==='function') done(); return; }

  if (wrap.classList.contains('swap-go')) return;

  __spectIsSwapping = true; // <— NYTT

  wrap.classList.add('swap-go');
  var finished = false;
  function complete(){
    if (finished) return; finished = true;
    try{
      wrap.classList.add('no-trans');
      // bytt plass i DOM
      wrap.insertBefore(right, left);
      if (div.parentNode !== wrap) wrap.appendChild(div);
      wrap.insertBefore(div, left);
      left.classList.remove('left');  left.classList.add('right');
      right.classList.remove('right'); right.classList.add('left');
    }catch(e){}
    wrap.classList.remove('swap-go'); void wrap.offsetWidth; wrap.classList.remove('no-trans');
    fitScores();

    __spectIsSwapping = false; // <— NYTT

    // Hvis vi utsatte 0–0, påfør det nå – uten glød
    if (__spectPendingZero) {
      __spectPendingZero = false;
      state.scoreA = 0; state.scoreB = 0;
      updateScores();
      document.getElementById('A_digits')?.classList.remove('pop','popMinus');
      document.getElementById('B_digits')?.classList.remove('pop','popMinus');
    }

    if (typeof done==='function') { try{ done(); }catch(_){} }
  }
  function onEnd(e){
    if (e.target !== left && e.target !== right) return;
    left.removeEventListener('transitionend', onEnd);
    right.removeEventListener('transitionend', onEnd);
    complete();
  }
  left.addEventListener('transitionend', onEnd);
  right.addEventListener('transitionend', onEnd);
  setTimeout(complete, 1200);
}

export function bindSpectatorHandlers(dbRef) {
  dbRef.off();
  dbRef.on('value', function(snap) {
    var v = snap.val();
    if (!v) return;

    // 1) Les verdier fra DB
    var nextIsALeft = !!v.isALeft;
    var a = Number((v.scores && v.scores.A) || 0);
    var b = Number((v.scores && v.scores.B) || 0);
    var prevA = __spectPrev.A;
    var prevB = __spectPrev.B;
    var prevSA = __spectPrev.setsA;
    var prevSB = __spectPrev.setsB;

    // Hent sett-tellere fra DB (disse driver de blå sirklene)
    var sA = Number((v.sets && v.sets.A) || 0);
    var sB = Number((v.sets && v.sets.B) || 0);

    var isSetChange = (prevSA != null && (sA !== prevSA || sB !== prevSB));

    // NY: kjenn igjen "reset til 0–0"
    var dropToZero = (a === 0 && b === 0) && ((prevA > 0) || (prevB > 0));

    var wantSwap = (__spectPrev.isALeft !== null) && (__spectPrev.isALeft !== nextIsALeft); // ny

    // Hold igjen 0–0 til etter animasjonen
    if (dropToZero && (wantSwap || __spectIsSwapping)) {
      __spectPendingZero = true;
      // behold gamle poeng på skjermen mens vi animerer bytte
      a = (typeof prevA === 'number') ? prevA : a;
      b = (typeof prevB === 'number') ? prevB : b;
    }

    state.scoreA = a; state.scoreB = b;
    state.setsA = sA; state.setsB = sB;
    // (valgfritt) oppdater også currentSet om du vil vise det senere:
    state.currentSet = Number(v.currentSet || state.currentSet);

    // 2) Navn: ALDRI via modal i spectator
    setNameChipsDirect((v.names && v.names.A) || 'Spiller A',
                       (v.names && v.names.B) || 'Spiller B');

    // 3) Sideswap: første gang -> sett direkte. Ved endring -> ANIMER
    if (__spectPrev.isALeft === null) {
      setSidesDomTo(nextIsALeft);   // init
    } else if (__spectPrev.isALeft !== nextIsALeft) {
      startVisualSwapSpectator();   // animert bytte
    }

    // 4) Poeng -> oppdater og bump KUN siden som endret seg
    updateScores();

    // Ikke glød ved sett-overgang eller ved 0–0-reset
    var suppressBumps = isSetChange || dropToZero;

    var elA = document.getElementById('A_digits');
    var elB = document.getElementById('B_digits');

    if (!suppressBumps) {
      if (prevA != null && a !== prevA) ((a > prevA) ? bumpPlus : bumpMinus)(elA);
      if (prevB != null && b !== prevB) ((b > prevB) ? bumpPlus : bumpMinus)(elB);
    } else {
      // Sørg for at ingen "hengende" animasjonsklasser ligger igjen
      elA?.classList.remove('pop','popMinus');
      elB?.classList.remove('pop','popMinus');
    }

    clearWinner();
    document.getElementById('winnerMsg').textContent = v.msg || '';
    if (v.msg && v.msg.indexOf('GRATULERER') > -1) {
      if (state.scoreA > state.scoreB) {
        document.getElementById('scoreA')?.classList.add('winner');
        document.getElementById('nameA_chip')?.classList.add('winnerName');
      } else {
        document.getElementById('scoreB')?.classList.add('winner');
        document.getElementById('nameB_chip')?.classList.add('winnerName');
      }
    }

    // I spectator: ikke re-fit på hvert poeng (gir "dobbel bump").
    // Refit kun ved første snapshot eller når layout endres (swap).
    if (__spectPrev.isALeft === null || __spectPrev.isALeft !== nextIsALeft) {
      queueFit();
    }
    // Refit også når sett-badgene endrer seg (sjeldent – ved sett-slutt)
    if (prevSA != null && (prevSA !== state.setsA || prevSB !== state.setsB)) {
      queueFit();
    }

    __spectPrev = { isALeft: nextIsALeft, A: a, B: b, setsA: state.setsA, setsB: state.setsB };
  }, function(err) {
    console.warn('RTDB lesefeil', err && err.code);
    // toast('Kan ikke lese kampdata');
  });
}

// Placeholder for updateScores - will be set by calling module
let updateScores;

export function setRtdbLiveDependencies(deps) {
  updateScores = deps.updateScores;
}

