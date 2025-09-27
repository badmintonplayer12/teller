import { state } from '../state/matchState.js';
import { qs } from '../constants.js';
import { $ } from '../ui/dom.js';
import { readABFromModalInputs } from '../ui/layout.js';

var pushStateThrottled=function(){};
var pushStateNow=function(){};

export { pushStateThrottled, pushStateNow };

export function getStateForSync(){
  var n = readABFromModalInputs();
  return {
    ts: Date.now(),
    hostUid: (window.firebase && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null),
    names: { A: n.A, B: n.B },
    scores: { A: state.scoreA, B: state.scoreB },
    sets: { A: state.setsA, B: state.setsB },
    currentSet: state.currentSet,
    isALeft: ($('#sideA') && $('#sideA').classList.contains('left')) || false,
    msg: ($('#winnerMsg') && $('#winnerMsg').textContent) || '',
    online: true
    // <- IKKE betweenSets i RTDB
  };
}

export function setupFirebase(){
  function loadScript(src,cb){
    var s=document.createElement('script');
    s.src=src;
    s.async=true;
    s.onload=function(){cb(null)};
    s.onerror=function(){cb(new Error('load '+src))};
    document.head.appendChild(s);
  }
  
  function afterSDK(){
    if(!window.firebase){
      console.warn('Firebase ikke tilgjengelig – lokal modus');
      return;
    }
    
    var conf={
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
        firebase.auth().signInAnonymously().catch(function(e){
          console.warn('Anon auth feilet',e);
        });
        return;
      }
      
      var db=firebase.database();
      
      if(state.IS_SPECTATOR){
        var gid=qs('game');
        if(!gid){
          alert('Mangler ?game=ID i URL');
          return;
        }
        
        // Set up spectator mode - this will be handled by rtdbLive.js
        // For now, just set up the basic connection
        var ref=db.ref('games/'+gid);
        console.log('Spectator mode: connected to game', gid);
        
      } else {
        // Control mode setup
        var gid = ensureGameId();
        var ref=db.ref('games/'+gid);
        var to=0;
        
        pushStateThrottled=function(){
          clearTimeout(to);
          to=setTimeout(function(){
            ref.set(getStateForSync());
          },180);
        };
        
        pushStateNow=function(){
          clearTimeout(to);
          return ref.set(getStateForSync());
        };
        
        db.ref('games/'+gid+'/online').onDisconnect().set(false);
        db.ref('games/'+gid+'/online').set(true);
        pushStateNow();
      }
    });
  }
  
  loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',function(){
    loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js',function(){
      loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',afterSDK);
    });
  });
}

function makeId(n){
  n=n||9;
  var a='ABCDEFGHJKLMNPQRSTUVXYZ23456789',s='';
  for(var i=0;i<n;i++)s+=a[(Math.random()*a.length)|0];
  return s;
}

function ensureGameId(){
  try{
    var p=new URL(location.href).searchParams;
    var from=p.get('game');
    if(from){
      localStorage.setItem('badm_game_id_v3',from);
      return from;
    }
    var cur=localStorage.getItem('badm_game_id_v3');
    if(cur)return cur;
    var g=makeId(9);
    localStorage.setItem('badm_game_id_v3',g);
    return g;
  }catch(e){
    return 'LOCALTEST';
  }
}

export function spectatorShareUrl(){
  var gid=ensureGameId();
  try{
    var u=new URL(location.href);
    u.searchParams.set('mode','spectator');
    u.searchParams.set('game',gid);
    return u.toString();
  }catch(e){
    return location.origin+location.pathname+'?mode=spectator&game='+encodeURIComponent(gid);
  }
}

