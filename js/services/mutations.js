import { rtdb, nowTs, getLastWrite, setLastWrite } from './firebase.js';

/**
 * Centralized mutation helpers for RTDB writes
 * All writes should go through these functions to avoid echo-loops and enable future role-gating
 */

/**
 * Safe push to RTDB with echo-guard and metadata
 * @param {string} refPath - Firebase reference path
 * @param {Object} payload - Data to write
 * @returns {Promise} Firebase write promise
 */
export function safePush(refPath, payload) {
  if (!refPath || !payload) {
    return Promise.reject(new Error('safePush: refPath and payload required'));
  }
  
  var db = rtdb();
  if (!db) {
    return Promise.reject(new Error('safePush: Firebase not available'));
  }
  
  var ref = db.ref(refPath);
  var ts = nowTs();
  
  // Calculate hash for echo-guard
  var hash = calculateHash(JSON.stringify(payload) + refPath);
  
  // Add metadata
  var dataWithMeta = Object.assign({}, payload, {
    _ts: ts,
    _hash: hash
  });
  
  // Store lastWrite for echo-guard
  setLastWrite({
    path: refPath,
    ts: ts,
    hash: hash
  });
  
  return ref.set(dataWithMeta);
}

/**
 * Set a specific field in RTDB
 * @param {string} refPath - Firebase reference path
 * @param {string} field - Field name to set
 * @param {*} value - Value to set
 * @returns {Promise} Firebase write promise
 */
export function setField(refPath, field, value) {
  if (!refPath || !field) {
    return Promise.reject(new Error('setField: refPath and field required'));
  }
  
  var db = rtdb();
  if (!db) {
    return Promise.reject(new Error('setField: Firebase not available'));
  }
  
  var ref = db.ref(refPath + '/' + field);
  var ts = nowTs();
  
  // Calculate hash for echo-guard
  var hash = calculateHash(JSON.stringify(value) + refPath + '/' + field);
  
  // Add metadata
  var dataWithMeta = {
    _ts: ts,
    _hash: hash,
    value: value
  };
  
  // Store lastWrite for echo-guard
  setLastWrite({
    path: refPath + '/' + field,
    ts: ts,
    hash: hash
  });
  
  return ref.set(dataWithMeta);
}

/**
 * Append an event to a list in RTDB
 * @param {string} refPath - Firebase reference path
 * @param {Object} event - Event data to append
 * @returns {Promise} Firebase write promise
 */
export function appendEvent(refPath, event) {
  if (!refPath || !event) {
    return Promise.reject(new Error('appendEvent: refPath and event required'));
  }
  
  var db = rtdb();
  if (!db) {
    return Promise.reject(new Error('appendEvent: Firebase not available'));
  }
  
  var ref = db.ref(refPath);
  var ts = nowTs();
  
  // Add metadata to event
  var eventWithMeta = Object.assign({}, event, {
    _ts: ts,
    _hash: calculateHash(JSON.stringify(event) + refPath + '/append')
  });
  
  // Store lastWrite for echo-guard
  setLastWrite({
    path: refPath + '/append',
    ts: ts,
    hash: eventWithMeta._hash
  });
  
  return ref.push(eventWithMeta);
}

/**
 * Calculate simple hash for echo-guard
 * @param {string} input - String to hash
 * @returns {string} Simple hash
 */
function calculateHash(input) {
  var hash = 0;
  if (input.length === 0) return hash.toString();
  
  for (var i = 0; i < input.length; i++) {
    var char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Check if a snapshot is an echo of our last write
 * @param {Object} snapshot - Firebase snapshot
 * @returns {boolean} True if this is an echo
 */
export function isEcho(snapshot) {
  var lastWrite = getLastWrite();
  if (!snapshot || !lastWrite) {
    return false;
  }
  
  var data = snapshot.val();
  if (!data || !data._ts || !data._hash) {
    return false;
  }
  
  // Check if this matches our last write
  return data._ts === lastWrite.ts && 
         data._hash === lastWrite.hash;
}
