export function $(selector){
  return document.querySelector(selector);
}

export function toast(msg){
  var t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(function(){ t.style.display = 'none'; }, 1400);
}

export function qs(name){
  try{
    return new URL(location.href).searchParams.get(name);
  }catch(_){
    return null;
  }
}

export function setBodyScroll(lock){
  document.body.classList.toggle('no-scroll', !!lock);
}
