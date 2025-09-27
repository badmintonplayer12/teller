export function $(s){ return document.querySelector(s); }
export function toast(msg){
  const t = $('#toast'); if(!t) return;
  t.textContent = msg; t.style.display='block';
  setTimeout(()=>{ t.style.display='none'; }, 1400);
}
export function setBodyScroll(on){ document.body.classList.toggle('no-scroll', !!on); }

