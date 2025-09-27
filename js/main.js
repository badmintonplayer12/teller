import { state } from './state/matchState.js';
import { loadLastNames } from './services/storage.js';
import { showNameModal, updateNameChips, writeModalInputsFromAB, updateEditableState } from './ui/namesModal.js';
import { mount as mountMatch, getMenuHandlers } from './ui/matchView.js';
import { setupFirebase } from './services/firebase.js';
import { $ } from './ui/dom.js';
import { renderMenu, bindMenuEvents } from './ui/menu.js';
import { bindShareEvents } from './ui/share.js';
import { LS } from './constants.js';
import { restoreLiveState } from './state/matchState.js';

function boot() {
  // Start alltid i match-view (foreløpig)
  mountMatch();

  // Set up menu
  const menuHandlers = getMenuHandlers();
  bindMenuEvents(menuHandlers);
  
  // Set up share events
  bindShareEvents();

  // Try to restore live state first
  const restored = restoreLiveState(writeModalInputsFromAB, updateNameChips, async (isALeft) => {
    const { setSidesDomTo } = await import('./ui/layout.js');
    setSidesDomTo(isALeft);
  });
  
  if (!state.IS_SPECTATOR) {
    if (!restored) {
      // First time setup - load last names and show modal
      const last = loadLastNames();
      $('#nameA').value = (last && last[0]) || 'Spiller A';
      $('#nameB').value = (last && last[1]) || 'Spiller B';
      showNameModal(true);
      updateNameChips();
    } else if (!state.allowScoring) {
      // Restored but not ready to score - show modal
      showNameModal(true);
    }
  }
  
  updateEditableState();
  setupFirebase();

  // Set up kebab menu hint for first-time users
  try {
    if (!localStorage.getItem(LS.KB_TIP)) {
      const kebab = $('#kebab');
      if (kebab) {
        kebab.classList.add('pulse');
        setTimeout(function() {
          kebab.classList.remove('pulse');
          localStorage.setItem(LS.KB_TIP, '1');
        }, 2600);
      }
    }
  } catch (e) {}

  // Initial menu render
  renderMenu('match', menuHandlers);
}

document.addEventListener('DOMContentLoaded', boot);
