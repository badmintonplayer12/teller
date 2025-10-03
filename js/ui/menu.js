import { renderStats } from './statsView.js';
import { loadMatches } from '../services/storage.js';

let kebab;
let panel;
let menuHandlers = {};
let spectatorMode = false;

function ensureElements(){
  if(!kebab) kebab = document.getElementById('kebab');
  if(!panel) panel = document.getElementById('menuPanel');
}

export function setupMenu(options){
  options = options || {};
  spectatorMode = !!options.isSpectator;
  ensureElements();
  if(!kebab || !panel) return;

  kebab.addEventListener('click', function(e){
    e.stopPropagation();
    togglePanel();
  });

  document.addEventListener('click', function(e){
    if(!panel.contains(e.target) && e.target !== kebab) closePanel();
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closePanel();
  });
}

export function renderMenu(mode, handlers){
  menuHandlers = handlers || {};
  
  // Add stats handler if not provided
  if (!menuHandlers.onStats) {
    menuHandlers.onStats = function(){
      try {
        const matches = loadMatches();
        renderStats(matches, function(mode) { 
          // Mode change callback - could update state.VIEW_MODE if needed
        }, null, null);
      } catch(e) {
        console && console.error && console.error('Stats open error', e);
      }
    };
  }
  
  ensureElements();
  if(!kebab || !panel) return;

  if(spectatorMode){
    kebab.style.display = 'none';
    panel.style.display = 'none';
    return;
  }

  kebab.style.display = 'block';

  // Check if we're in local-only mode
  const isLocal = !!window._badmintonLocalOnlyMode;

  var html = '';
  if(mode === 'match'){
    html += menuItem('miNewMatch', '🏠 Til start', menuHandlers.onNewMatch);
    
    // Only show sharing/tournament/control features when online
    if (!isLocal) {
      html += menuItem('miShare', '🔗 Del…', menuHandlers.onShare);
      html += menuItem('miOpenCounter', '📱 Åpne teller i ny fane', menuHandlers.onOpenCounter);
      html += menuItem('miTournamentOverview', '📋 Kampoversikt', menuHandlers.onTournamentOverview);
      html += menuItem('miOpenDashboard', '📺 Åpne kampoversikt i ny fane', menuHandlers.onOpenDashboard);
      html += '<div class="menuHR"></div>';
      html += menuItem('miClaimWrite', '✋ Ta kontroll', menuHandlers.onClaimWrite);
      html += menuItem('miReleaseWrite', '🤝 Frigi kontroll', menuHandlers.onReleaseWrite);
      html += '<div class="menuHR"></div>';
    }
    
    html += menuItem('miFinishMatch', '✅ Ferdigstill kamp', menuHandlers.onFinishMatch);
    html += menuItem('miResetSet', '♻️ Nullstill sett', menuHandlers.onResetSet);
    html += menuItem('miSwap', '⇄ Bytt side', menuHandlers.onSwap);
    html += '<div class="menuHR"></div>';
    html += menuItem('miEditNames', '✏️ Rediger spillernavn', menuHandlers.onEditNames);
    html += menuItem('miClearStorage', '🗑️ Nullstill lagret data', menuHandlers.onClear);
    html += menuItem('miFullscreen', '⛶ Fullskjerm', menuHandlers.onFullscreen);
    html += menuItem('miStats', '📊 Vis statistikk', menuHandlers.onStats);
  }else if(mode === 'stats'){
    html += menuItem('miBackToMatch', '↩︎ Vis kamp', menuHandlers.onBackToMatch);
    html += '<div class="menuHR"></div>';
    html += menuItem('miFullscreen', '⛶ Fullskjerm', menuHandlers.onFullscreen);
    html += menuItem('miClearStorage', '🗑️ Nullstill lagret data', menuHandlers.onClear);
  }

  panel.innerHTML = html;
  bindMenuItems();
}

function menuItem(id, label, handler){
  if(typeof handler !== 'function'){
    return '';
  }
  return '<div class="menuItem" id="'+id+'" role="menuitem">'+label+'</div>';
}

function bindMenuItems(){
  Object.keys(menuHandlers || {}).forEach(function(key){
    var id = handlerIdFor(key);
    if(!id) return;
    var el = document.getElementById(id);
    if(el && typeof menuHandlers[key] === 'function'){
      el.addEventListener('click', function(){
        closePanel();
        menuHandlers[key]();
      });
    }
  });
}

function handlerIdFor(key){
  switch(key){
    case 'onShare': return 'miShare';
    case 'onNewMatch': return 'miNewMatch';
    case 'onResetSet': return 'miResetSet';
    case 'onSwap': return 'miSwap';
    case 'onEditNames': return 'miEditNames';
    case 'onClear': return 'miClearStorage';
    case 'onFullscreen': return 'miFullscreen';
    case 'onStats': return 'miStats';
    case 'onTournamentOverview': return 'miTournamentOverview';
    case 'onFinishMatch': return 'miFinishMatch';
    case 'onBackToMatch': return 'miBackToMatch';
    case 'onOpenDashboard': return 'miOpenDashboard';
    case 'onOpenCounter': return 'miOpenCounter';
    case 'onClaimWrite': return 'miClaimWrite';
    case 'onReleaseWrite': return 'miReleaseWrite';
    default: return null;
  }
}

function togglePanel(){
  ensureElements();
  if(!panel) return;
  panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

export function closePanel(){
  ensureElements();
  if(panel) panel.style.display = 'none';
}



