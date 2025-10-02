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
  var segments = document.querySelectorAll('.role-segment');
  
  segments.forEach(function(segment){
    segment.addEventListener('click', function(){
      var role = this.dataset.role;
      currentRole = role;
      
      // Update active state
      segments.forEach(function(s) {
        s.classList.remove('active');
      });
      this.classList.add('active');
      
      updateShareContent();
    });
    
    // Keyboard navigation
    segment.addEventListener('keydown', function(e){
      if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
        e.preventDefault();
        var currentIndex = Array.from(segments).indexOf(this);
        var nextIndex;
        
        if(e.key === 'ArrowLeft'){
          nextIndex = currentIndex > 0 ? currentIndex - 1 : segments.length - 1;
        } else {
          nextIndex = currentIndex < segments.length - 1 ? currentIndex + 1 : 0;
        }
        
        segments[nextIndex].click();
        segments[nextIndex].focus();
      }
    });
  });
  
  // Initialize active state based on current role
  segments.forEach(function(segment){
    segment.classList.remove('active');
    if(segment.dataset.role === currentRole){
      segment.classList.add('active');
    }
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
  var urlInput = document.getElementById('shareUrlInput');
  var openBtn = document.getElementById('btnOpenSpectator');
  
  // Update URL input field
  if(urlInput) {
    urlInput.value = url;
    urlInput.placeholder = url ? '' : 'Genererer lenke...';
  }
  
  // Button text updates removed - no longer needed
  
  // Localhost warning removed - no longer needed
  
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

// checkLocalhostWarning function removed - no longer needed

export function openShare(){
  // Reset to default role when opening
  currentRole = 'spectator';
  
  // Update segmented control
  var segments = document.querySelectorAll('.role-segment');
  segments.forEach(function(segment){
    segment.classList.remove('active');
    if(segment.dataset.role === currentRole){
      segment.classList.add('active');
    }
  });
  
  updateShareContent();
  
  var box = document.getElementById('qrBox');
  if(box) box.innerHTML = '';

  // Setup Web Share button
  setupWebShareButton();

  ensureQrLib(function(err){
    if(!err && window.QRCode){
      updateShareContent(); // This will generate QR code
      setupQrClickable(); // Make QR clickable for lightbox
    }else if(box){
      box.innerHTML = '<div style="color:#fbbf24;text-align:center">QR utilgjengelig ? bruk lenken under.</div>';
    }
    openModal('#shareMask', { closeOnBackdrop: true, closeOnEsc: true });
  });
}

function setupWebShareButton(){
  var webShareBtn = document.getElementById('btnWebShare');
  if(!webShareBtn) return;
  
  if(navigator.share){
    webShareBtn.style.display = 'block';
    webShareBtn.addEventListener('click', async function(){
      try {
        var url = getCurrentShareUrl();
        var title = currentRole === 'spectator' ? 'Tilskuervy' : 'Medteller';
        await navigator.share({
          title: title,
          text: 'Badminton teller',
          url: url
        });
      } catch(err) {
        if(err.name !== 'AbortError') {
          console.warn('Web Share failed:', err);
          // Fallback to copy
          copyLink();
          toast.info('Lenke kopiert – lim inn der du vil dele.');
        }
      }
    });
  } else {
    webShareBtn.style.display = 'none';
  }
}

export function closeShare(){
  closeModal('#shareMask');
}

// QR Lightbox functionality
function setupQrClickable(){
  var qrBox = document.getElementById('qrBox');
  if(!qrBox) return;
  
  // Make QR clickable
  qrBox.classList.add('is-clickable');
  qrBox.setAttribute('role', 'button');
  qrBox.setAttribute('tabindex', '0');
  qrBox.setAttribute('aria-label', 'Åpne QR i fullskjerm');
  
  qrBox.addEventListener('click', function(){
    var url = getCurrentShareUrl();
    openQrLightbox(url);
  });
  
  qrBox.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      var url = getCurrentShareUrl();
      openQrLightbox(url);
    }
  });
}

