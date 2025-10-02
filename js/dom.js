export function $(selector){
  return document.querySelector(selector);
}

export function toast(msg, type){
  var t = document.getElementById('toast');
  if(!t) {
    console.warn('[TOAST] Toast element not found');
    return;
  }
  
  console.log('[TOAST] Showing toast:', msg, 'type:', type);
  t.textContent = msg;
  t.style.display = 'block';
  
  // Add type-specific styling - matching site design
  if(type === 'success') {
    t.style.background = 'rgba(30,64,175,.95)';
    t.style.borderColor = 'rgba(96,165,250,.9)';
    t.style.color = '#dbeafe';
    t.style.boxShadow = '0 10px 30px rgba(37,99,235,.45), 0 0 25px rgba(96,165,250,.55)';
  } else if(type === 'error') {
    t.style.background = 'rgba(127,29,29,.95)';
    t.style.borderColor = 'rgba(239,68,68,.9)';
    t.style.color = '#fecaca';
    t.style.boxShadow = '0 10px 30px rgba(220,38,38,.45), 0 0 25px rgba(239,68,68,.55)';
  } else {
    // Default styling
    t.style.background = '#111827';
    t.style.borderColor = '#233454';
    t.style.color = '#e5e7eb';
    t.style.boxShadow = 'none';
  }
  
  setTimeout(function(){ 
    console.log('[TOAST] Hiding toast after timeout');
    t.style.display = 'none';
    // Reset to default styling after hide
    t.style.background = '#111827';
    t.style.borderColor = '#233454';
    t.style.color = '#e5e7eb';
    t.style.boxShadow = 'none';
  }, 1400);
}

// Convenience methods
toast.success = function(msg) { toast(msg, 'success'); };
toast.error = function(msg) { toast(msg, 'error'); };

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
