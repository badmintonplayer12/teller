// js/ui/modal.js
import { setBodyScroll } from '../dom.js';

// Finn fokusbare elementer inne i en modal
function focusables(root) {
  return Array.from(root.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null || el.getClientRects().length);
}

function resolve(elOrId){
  if(!elOrId) return null;
  return (typeof elOrId === 'string') ? document.querySelector(elOrId) : elOrId;
}

export function openModal(id, opts){
  const mask = resolve(id);
  if(!mask) return;
  const display = (opts && opts.display) || 'flex';
  const trap = (opts && opts.trap) !== false; // default true
  const focusSel = opts && opts.focus;

  // Vis
  mask.style.display = display;
  mask.setAttribute('aria-hidden', 'false');
  setBodyScroll(false);

  // Lagre forrige fokus
  mask.__prevFocus = document.activeElement || null;

  // Sett startfokus
  let first = null;
  if(focusSel) first = mask.querySelector(focusSel);
  if(!first){
    const list = focusables(mask);
    first = list[0] || mask;
  }
  try { first.focus(); } catch(_) {}

  if(trap){
    // Enkel fokusfelle
    const onKey = (e) => {
      if(e.key !== 'Tab') return;
      const items = focusables(mask);
      if(items.length === 0) return;
      const firstEl = items[0];
      const lastEl  = items[items.length - 1];
      if(e.shiftKey && document.activeElement === firstEl){
        e.preventDefault(); lastEl.focus();
      }else if(!e.shiftKey && document.activeElement === lastEl){
        e.preventDefault(); firstEl.focus();
      }
    };
    mask.__trapHandler = onKey;
    mask.addEventListener('keydown', onKey);
  }
}

export function closeModal(id){
  const mask = resolve(id);
  if(!mask) return;
  // Skru av fokusfelle
  if(mask.__trapHandler){
    mask.removeEventListener('keydown', mask.__trapHandler);
    delete mask.__trapHandler;
  }
  // Skjul
  mask.style.display = 'none';
  mask.setAttribute('aria-hidden', 'true');
  setBodyScroll(true);
  // Gjenopprett fokus
  try { mask.__prevFocus && mask.__prevFocus.focus(); } catch(_) {}
  delete mask.__prevFocus;
}