function openQrLightbox(url) {
  console.log('[QR LIGHTBOX] Opening lightbox for URL:', url);
  
  var overlay = document.createElement('div');
  overlay.className = 'qr-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;

  var wrap = document.createElement('div');
  wrap.className = 'qr-lightbox__wrap';
  
  var canvas = document.createElement('canvas');
  canvas.className = 'qr-lightbox__canvas';

  // Calculate optimal size for high DPI
  var sizeCss = Math.min(window.innerWidth, window.innerHeight) - 80; // padding
  sizeCss = Math.max(300, Math.min(sizeCss, 700)); // bounds
  var dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  
  canvas.width = sizeCss * dpr;
  canvas.height = sizeCss * dpr;
  canvas.style.width = sizeCss + 'px';
  canvas.style.height = sizeCss + 'px';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'qr-lightbox__close';
  closeBtn.setAttribute('aria-label', 'Lukk');
  closeBtn.textContent = '✕';

  // Actions section
  var actions = document.createElement('div');
  actions.className = 'qr-lightbox__actions';
  
  var dlBtn = document.createElement('button');
  dlBtn.className = 'qr-lightbox__btn';
  dlBtn.textContent = 'Last ned PNG';
  
  var shareBtn = document.createElement('button');
  shareBtn.className = 'qr-lightbox__btn';
  shareBtn.textContent = 'Del via...';
  
  actions.appendChild(dlBtn);
  actions.appendChild(shareBtn);
  
  wrap.appendChild(canvas);
  wrap.appendChild(actions);
  overlay.appendChild(wrap);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // Lock body scroll
  var prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  function close() {
    console.log('[QR LIGHTBOX] Closing lightbox');
    document.documentElement.style.overflow = prevOverflow || '';
    document.body.removeChild(overlay);
    // Return focus to QR element in modal
    var qrBox = document.getElementById('qrBox');
    if(qrBox) qrBox.focus();
  }

  // Event listeners
  overlay.addEventListener('click', function(e){
    if(e.target === overlay) close();
  });
  
  closeBtn.addEventListener('click', close);
  
  var keyHandler = function(e){
    if(e.key === 'Escape') {
      document.removeEventListener('keydown', keyHandler);
      close();
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Download PNG
  dlBtn.addEventListener('click', function(){
    try {
      var a = document.createElement('a');
      a.download = 'kamp-qr.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast.success('QR-kode lastet ned!');
    } catch(err) {
      console.warn('[QR LIGHTBOX] Download failed:', err);
      toast.error('Kunne ikke laste ned QR-kode');
    }
  });

  // Web Share
  shareBtn.addEventListener('click', function(){
    var urlToShare = url;
    if(navigator.share) {
      navigator.share({
        title: 'Del kamp',
        url: urlToShare
      }).catch(function(err){
        if(err.name !== 'AbortError') {
          console.warn('[QR LIGHTBOX] Share failed:', err);
          copyTextRobust(urlToShare, function(){
            toast.success('Lenke kopiert!');
          }, function(){
            toast.error('Kunne ikke kopiere lenken');
          });
        }
      });
    } else {
      copyTextRobust(urlToShare, function(){
        toast.success('Lenke kopiert!');
      }, function(){
        toast.error('Kunne ikke kopiere lenken');
      });
    }
  });

  // Generate QR after DOM is ready
  setTimeout(function(){
    generateQrToCanvas(canvas, url, dpr);
    overlay.focus();
  }, 0);
}

function generateQrToCanvas(canvas, url, dpr) {
  if(!window.QRCode) {
    console.warn('[QR LIGHTBOX] QRCode library not available');
    return;
  }
  
  try {
    // Create a temporary container for QRCode library
    var tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '280px';
    tempContainer.style.height = '280px';
    document.body.appendChild(tempContainer);
    
    // Generate QR code using the library
    var qr = new QRCode(tempContainer, {
      text: url,
      width: 280,
      height: 280,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    
    // Wait for QR to be generated, then copy to canvas
    var attempts = 0;
    var maxAttempts = 10;
    
    var checkForQR = function() {
      attempts++;
      var qrImg = tempContainer.querySelector('img');
      var qrCanvas = tempContainer.querySelector('canvas');
      
      if(qrImg || qrCanvas) {
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if(qrImg) {
          // Handle img element
          if(qrImg.complete) {
            ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
            document.body.removeChild(tempContainer);
            console.log('[QR LIGHTBOX] QR generated successfully from img');
          } else {
            qrImg.onload = function() {
              ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
              document.body.removeChild(tempContainer);
              console.log('[QR LIGHTBOX] QR generated successfully from img (onload)');
            };
            qrImg.onerror = function() {
              throw new Error('Failed to load QR image');
            };
          }
        } else if(qrCanvas) {
          // Handle canvas element
          ctx.drawImage(qrCanvas, 0, 0, canvas.width, canvas.height);
          document.body.removeChild(tempContainer);
          console.log('[QR LIGHTBOX] QR generated successfully from canvas');
        }
      } else if(attempts < maxAttempts) {
        // Try again after a short delay
        setTimeout(checkForQR, 50);
      } else {
        throw new Error('QR generation timeout');
      }
    };
    
    // Start checking for QR generation
    setTimeout(checkForQR, 100);
    
  } catch(err) {
    console.error('[QR LIGHTBOX] QR generation failed:', err);
    // Fallback: draw error message
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR-kode kunne ikke genereres', canvas.width/2, canvas.height/2);
    
    // Clean up temp container if it exists
    var tempContainer = document.querySelector('div[style*="-9999px"]');
    if(tempContainer) {
      document.body.removeChild(tempContainer);
    }
  }
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
  var copyBtn = document.getElementById('btnCopy');
  
  console.log('[COPY] Starting copy process for URL:', url);
  
  // Set busy state
  setCopyBusy(true);
  
  copyTextRobust(url, function(){
    console.log('[COPY] Copy successful');
    toast.success('Lenke kopiert!');
    setCopyBusy(false);
  }, function(err){
    console.warn('[COPY] Copy failed:', err);
    toast.error('Kunne ikke kopiere lenken');
    setCopyBusy(false);
  });
}

function setCopyBusy(isBusy) {
  var copyBtn = document.getElementById('btnCopy');
  if(!copyBtn) return;
  
  copyBtn.disabled = !!isBusy;
  // Keep original text - don't change button text
  // copyBtn.textContent = isBusy ? 'Kopierer...' : 'Kopier lenke';
}

// Robust copy function with fallback
function copyTextRobust(text, onSuccess, onError) {
  try {
    // Primær: moderne API (krever HTTPS eller localhost)
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onSuccess) onSuccess();
      }).catch(function (err) {
        // Fallback ved feil i moderne API
        legacyCopy(text, onSuccess, onError, err);
      });
    } else {
      // Fallback direkte
      legacyCopy(text, onSuccess, onError);
    }
  } catch (err) {
    legacyCopy(text, onSuccess, onError, err);
  }
}

function legacyCopy(text, onSuccess, onError, originalErr) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = document.execCommand('copy'); // deprec, men fungerer bredt
    document.body.removeChild(ta);
    if (ok) {
      if (onSuccess) onSuccess();
    } else {
      if (onError) onError(originalErr || new Error('execCommand copy returned false'));
    }
  } catch (err) {
    if (onError) onError(err);
  }
}
