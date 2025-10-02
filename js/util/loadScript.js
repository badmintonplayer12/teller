// js/util/loadScript.js
// Felles utility for dynamisk skriptlasting

export function loadScript(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('load '+src)); };
    document.head.appendChild(s);
  });
}

export function loadScriptOnce(src){
  return new Promise(function(resolve, reject){
    if(document.querySelector('script[data-dyn="'+src+'"]')){
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute('data-dyn', src);
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('load-fail')); };
    document.head.appendChild(s);
  });
}

