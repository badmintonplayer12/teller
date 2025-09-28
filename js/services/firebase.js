import { state } from '../state/matchState.js';
import { qs } from '../dom.js';
import { readABFromModalInputs } from '../ui/layout.js';
import { setSpectatorDependencies, bindSpectatorHandlers } from './spectator.js';
import { LS } from '../constants.js';

let pushStateThrottled = function(){};
let pushStateNow = function(){};

export { pushStateThrottled, pushStateNow };

export function getStateForSync(){
  var names = readABFromModalInputs();
  
  // Convert names to sync format
  const syncNames = {
    A: typeof names.A === 'string' ? names.A : names.A?.display || names.A?.players?.join(' / ') || 'Spiller A',
    B: typeof names.B === 'string' ? names.B : names.B?.display || names.B?.players?.join(' / ') || 'Spiller B'
  };
  
  return {
    ts: Date.now(),
    hostUid: (window.firebase && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null),
    names: syncNames,
    scores: { A: state.scoreA, B: state.scoreB },
    sets: { A: state.setsA, B: state.setsB },
    currentSet: state.currentSet,
    isALeft: document.querySelector('.side.left')?.id === 'sideA',
    msg: document.getElementById('winnerMsg')?.textContent || '',
    online: true,
    format: { discipline: state.matchDiscipline, playMode: state.playMode }
  };
}

export function setupFirebase(options){
  options = options || {};
  if(state.IS_SPECTATOR && typeof options.updateScores === 'function'){
    setSpectatorDependencies({ updateScores: options.updateScores });
  }

  loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js', function(){
    loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js', function(){
      loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js', afterSDK);
    });
  });
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

    if(state.IS_SPECTATOR){
      var gid = qs('game');
      if(!gid){
        alert('Mangler ?game=ID i URL');
        return;
      }
      var ref = db.ref('games/' + gid);
      bindSpectatorHandlers(ref);
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
      pushStateNow();
    }
  });
}

function loadScript(src, cb){
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = function(){ cb(null); };
  s.onerror = function(){ cb(new Error('load '+src)); };
  document.head.appendChild(s);
}

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

