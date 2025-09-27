import { state } from '../state/matchState.js';
import { $ } from './dom.js';

var kebab=$('#kebab'), panel=$('#menuPanel');

function menuItem(id,label){return '<div class="menuItem" id="'+id+'" role="menuitem">'+label+'</div>'}

export function renderMenu(viewMode, handlers){
  var VM = viewMode || state.VIEW_MODE || 'match';
  console.log('renderMenu: KALLT - VM er:', VM, 'state.VIEW_MODE er:', state.VIEW_MODE);
  
  if(state.IS_SPECTATOR){
    kebab.style.display='none';
    panel.style.display='none';
    return;
  }
  
var html='';
if(VM==='match'){
  console.log('renderMenu: Lager kamp-modus meny');
html+=menuItem('miShare','🔗 Del…');
html+=menuItem('miNewMatch','🆕 Start ny kamp');
html+=menuItem('miResetSet','♻️ Nullstill sett');
html+=menuItem('miSwap','⇄ Bytt side');
html+='<div class="menuHR"></div>';
html+=menuItem('miEditNames','✏️ Rediger spillernavn');
html+=menuItem('miClearStorage','🗑️ Nullstill lagret data');
html+=menuItem('miFullscreen','⛶ Fullskjerm');
html+=menuItem('miStats','📊 Vis statistikk');
} else if(VM==='stats'){
  console.log('renderMenu: Lager statistikk-modus meny');
html+=menuItem('miBackToMatch','↩︎ Vis kamp');
html+='<div class="menuHR"></div>';
html+=menuItem('miFullscreen','⛶ Fullskjerm');
html+=menuItem('miClearStorage','🗑️ Nullstill lagret data');
} else {
  console.log('renderMenu: Ukjent VM:', VM);
}
  
panel.innerHTML=html;
  
  var bind=function(id,fn){
    var e=document.getElementById(id);
    if(e) e.onclick=function(){
      panel.style.display='none';
      fn();
    };
  };
  
bind('miShare',handlers.onShare);
bind('miNewMatch',handlers.onNewMatch);
bind('miResetSet',handlers.onResetSet);
bind('miSwap',handlers.onSwap);
bind('miEditNames',handlers.onEditNames);
bind('miClearStorage',handlers.onClear);
bind('miFullscreen',handlers.onFullscreen);
bind('miStats',handlers.onStats);
bind('miBackToMatch',handlers.onBackToMatch);
}

export function togglePanel(){panel.style.display=(panel.style.display==='block')?'none':'block'}
export function closePanel(){panel.style.display='none'}

export function bindMenuEvents(handlers){
  kebab.addEventListener('click',function(e){e.stopPropagation();togglePanel()});
  document.addEventListener('click',function(e){if(!panel.contains(e.target)&&e.target!==kebab)closePanel()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closePanel();handlers.onCloseShare?.()}});
}

