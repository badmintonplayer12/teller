// Dynamic write access management for counter/cocounter roles
import { state } from '../state/matchState.js';

// Current write access state (synced via Firebase)
let _currentWriter = null; // 'counter' | 'cocounter' | null
let _onWriteAccessChange = function(){};
let _pushStateNow = function(){};
let _getGameRef = function(){ return null; };

/**
 * Set callback for write access changes
 */
export function setWriteAccessDependencies(deps){
  deps = deps || {};
  if (typeof deps.onWriteAccessChange === 'function') {
    _onWriteAccessChange = deps.onWriteAccessChange;
  }
  if (typeof deps.pushStateNow === 'function') {
    _pushStateNow = deps.pushStateNow;
  }
  if (typeof deps.getGameRef === 'function') {
    _getGameRef = deps.getGameRef;
  }
}

/**
 * Get current writer role
 */
export function getCurrentWriter(){
  return _currentWriter;
}

/**
 * Check if current user has write access
 */
export function hasWriteAccess(){
  if (state.IS_SPECTATOR) return false;
  
  // If no writer is set, counter gets default access
  if (_currentWriter === null) {
    return !state.IS_COCOUNTER;
  }
  
  // Check if current user matches the writer
  if (state.IS_COCOUNTER) {
    return _currentWriter === 'cocounter';
  } else {
    return _currentWriter === 'counter';
  }
}

/**
 * Claim write access for current user
 */
export function claimWriteAccess(){
  if (state.IS_SPECTATOR) return false;
  
  var newWriter = state.IS_COCOUNTER ? 'cocounter' : 'counter';
  
  console.log('[WRITE ACCESS] Claiming write access for:', newWriter);
  console.log('[WRITE ACCESS] _getGameRef function:', typeof _getGameRef);
  
  // Update Firebase with new writer
  try {
    var ref = _getGameRef();
    console.log('[WRITE ACCESS] Firebase ref:', ref);
    if (ref) {
      ref.child('currentWriter').set(newWriter);
      console.log('[WRITE ACCESS] Updated Firebase currentWriter to:', newWriter);
    } else {
      console.warn('[WRITE ACCESS] No Firebase ref available');
      return false;
    }
  } catch(error) {
    console.warn('[WRITE ACCESS] Failed to update Firebase:', error);
    return false;
  }
  
  return true;
}

/**
 * Release write access
 */
export function releaseWriteAccess(){
  if (state.IS_SPECTATOR) return false;
  
  var currentRole = state.IS_COCOUNTER ? 'cocounter' : 'counter';
  
  if (_currentWriter === currentRole) {
    console.log('[WRITE ACCESS] Releasing write access from:', currentRole);
    
    // Update Firebase to remove current writer
    try {
      var ref = _getGameRef();
      if (ref) {
        ref.child('currentWriter').set(null);
        console.log('[WRITE ACCESS] Cleared Firebase currentWriter');
      }
    } catch(error) {
      console.warn('[WRITE ACCESS] Failed to clear Firebase:', error);
      return false;
    }
    
    return true;
  }
  
  return false; // Didn't have access
}

/**
 * Initialize write access system
 */
export function initWriteAccess(){
  console.log('[WRITE ACCESS] initWriteAccess called');
  console.log('[WRITE ACCESS] state.IS_SPECTATOR:', state.IS_SPECTATOR);
  console.log('[WRITE ACCESS] state.IS_COCOUNTER:', state.IS_COCOUNTER);
  console.log('[WRITE ACCESS] _getGameRef function:', typeof _getGameRef);
  
  // Counter gets default write access, cocounter does not
  if (!state.IS_SPECTATOR && !state.IS_COCOUNTER) {
    console.log('[WRITE ACCESS] Initializing as counter - setting Firebase currentWriter');
    
    // Set initial writer in Firebase
    try {
      var ref = _getGameRef();
      console.log('[WRITE ACCESS] Firebase ref for init:', ref);
      if (ref) {
        // Only set if not already set (to avoid overriding existing writer)
        ref.child('currentWriter').once('value', function(snapshot) {
          if (!snapshot.exists()) {
            ref.child('currentWriter').set('counter');
            console.log('[WRITE ACCESS] Set initial Firebase currentWriter to counter');
          } else {
            console.log('[WRITE ACCESS] Firebase currentWriter already exists:', snapshot.val());
          }
        });
      } else {
        console.warn('[WRITE ACCESS] No Firebase ref available for initialization');
      }
    } catch(error) {
      console.warn('[WRITE ACCESS] Failed to initialize Firebase currentWriter:', error);
    }
  } else {
    console.log('[WRITE ACCESS] Initialized as cocounter/spectator - no default writer set');
  }
}

/**
 * Update current writer from Firebase
 * Called by firebaseSync when currentWriter changes
 */
export function updateCurrentWriter(newWriter){
  var previousWriter = _currentWriter;
  
  // ELEGANT: Only update if value actually changed (prevent infinite loops)
  if (previousWriter === newWriter) {
    console.log('[WRITE ACCESS] Firebase update - currentWriter unchanged:', newWriter, '(skipping)');
    return;
  }
  
  _currentWriter = newWriter;
  
  console.log('[WRITE ACCESS] Firebase update - currentWriter changed from', previousWriter, 'to', newWriter);
  
  // Notify about the change
  try {
    _onWriteAccessChange({
      writer: _currentWriter,
      hasAccess: hasWriteAccess(),
      previousWriter: previousWriter
    });
  } catch(_){}
}

/**
 * Get write access status for UI
 */
export function getWriteAccessStatus(){
  return {
    currentWriter: _currentWriter,
    hasAccess: hasWriteAccess(),
    canClaim: !state.IS_SPECTATOR && !hasWriteAccess(),
    canRelease: !state.IS_SPECTATOR && hasWriteAccess()
  };
}
