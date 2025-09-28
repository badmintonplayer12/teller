import { toast } from '../dom.js';

let getShareUrl = function(){ return location.href; };
let qrReady = false;
let qrLoading = false;

export function initShare(options){
  options = options || {};
  if(typeof options.getShareUrl === 'function') getShareUrl = options.getShareUrl;

  var closeBtn = document.getElementById('shareClose');
  if(closeBtn) closeBtn.addEventListener('click', closeShare);

  var copyBtn = document.getElementById('btnCopy');
  if(copyBtn) copyBtn.addEventListener('click', copyLink);

  var openSpectator = document.getElementById('btnOpenSpectator');
  if(openSpectator) openSpectator.addEventListener('click', function(){
    window.open(getShareUrl(), '_blank');
  });

  var webShare = document.getElementById('btnWebShare');
  if(webShare){
    if(navigator.share){
      webShare.style.display = 'inline-block';
      webShare.addEventListener('click', function(){
        navigator.share({
          title: 'Tilskuervy',
          text: 'Badminton teller',
          url: getShareUrl()
        }).catch(function(){});
      });
    }else{
      webShare.style.display = 'none';
    }
  }
}

export function openShare(){
  var url = getShareUrl();
  var box = document.getElementById('qrBox');
  var urlEl = document.getElementById('shareUrl');
  if(urlEl) urlEl.textContent = url;
  if(box) box.innerHTML = '';

  ensureQrLib(function(err){
    if(!err && window.QRCode && box){
      new QRCode(box, {
        text: url,
        width: 280,
        height: 280,
        colorDark: '#ffffff',
        colorLight: '#0f172a',
        correctLevel: QRCode.CorrectLevel.Q
      });
    }else if(box){
      box.innerHTML = '<div style="color:#fbbf24;text-align:center">QR utilgjengelig ? bruk lenken under.</div>';
    }
    var mask = document.getElementById('shareMask');
    if(mask) mask.style.display = 'flex';
  });
}

export function closeShare(){
  var mask = document.getElementById('shareMask');
  if(mask) mask.style.display = 'none';
}

function ensureQrLib(cb){
  if(qrReady){
    cb(null);
    return;
  }
  if(qrLoading){
    var timer = setInterval(function(){
      if(qrReady){
        clearInterval(timer);
        cb(null);
      }
    }, 100);
    return;
  }
  qrLoading = true;
  loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', function(err){
    qrReady = !err && !!window.QRCode;
    qrLoading = false;
    cb(err);
  });
}

function loadScriptOnce(src, cb){
  if(document.querySelector('script[data-dyn="'+src+'"]')){
    cb(null);
    return;
  }
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.setAttribute('data-dyn', src);
  s.onload = function(){ cb(null); };
  s.onerror = function(){ cb(new Error('load-fail')); };
  document.head.appendChild(s);
}

function copyLink(){
  var url = getShareUrl();
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(url).then(function(){ toast('Lenke kopiert'); });
  }else{
    try{
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Lenke kopiert');
    }catch(_){
      toast('Kopier mislyktes');
    }
  }
}
