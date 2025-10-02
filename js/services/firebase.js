import { state, getDisplayName } from '../state/matchState.js';
import { qs } from '../dom.js';
import { readABFromModalInputs } from '../ui/layout.js';
import { setFirebaseSyncDependencies, bindFirebaseSync } from './firebaseSync.js';
import { LS } from '../constants.js';
import { loadScript } from '../util/loadScript.js';

let pushStateThrottled = function(){};
let pushStateNow = function(){};

// Echo-guard memory
let lastWrite = null;
let firebaseDb = null;

export { pushStateThrottled, pushStateNow };

/**
 * Get Firebase database instance
 * @returns {Object|null} Firebase database or null if not available
 */
export function rtdb() {
  return firebaseDb;
}

/**
 * Get current timestamp
 * @returns {number} Current timestamp
 */
export function nowTs() {
  return Date.now();
}

/**
 * Set last write info for echo-guard
 * @param {Object} writeInfo - Write information {path, ts, hash}
 */
export function setLastWrite(writeInfo) {
  lastWrite = writeInfo;
}

/**
 * Get last write info
 * @returns {Object|null} Last write information
 */
export function getLastWrite() {
  return lastWrite;
}

export function getStateForSync(){
  var names = readABFromModalInputs();
  
  // Convert names to sync format
  const syncNames = { A: getDisplayName(names.A, 'A'), B: getDisplayName(names.B, 'B') };
  
  var base = {
    ts: Date.now(),
    hostUid: (window.firebase && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null),
    names: syncNames,
    scores: { A: state.scoreA, B: state.scoreB },
    sets: { A: state.setsA, B: state.setsB },
    currentSet: state.currentSet,
    isALeft: document.querySelector('.side.left')?.id === 'sideA',
    online: true,
    format: { discipline: state.matchDiscipline, playMode: state.playMode }
  };
  
  // Add tournament snapshot for dashboard
  var td = state.tournamentData;
  if (td) {
    var tSnap = {
      activeMatchId: td.activeMatchId || null,
      matchStates: td.matchStates || {}
    };
    base.tournament = tSnap;
  }
  
  return base;
}

export function setupFirebase(options){
  options = options || {};
  if(state.IS_SPECTATOR && typeof options.updateScores === 'function'){
    setFirebaseSyncDependencies({ updateScores: options.updateScores });
  }

  loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js')
    .then(() => loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'))
    .then(() => loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js'))
    .then(afterSDK)
    .catch(err => console.error('Firebase SDK load error:', err));
}

function afterSDK(){
  if(!window.firebase){
    console.warn('Firebase ikke tilgjengelig - lokal modus');
    return;
  }

  var conf = {
    apiKey:'AIzaSyC_ApdJ1Xjldak5lw2myQI-6Y08ncU2UtM',
    authDomain:'badmintonteller.firebaseapp.com',
    projectId:'badmintonteller',
    storageBucket:'badmintonteller.firebasestorage.app',
    messagingSenderId:'776787720081',
    appId:'1:776787720081:web:6802244ed1a94519760c30',
    measurementId:'G-9PK8TF32H2',
    databaseURL:'https://badmintonteller-default-rtdb.europe-west1.firebasedatabase.app/'
  };

  if(!firebase.apps.length) firebase.initializeApp(conf);

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      firebase.auth().signInAnonymously().catch(function(err){
        console.warn('Anon auth feilet', err);
      });
      return;
    }

    var db = firebase.database();
    firebaseDb = db; // Store for mutations.js

    if(state.IS_SPECTATOR){
      var gid = qs('game');
      if(!gid){
        alert('Mangler ?game=ID i URL');
        return;
      }
      var ref = db.ref('games/' + gid);
      bindFirebaseSync({ role: 'spectator', ref, canWrite: false });
    }else{
      var gid = ensureGameId();
      var ref = db.ref('games/' + gid);
      var timeout = 0;

      pushStateThrottled = function(){
        clearTimeout(timeout);
        timeout = setTimeout(function(){
          ref.set(getStateForSync());
        }, 180);
      };

      pushStateNow = function(){
        clearTimeout(timeout);
        return ref.set(getStateForSync());
      };

      db.ref('games/' + gid + '/online').onDisconnect().set(false);
      db.ref('games/' + gid + '/online').set(true);
      
      // TODO: Migrate to mutations.js in later PR
      // Guard: Only push initial state if we have writer role
      if (state.role === 'writer') {
        pushStateNow();
      }
    }
  });
}

// loadScript moved to js/util/loadScript.js

export function ensureGameId(){
  try{
    var params = new URL(location.href).searchParams;
    var from = params.get('game');
    if(from){
      localStorage.setItem(LS.GAME_ID, from);
      return from;
    }
    var cur = localStorage.getItem(LS.GAME_ID);
    if(cur) return cur;
    var g = makeId(9);
    localStorage.setItem(LS.GAME_ID, g);
    return g;
  }catch(_){
    return 'LOCALTEST';
  }
}

/**
 * Get Firebase reference for a specific game
 * @param {string} gameId - Game ID to get reference for
 * @returns {Object|null} Firebase reference or null if not available
 */
export function getGameRef(gameId){
  var db = rtdb();
  if (!db) return null;
  var gid = gameId || ensureGameId();
  return gid ? db.ref('games/' + gid) : null;
}

/**
 * Get Firebase reference for current game
 * @returns {Object|null} Firebase reference for current game or null
 */
export function currentGameRef(){
  return getGameRef(ensureGameId());
}

export function spectatorShareUrl(){
  var gid = ensureGameId();
  try{
    var u = new URL(location.href);
    u.searchParams.set('mode', 'spectator');
    u.searchParams.set('game', gid);
    return u.toString();
  }catch(_){
    return location.origin + location.pathname + '?mode=spectator&game=' + encodeURIComponent(gid);
  }
}

function makeId(n){
  n = n || 9;
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVXYZ23456789';
  var out = '';
  for(var i=0;i<n;i++) out += alphabet[(Math.random() * alphabet.length) | 0];
  return out;
}

export function bindDashboardHandlers(ref, cb){
  ref.on('value', function(snap){
    var v = snap && snap.val ? snap.val() : null;
    try { 
      cb && cb(v || {}); 
    } catch(e){
      console.warn('Dashboard handler error:', e);
    }
  });
}

