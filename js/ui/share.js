import { toast } from '../dom.js';
import { openModal, closeModal } from './modal.js';
import { loadScriptOnce } from '../util/loadScript.js';

let getShareUrl = function(){ return location.href; };
let qrReady = false;
let qrLoading = false;
let currentRole = 'spectator'; // Default role

export function initShare(options){
  options = options || {};
  if(typeof options.getShareUrl === 'function') getShareUrl = options.getShareUrl;

  var closeBtn = document.getElementById('shareClose');
  if(closeBtn) closeBtn.addEventListener('click', closeShare);

  var copyBtn = document.getElementById('btnCopy');
  if(copyBtn) copyBtn.addEventListener('click', copyLink);

  var openSpectator = document.getElementById('btnOpenSpectator');
  if(openSpectator) openSpectator.addEventListener('click', function(){
    window.open(getCurrentShareUrl(), '_blank');
  });

  var webShare = document.getElementById('btnWebShare');
  if(webShare){
    if(navigator.share){
      webShare.style.display = 'inline-block';
      webShare.addEventListener('click', function(){
        var title = currentRole === 'spectator' ? 'Tilskuervy' : 
                     currentRole === 'cocounter' ? 'Medteller' : 'Teller';
        navigator.share({
          title: title,
          text: 'Badminton teller',
          url: getCurrentShareUrl()
        }).catch(function(){});
      });
    }else{
      webShare.style.display = 'none';
    }
  }

  // Setup role toggle listeners
  setupRoleToggle();
}

function setupRoleToggle(){
  var roleInputs = document.querySelectorAll('input[name="shareRole"]');
  roleInputs.forEach(function(input){
    input.addEventListener('change', function(){
      if(this.checked){
        currentRole = this.value;
        updateShareContent();
      }
    });
  });
}

function getCurrentShareUrl(){
  var baseUrl = getShareUrl();
  var url = new URL(baseUrl);
  
  // Set mode parameter based on current role
  url.searchParams.set('mode', currentRole);
  
  return url.toString();
}

function updateShareContent(){
  var url = getCurrentShareUrl();
  var urlEl = document.getElementById('shareUrl');
  var openBtn = document.getElementById('btnOpenSpectator');
  
  if(urlEl) urlEl.textContent = url;
  
  // Update button text based on role
  if(openBtn) {
    var btnText = currentRole === 'spectator' ? 'Åpne tilskuer' : 
                  currentRole === 'cocounter' ? 'Åpne medteller' : 'Åpne teller';
    openBtn.textContent = btnText;
  }
  
  // Regenerate QR code with new URL
  var box = document.getElementById('qrBox');
  if(box) {
    box.innerHTML = '';
    if(window.QRCode){
      new QRCode(box, {
        text: url,
        width: 280,
        height: 280,
        colorDark: '#ffffff',
        colorLight: '#0f172a',
        correctLevel: QRCode.CorrectLevel.Q
      });
    }
  }
}

export function openShare(){
  // Reset to default role when opening
  currentRole = 'spectator';
  var spectatorRadio = document.querySelector('input[name="shareRole"][value="spectator"]');
  if(spectatorRadio) spectatorRadio.checked = true;
  
  updateShareContent();
  
  var box = document.getElementById('qrBox');
  if(box) box.innerHTML = '';

  ensureQrLib(function(err){
    if(!err && window.QRCode){
      updateShareContent(); // This will generate QR code
    }else if(box){
      box.innerHTML = '<div style="color:#fbbf24;text-align:center">QR utilgjengelig ? bruk lenken under.</div>';
    }
    openModal('#shareMask', { closeOnBackdrop: true, closeOnEsc: true });
  });
}

export function closeShare(){
  closeModal('#shareMask');
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
  loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js')
    .then(function(){
      qrReady = !!window.QRCode;
      qrLoading = false;
      cb(null);
    })
    .catch(function(err){
      qrReady = false;
      qrLoading = false;
      cb(err);
    });
}

// loadScriptOnce moved to js/util/loadScript.js

function copyLink(){
  var url = getCurrentShareUrl();
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(url).then(function(){ 
      var toastMsg = currentRole === 'spectator' ? 'Tilskuer-lenke kopiert' : 
                     currentRole === 'cocounter' ? 'Medteller-lenke kopiert' : 'Teller-lenke kopiert';
      toast(toastMsg); 
    });
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
      var toastMsg = currentRole === 'spectator' ? 'Tilskuer-lenke kopiert' : 
                     currentRole === 'cocounter' ? 'Medteller-lenke kopiert' : 'Teller-lenke kopiert';
      toast(toastMsg);
    }catch(_){
      toast('Kopier mislyktes');
    }
  }
}
