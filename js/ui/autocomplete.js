// Felles autocomplete-helper
import { getPrevNames, pushPrev } from '../services/storage.js';

export function defaultFilter(val){
  const v = (val || '').toLowerCase();
  return function(name){
    return !name.includes(' / ') && name.toLowerCase().includes(v);
  };
}

export function attachAutocomplete(input, { listEl, getCandidates = () => getPrevNames(), onSelect }){
  let current = -1;
  function close(){ if(listEl) listEl.style.display = 'none'; current = -1; }
  function open(){ if(listEl) listEl.style.display = 'block'; }

  input.addEventListener('input', () => {
    if(!listEl) return;
    const val = input.value;
    const src = getCandidates().filter(defaultFilter(val));
    listEl.innerHTML = '';
    if(!val || !src.length){ close(); return; }
    open();
    src.forEach(name => {
      const div = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = name.substr(0, val.length);
      div.appendChild(strong);
      div.appendChild(document.createTextNode(name.substr(val.length)));
      const hidden = document.createElement('input');
      hidden.type = 'hidden'; hidden.value = name;
      div.appendChild(hidden);
      div.addEventListener('click', () => {
        const chosen = hidden.value;
        input.value = chosen;
        pushPrev(chosen);
        close();
        onSelect && onSelect(chosen);
      });
      listEl.appendChild(div);
    });
  });

  input.addEventListener('keydown', (e) => {
    if(!listEl || listEl.style.display !== 'block') return;
    const items = Array.from(listEl.children);
    if(!items.length) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); current = (current+1) % items.length; setActive(items); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); current = (current-1+items.length) % items.length; setActive(items); }
    else if(e.key === 'Enter'){ e.preventDefault(); if(current>-1) items[current].click(); }
    else if(e.key === 'Escape'){ close(); }
  });

  document.addEventListener('click', (e) => {
    // Ikke lukk hvis klikket er på dropdown-knappen eller inne i samme wrapper
    const isOnDropdownBtn = !!e.target.closest('.dropdown-btn');
    const wrapper = input.closest('.autocomplete') || input.parentElement;
    const isInsideWrapper = wrapper ? wrapper.contains(e.target) : false;
    if (e.target !== input && !listEl.contains(e.target) && !isOnDropdownBtn && !isInsideWrapper) {
      close();
    }
  });

  function setActive(items){
    items.forEach(x => x.classList.remove('autocomplete-active'));
    if(current>-1 && items[current]) items[current].classList.add('autocomplete-active');
  }
}

export function toggleDropdownFor(input, listEl, getRecent = () => getPrevNames()){
  const recent = getRecent().filter(n => !n.includes(' / ')).slice(0,8);
  listEl.innerHTML = '';
  if(!recent.length){ listEl.style.display = 'none'; return; }
  listEl.style.display = (listEl.style.display === 'block') ? 'none' : 'block';
  if(listEl.style.display !== 'block') return;
  recent.forEach(name => {
    const div = document.createElement('div');
    div.textContent = name;
    div.addEventListener('click', () => {
      input.value = name;
      pushPrev(name);
      listEl.style.display = 'none';
      input.dispatchEvent(new Event('input')); // oppdater chips mm.
    });
    listEl.appendChild(div);
  });
}

// NY: felles helper for å vise/skjule ▼-knapper basert på tilgjengelige kandidater
export function updateDropdownButtons(root){
  const scope = (typeof root === 'string')
    ? document.querySelector(root)
    : (root && root.querySelectorAll ? root : document);
  if(!scope) return;
  const available = getPrevNames().filter(n => !n.includes(' / '));
  const has = available.length > 0;
  const buttons = scope.querySelectorAll('.dropdown-btn');
  buttons.forEach(btn => {
    const input = btn?.parentElement?.querySelector('input');
    if(!input) return;
    if(has){
      btn.classList.remove('hidden');
      input.classList.remove('no-dropdown');
    }else{
      btn.classList.add('hidden');
      input.classList.add('no-dropdown');
    }
  });
}
