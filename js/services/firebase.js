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
let isLocalOnlyMode = false;

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

export async function getStateForSync(includeHostUid = false){
  var names = readABFromModalInputs();
  
  // Convert names to sync format
  const syncNames = { A: getDisplayName(names.A, 'A'), B: getDisplayName(names.B, 'B') };
  
  var base = {
    ts: Date.now(),
    names: syncNames,
    scores: { A: state.scoreA, B: state.scoreB },
    sets: { A: state.setsA, B: state.setsB },
    currentSet: state.currentSet,
    isALeft: document.querySelector('.side.left')?.id === 'sideA',
    online: true,
    format: { discipline: state.matchDiscipline, playMode: state.playMode }
  };
  
  // Include hostUid for new game creation, or preserve existing hostUid
  if (includeHostUid && window.firebase && firebase.auth && firebase.auth().currentUser) {
    // For new game creation: set hostUid to current user
    base.hostUid = firebase.auth().currentUser.uid;
  } else {
    // For regular updates: don't overwrite hostUid (it should remain unchanged)
    // This prevents cocounter from overwriting counter's hostUid
    // hostUid is omitted from regular sync data
  }
  
  // Include currentWriter in sync data to satisfy Firebase rules
  // Get current writer from writeAccess.js
  try {
    const writeAccess = await import('./writeAccess.js');
    base.currentWriter = writeAccess.getCurrentWriter();
  } catch (e) {
    console.warn('[FIREBASE] Failed to get currentWriter:', e);
    base.currentWriter = null; // Fallback
  }
  
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

  firebase.auth().onAuthStateChanged(async function(user){
    if(!user){
      firebase.auth().signInAnonymously().catch(function(err){
        console.warn('Anon auth feilet', err);
      });
      return;
    }
    
    console.log('[FIREBASE] User authenticated:', user.uid);
    console.log('[FIREBASE] User is anonymous:', user.isAnonymous);

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
        timeout = setTimeout(async function(){
          var dataToSync = await getStateForSync();
          console.log('[FIREBASE DEBUG] Throttled write attempt:', {
            gameId: gid,
            hostUid: dataToSync.hostUid,
            scores: dataToSync.scores,
            currentWriter: dataToSync.currentWriter
          });
          ref.set(dataToSync).then(function() {
            // Clear error state on successful write
            import('./firebaseSync.js').then(function(module) {
              module.clearFirebaseWriteErrors();
            });
          }).catch(function(error) {
            console.warn('[FIREBASE] Throttled push failed:', error);
            // Report error to suppress conflicting reads
            import('./firebaseSync.js').then(function(module) {
              module.reportFirebaseWriteError(error);
            });
          });
        }, 180);
      };

      pushStateNow = async function(){
        clearTimeout(timeout);
        var dataToSync = await getStateForSync();
        console.log('[FIREBASE DEBUG] Attempting to write data:', {
          gameId: gid,
          hostUid: dataToSync.hostUid,
          scores: dataToSync.scores,
          currentWriter: dataToSync.currentWriter
        });
        return ref.set(dataToSync).then(function() {
          // Clear error state on successful write
          import('./firebaseSync.js').then(function(module) {
            module.clearFirebaseWriteErrors();
          });
        }).catch(function(error) {
          console.warn('[FIREBASE] Push now failed:', error);
          // Report error to suppress conflicting reads
          import('./firebaseSync.js').then(function(module) {
            module.reportFirebaseWriteError(error);
          });
          throw error; // Re-throw for caller handling
        });
      };

      // Online status is already included in main game data (getStateForSync)
      // Set disconnect handler only
      db.ref('games/' + gid + '/online').onDisconnect().set(false).catch(function(error) {
        console.warn('[FIREBASE INIT] Failed to set disconnect handler:', error);
        // Don't enable local-only mode for disconnect handler failures
      });
      
      // TODO: Migrate to mutations.js in later PR
      // Guard: Only push initial state if we're the counter (not cocounter/spectator) AND user is authenticated
      if (!state.IS_SPECTATOR && !state.IS_COCOUNTER && user && user.uid) {
        console.log('[FIREBASE INIT] Setting up new game with hostUid:', user.uid);
        
        // Create initial game data with hostUid in one atomic write
        // This satisfies Firebase rules that require hostUid to be set when creating the node
        var initialData = await getStateForSync(true); // Include hostUid for new game creation
        
        // Set initial currentWriter to null - writeAccess.js will manage it separately
        initialData.currentWriter = null;
        
        console.log('[FIREBASE INIT] Creating game with data:', {
          hostUid: initialData.hostUid,
          names: initialData.names,
          scores: initialData.scores,
          currentWriter: initialData.currentWriter
        });
        
        ref.set(initialData).then(function() {
          console.log('[FIREBASE INIT] Initial game data set successfully');
        }).catch(function(error) {
          console.warn('[FIREBASE INIT] Failed to initialize game:', error);
          // If we can't write to this game ID, it might be a permission issue
          // Enable local-only mode until Firebase works
          enableLocalOnlyMode(error);
        });
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
 * Generate a new game ID and store it (for new matches)
 */
export function generateNewGameId(){
  try{
    var g = makeId(9);
    localStorage.setItem(LS.GAME_ID, g);
    console.log('[FIREBASE] Generated new game ID:', g);
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

// Generate share URL for any mode
export function generateShareUrl(mode, gameId) {
  mode = mode || 'spectator';
  gameId = gameId || ensureGameId();
  
  try {
    var u = new URL(location.href);
    u.searchParams.set('mode', mode);
    u.searchParams.set('game', gameId);
    return u.toString();
  } catch(_) {
    return location.origin + location.pathname + '?mode=' + encodeURIComponent(mode) + '&game=' + encodeURIComponent(gameId);
  }
}

/**
 * Enable local-only mode when Firebase permissions fail
 */
function enableLocalOnlyMode(error) {
  if (isLocalOnlyMode) return; // Already enabled
  
  isLocalOnlyMode = true;
  window._badmintonLocalOnlyMode = true; // Global flag for other modules
  console.warn('[FIREBASE] Enabling local-only mode due to permission error:', error);
  
  // Replace push functions with no-ops
  pushStateThrottled = function() {
    console.log('[FIREBASE] Skipping throttled push (local-only mode)');
  };
  
  pushStateNow = function() {
    console.log('[FIREBASE] Skipping immediate push (local-only mode)');
    return Promise.resolve(); // Return resolved promise for compatibility
  };
  
  // Show user notification
  import('../dom.js').then(function(module) {
    module.toast('Lokal modus: Poeng lagres kun på denne enheten');
  });
  
  // Disable Firebase sync to prevent conflicting reads
  import('./firebaseSync.js').then(function(module) {
    module.unbindFirebaseSync();
  });
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

