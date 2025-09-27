import { $ } from './dom.js';
import { toast } from './dom.js';

export function loadScriptOnce(src,cb){if(document.querySelector('script[data-dyn="'+src+'"]')){cb();return}var s=document.createElement('script');s.src=src;s.async=true;s.setAttribute('data-dyn',src);s.onload=function(){cb()};s.onerror=function(){cb(new Error('load-fail'))};document.head.appendChild(s)}

export function ensureQrLib(cb){if(window.QRCode){cb(null);return}loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',function(err){if(!err&&window.QRCode)cb(null);else cb(new Error('no-lib'))})}

export function openShare(spectatorShareUrl){var url=spectatorShareUrl();var box=document.getElementById('qrBox');document.getElementById('shareUrl').textContent=url;box.innerHTML='';ensureQrLib(function(err){if(!err&&window.QRCode){new QRCode(box,{text:url,width:280,height:280,colorDark:'#ffffff',colorLight:'#0f172a',correctLevel:QRCode.CorrectLevel.Q})}else{box.innerHTML='<div style="color:#fbbf24;text-align:center">QR utilgjengelig – bruk lenken under.</div>'}document.getElementById('shareMask').style.display='flex';var wsb=document.getElementById('btnWebShare');wsb.style.display=(navigator.share?'inline-block':'none')})}

export function closeShare(){document.getElementById('shareMask').style.display='none'}

export function bindShareEvents(){
  (function(){var b=document.getElementById('shareClose');if(b)b.addEventListener('click',closeShare)})();
  (function(){var c=document.getElementById('btnCopy');if(c)c.addEventListener('click',function(){var url=document.getElementById('shareUrl').textContent;if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(url).then(function(){toast('Lenke kopiert')})}else{try{var ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.top='-1000px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Lenke kopiert')}catch(e){toast('Kopier mislyktes')}}})})();
  (function(){var o=document.getElementById('btnOpenSpectator');if(o)o.addEventListener('click',function(){var url=document.getElementById('shareUrl').textContent;window.open(url,'_blank')})})();
  (function(){var w=document.getElementById('btnWebShare');if(w)w.addEventListener('click',function(){var url=document.getElementById('shareUrl').textContent;if(navigator.share)navigator.share({title:'Tilskuervy',text:'Badminton teller',url:url}).catch(function(){})})})();
}

