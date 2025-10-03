/**
 * Local mode badge management for BadmintonTeller
 */

export function renderBadge() {
  const badge = document.getElementById('localModeBadge');
  
  if (badge) {
    if (window._badmintonLocalOnlyMode) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

/**
 * Initialize badge management
 */
export function initHeader() {
  // Watch for changes to window._badmintonLocalOnlyMode
  if (window._badmintonLocalOnlyMode !== undefined) {
    Object.defineProperty(window, '_badmintonLocalOnlyMode', {
      get() { return this._localMode; },
      set(value) { 
        this._localMode = value; 
        renderBadge();
      }
    });
  }
  
  // Initial render
  renderBadge();
}
