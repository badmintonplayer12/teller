// Dynamic write access management for counter/cocounter roles
import { state } from '../state/matchState.js';

// Current write access state (synced via Firebase)
let _currentWriter = null; // 'counter' | 'cocounter' | null
let _explicitlyReleased = false; // Track if write access was explicitly released
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
 * Note: This is different from state.allowScoring:
 * - allowScoring = workflow state (setup vs active match)
 * - hasWriteAccess = security (who can modify scores right now)
 */
export function hasWriteAccess(){
  if (state.IS_SPECTATOR) return false;
  
  // In local-only mode, use the same logic as normal mode
  // but without Firebase sync (This is set when Firebase permissions fail)
  if (window._badmintonLocalOnlyMode) {
    // Use same logic as normal mode for consistency
    if (_currentWriter === null) {
      if (_explicitlyReleased) {
        return false; // No one has access after explicit release
      }
      return !state.IS_COCOUNTER; // Counter gets default access on startup
    }
    
    // Check if current user matches the writer
    const currentRole = state.IS_COCOUNTER ? 'cocounter' : 'counter';
    return _currentWriter === currentRole;
  }
  
  // If no writer is set, counter gets default access
  // UNLESS write access was explicitly released
  if (_currentWriter === null) {
    if (_explicitlyReleased) {
      return false; // No one has access after explicit release
    }
    return !state.IS_COCOUNTER; // Counter gets default access on startup
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
  console.log('[WRITE ACCESS] Current writer state:', _currentWriter);
  console.log('[WRITE ACCESS] _getGameRef function:', typeof _getGameRef);
  
  // Update Firebase with new writer
  try {
    var ref = _getGameRef();
    console.log('[WRITE ACCESS] Firebase ref:', !!ref);
    if (ref) {
      ref.child('currentWriter').set(newWriter).then(function() {
        console.log('[WRITE ACCESS] Successfully updated Firebase currentWriter to:', newWriter);
        // Clear explicitly released flag when someone claims access
        _explicitlyReleased = false;
      }).catch(function(error) {
        console.warn('[WRITE ACCESS] Failed to set currentWriter:', error);
      });
    } else {
      console.warn('[WRITE ACCESS] No Firebase ref available - Firebase may not be ready');
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
  
  console.log('[WRITE ACCESS] Attempting to release write access');
  console.log('[WRITE ACCESS] Current role:', currentRole);
  console.log('[WRITE ACCESS] Current writer:', _currentWriter);
  console.log('[WRITE ACCESS] Has access check:', _currentWriter === currentRole);
  
  // Allow counter to release even default access, cocounter can only release if they have explicit access
  var canRelease = (_currentWriter === currentRole) || 
                   (currentRole === 'counter' && _currentWriter === null && !_explicitlyReleased);
  
  if (canRelease) {
    console.log('[WRITE ACCESS] Releasing write access from:', currentRole, '(current writer:', _currentWriter, ')');
    
    // Update Firebase to remove current writer
    try {
      var ref = _getGameRef();
      if (ref) {
        ref.child('currentWriter').set(null).then(function() {
          console.log('[WRITE ACCESS] Successfully cleared Firebase currentWriter');
        }).catch(function(error) {
          console.warn('[WRITE ACCESS] Failed to clear currentWriter:', error);
        });
      } else {
        console.warn('[WRITE ACCESS] No Firebase ref available for release');
        // Still allow release in local-only mode
      }
    } catch(error) {
      console.warn('[WRITE ACCESS] Failed to clear Firebase:', error);
      // Still allow release even if Firebase fails
    }
    
    // Mark as explicitly released and clear local writer state
    var previousWriter = _currentWriter;
    _explicitlyReleased = true;
    _currentWriter = null; // Update local state immediately
    console.log('[WRITE ACCESS] Write access explicitly released - no one has access now');
    
    // Notify about the change immediately (don't wait for Firebase)
    try {
      _onWriteAccessChange({
        writer: _currentWriter,
        hasAccess: hasWriteAccess(),
        previousWriter: previousWriter
      });
    } catch(e) {
      console.warn('[WRITE ACCESS] Failed to notify access change:', e);
    }
    
    return true;
  }
  
  console.log('[WRITE ACCESS] Cannot release - user does not have write access');
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
