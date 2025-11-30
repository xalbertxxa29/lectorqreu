// ====== MAPA DE REFERENCIAS (QR → Punto de Marcación) ======
const REFERENCIA_MAP = {
  "1761055082506": "Main Entrance",
  "1761055097257": "Everglades Conf.Rm",
  "1761055105341": "Alligator Alley",
  "1761055598535": "N.W. Entrance (Lab)",
  "1761055619574": "Warehouse Offices (S.W.)",
  "1761055731912": "Loading Dock",
  "1761055748808": "Penthouse Stairwell",
  "1761055758075": "Circulation Area",
  "1761055765742": "Women's Lockers (S.E.)",
  "1761056924033": "Men's Lockers (S. E.)",
  "1761056935227": "Conf. Rm.1062 (S.E.)",
  "1761056952702": "Break Room",
  "1761056960727": "Document Control Rm",
  "1761056968594": "The Beach Lobby (N.E)",
  "1761056974553": "Executive Offices (N.E.)",
  "1761058333445": "Hallway 121",
  "1761058340305": "Hallway 122",
  "1761058346339": "Hallway 123",
  "1761058353137": "Hallway 124",
  "1761058359372": "Hallway 125",
  "1761058367017": "Hallway 126",
  "1761058388859": "Hallway 127",
  "1761058395655": "Hallway 128",
  "1761058402461": "Hallway 129",
  "1761058423101": "Hallway 130",
  "1761058429185": "Hallway 132",
  "1761058447734": "Hallway 133",
  "1761058454312": "Hallway 134",
  "1761058460400": "Hallway 135",
  "1760037324942": "MARCACION QR"
};

// ============================
//  Firebase (compat) — inicialización segura con reintentos
// ============================
let db = null;
let storage = null;
let firebaseReady = false;

function initializeFirebase() {
  try {
    const fb = window.firebase;
    if (!fb) {
      return false;
    }
    
    if (fb.apps.length === 0) {
      if (!window.firebaseConfig || !window.firebaseConfig.projectId) {
        console.warn('⚠️  Falta window.firebaseConfig - Funcionará en modo offline');
        return false;
      }
      fb.initializeApp(window.firebaseConfig);
      console.log('✓ Firebase inicializado:', window.firebaseConfig.projectId);
    }
    
    db = fb.firestore?.();
    storage = fb.storage?.();
    
    if (db) {
      db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        console.warn('⚠️  Persistencia offline no disponible:', err.code);
      });
      firebaseReady = true;
      console.log('✓ Firestore disponible');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error inicializando Firebase:', err.message);
    return false;
  }
}

// Intentar inicializar Firebase cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  setTimeout(initializeFirebase, 100);
}

// Reintentar cada 1 segundo si no está listo (máximo 10 intentos)
let fbAttempts = 0;
const fbInitInterval = setInterval(() => {
  if (firebaseReady || fbAttempts >= 10) {
    clearInterval(fbInitInterval);
    if (firebaseReady) {
      console.log('✓ Firebase listo. Sistema preparado.');
    }
  } else if (!initializeFirebase()) {
    fbAttempts++;
  }
}, 1000);

// ===== Colección destino en Firestore =====
const FIRE_COLLECTION = 'IncidenciasEU';

// =============================
// ELEMENTOS DE UI
// =============================
const scannerContainer = document.getElementById('scanner-container');
const optionsContainer = document.getElementById('options-container');
const formSinNovedadContainer = document.getElementById('form-sin-novedad-container');
const formConNovedadContainer = document.getElementById('form-con-novedad-container');

const video = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvas = canvasElement.getContext('2d', { willReadFrequently: true });

const scannedPointName = document.getElementById('scanned-point-name');
const btnSinNovedad = document.getElementById('btn-sin-novedad');
const btnConNovedad = document.getElementById('btn-con-novedad');
const btnCancelScan = document.getElementById('btn-cancel-scan');

const formSinNovedad = document.getElementById('form-sin-novedad');
const formConNovedad = document.getElementById('form-con-novedad');

// Geolocation
let currentLocation = null;
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        currentLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      },
      err => { currentLocation = null; },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }
}

const statusToast = document.getElementById('status-toast');
const pointNameSin = document.getElementById('point-name-sin-novedad');
const pointNameCon = document.getElementById('point-name-con-novedad');

const savingOverlay = document.getElementById('saving-overlay');
const savingMsg = document.getElementById('saving-msg');

// Evidencia
const evidenceInput = document.getElementById('evidence-input'); // cámara (con capture)
const evidencePreview = document.getElementById('evidence-preview');
const evidenceWrap = document.getElementById('evidence-preview-wrap');
const evidenceBtn = document.getElementById('btn-evidencia');
const evidenceRemove = document.getElementById('evidence-remove');

// Cámara para evidencia
let evidenceStream = null;
const evidenceVideo = document.createElement('video');
evidenceVideo.setAttribute('playsinline', '');
evidenceVideo.style.width = '100%';
evidenceVideo.style.maxHeight = '320px';
evidenceVideo.style.borderRadius = '10px';
evidenceVideo.style.marginBottom = '10px';
let evidenceCanvas = null;
let evidenceCaptureBtn = null;

function openEvidenceCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then(stream => {
      evidenceStream = stream;
      evidenceVideo.srcObject = stream;
      evidenceVideo.play();
      showEvidenceCameraUI();
    })
    .catch(() => {
      showToast('Could not access camera.', 'error');
    });
}

function showEvidenceCameraUI() {
  // Crear canvas y botón si no existen
  if (!evidenceCanvas) {
    evidenceCanvas = document.createElement('canvas');
    evidenceCanvas.style.display = 'none';
    evidenceCanvas.style.marginBottom = '10px';
  }
  if (!evidenceCaptureBtn) {
    evidenceCaptureBtn = document.createElement('button');
    evidenceCaptureBtn.textContent = 'Capture Photo';
    evidenceCaptureBtn.className = 'btn btn-primary';
    evidenceCaptureBtn.style.marginBottom = '10px';
    evidenceCaptureBtn.onclick = captureEvidencePhoto;
  }
  // Mostrar en el modal de evidencia
  evidenceWrap.innerHTML = '';
  evidenceWrap.appendChild(evidenceVideo);
  evidenceWrap.appendChild(evidenceCanvas);
  evidenceWrap.appendChild(evidenceCaptureBtn);
  evidenceWrap.style.display = 'flex';
}

function captureEvidencePhoto() {
  const w = evidenceVideo.videoWidth || 1280;
  const h = evidenceVideo.videoHeight || 720;
  evidenceCanvas.width = w;
  evidenceCanvas.height = h;
  evidenceCanvas.getContext('2d').drawImage(evidenceVideo, 0, 0, w, h);
  const dataUrl = evidenceCanvas.toDataURL('image/jpeg', 0.85);
  evidencePreview.src = dataUrl;
  evidenceDataUrl = dataUrl;
  evidenceWrap.innerHTML = '';
  evidenceWrap.appendChild(evidencePreview);
  evidenceWrap.appendChild(evidenceRemove);
  evidenceWrap.style.display = 'flex';
  if (evidenceStream) {
    evidenceStream.getTracks().forEach(t => t.stop());
    evidenceStream = null;
  }
}

// === Sheet evidencia (Cámara / Galería) ===
const sheetEvid = document.getElementById('sheet-evidencia');
const optCam = document.getElementById('opt-cam');
const optGal = document.getElementById('opt-gal');
const optCancelar = document.getElementById('opt-cancelar');
const evidenceInputGallery = document.getElementById('evidence-input-gallery');

function openSheet()  { sheetEvid?.classList.remove('hidden'); }
function closeSheet() { sheetEvid?.classList.add('hidden'); }
optCancelar?.addEventListener('click', closeSheet);
sheetEvid?.addEventListener('click', (e)=>{ if(e.target === sheetEvid) closeSheet(); });
evidenceBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  openEvidenceCamera();
});
optCam?.addEventListener('click', ()=>{ evidenceInput?.click(); closeSheet(); });
optGal?.addEventListener('click', ()=>{ evidenceInputGallery?.click(); closeSheet(); });

// === Pregunta 6 ===
const q6Radios = document.querySelectorAll('input[name="q6"]');
const q6Comment = document.getElementById('q6-comment');

// Modal de permisos de cámara
const cameraMsg = document.getElementById('camera-permission-msg');
const startScanCta = document.getElementById('start-scan-cta');

// =============================
// ESTADO
// =============================
let stream = null;
let currentScannedData = null;
let evidenceDataUrl = '';
let userInteracted = false;
window.addEventListener('pointerdown', () => (userInteracted = true), { once: true });

// =============================
// SERVICE WORKER (idempotente)
// =============================
if ('serviceWorker' in navigator) {
  // Si ya está registrado, esto no rompe nada.
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

// =============================
// OVERLAY DE GUARDADO
// =============================
function showSaving(msg = 'Guardando…') {
  savingOverlay?.classList.add('active');
  if (savingMsg) savingMsg.textContent = msg;
}
function showSaved(msg = 'Guardado') {
  savingOverlay?.classList.add('success');
  if (savingMsg) savingMsg.textContent = msg;
  setTimeout(hideSaving, 900);
}
function hideSaving() {
  savingOverlay?.classList.remove('active', 'success');
}

// =============================
// ESCÁNER QR
// =============================
function startScanner() {
  currentScannedData = null;
  cameraMsg?.classList.remove('active');

  // Aumentar resolución y optimizar constraints
  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      focusMode: 'continuous' // algunos navegadores soportan esto
    }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(s => {
      stream = s;
      video.srcObject = stream;
      // Esperar a que el video tenga datos suficientes
      return new Promise(resolve => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });
    })
    .then(() => requestAnimationFrame(tickEnhanced))
    .catch(err => {
      console.error('Error de cámara:', err.name, err.message);
      cameraMsg?.classList.add('active');
      if (startScanCta) { startScanCta.disabled = false; startScanCta.style.opacity = '1'; }
    });
}

function stopScanner() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

function drawPath(loc) {
  const p = [loc.topLeftCorner, loc.topRightCorner, loc.bottomRightCorner, loc.bottomLeftCorner];
  canvas.beginPath();
  canvas.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) canvas.lineTo(p[i].x, p[i].y);
  canvas.closePath();
  canvas.lineWidth = 4;
  canvas.strokeStyle = 'rgba(0,200,0,0.9)';
  canvas.stroke();
}

// Escaneo mejorado: más frames, mayor resolución, reintentos
let scanAttempts = 0;
const MAX_ATTEMPTS = 30;
function tickEnhanced() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    // Usar la máxima resolución disponible
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvasElement.width = w;
    canvasElement.height = h;
    canvas.drawImage(video, 0, 0, w, h);

    // Mejorar contraste y brillo si es posible
    // (opcional: se puede agregar procesamiento de imagen aquí)

    const imgData = canvas.getImageData(0, 0, w, h);
    const code = (typeof jsQR === 'function') ? jsQR(imgData.data, imgData.width, imgData.height) : null;

    if (code && code.data) {
      if (code.location) drawPath(code.location);
      const normalized = String(code.data).trim().replace(/\s+/g, '');
      const punto = REFERENCIA_MAP[normalized];

      if (punto) {
        stopScanner();
        currentScannedData = { referencia: normalized, puntoMarcacion: punto };
        if (scannedPointName) {
          scannedPointName.textContent = punto;
          scannedPointName.style.color = '#42a5f5'; // Asegura el color azul
        }
        scannerContainer.style.display = 'none';
        optionsContainer.style.display = 'flex';
        if (userInteracted && navigator.vibrate) { try { navigator.vibrate(150); } catch {} }
        scanAttempts = 0;
        return;
      } else {
        scanAttempts++;
        if (scanAttempts > MAX_ATTEMPTS) {
          showToast(`QR not recognized. Try moving closer or focusing better.`, 'error');
          scanAttempts = 0;
        }
      }
    } else {
      scanAttempts++;
      if (scanAttempts > MAX_ATTEMPTS) {
        showToast('No se detecta QR. Intenta mejorar la iluminación o enfocar.', 'error');
        scanAttempts = 0;
      }
    }
  }
  requestAnimationFrame(tickEnhanced);
}

// =============================
// UI STATES
// =============================
function showUI(state) {
  [scannerContainer, optionsContainer, formSinNovedadContainer, formConNovedadContainer]
    .forEach(el => (el.style.display = 'none'));

  const point = currentScannedData?.puntoMarcacion || '';
  if (pointNameSin) pointNameSin.textContent = point;
  if (pointNameCon) pointNameCon.textContent = point;

  if (state === 'scanner') {
    scannerContainer.style.display = 'block';
  } else if (state === 'options') {
    optionsContainer.style.display = 'flex';
  } else if (state === 'sin-novedad') {
    formSinNovedadContainer.style.display = 'block';
  } else if (state === 'con-novedad') {
    formConNovedadContainer.style.display = 'block';
  }
}

// =============================
// FUNCIÓN PARA REINICIAR BOTÓN START
// =============================
function resetStartButton() {
  if (startScanCta) {
    startScanCta.disabled = false;
    startScanCta.style.opacity = '1';
  }
}

// =============================
// BOTONES PRINCIPALES
// =============================
btnCancelScan?.addEventListener('click', () => {
  stopScanner();
  resetEvidence(); resetQuestions();
  resetStartButton();
  showUI('scanner');
  cameraMsg?.classList.add('active'); // volver a PLAY
});
btnSinNovedad?.addEventListener('click', () => showUI('sin-novedad'));
btnConNovedad?.addEventListener('click', () => showUI('con-novedad'));
document.querySelectorAll('.form-cancel').forEach(b => b.addEventListener('click', () => {
  resetEvidence(); resetQuestions(); showUI('options');
}));
startScanCta?.addEventListener('click', () => {
  startScanCta.disabled = true; startScanCta.style.opacity = '.7';
  showUI('scanner');
  getLocation(); // Captura ubicación al iniciar escaneo
  startScanner();
});

// =============================
// EVIDENCIA (imagen)
// =============================
function fileToOptimizedDataURL(file, max = 1280, q = 0.82) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) { height *= max / width; width = max; }
        else if (height > width && height > max) { width *= max / height; height = max; }
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.onerror = reject; img.src = r.result;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

function dataURLtoBlob(dataURL) {
  const [head, body] = dataURL.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(body); const len = bin.length; const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function resetEvidence() {
  evidenceDataUrl = '';
  if (evidenceInput) evidenceInput.value = '';
  if (evidenceInputGallery) evidenceInputGallery.value = '';
  evidenceWrap.style.display = 'none';
  evidencePreview.src = '';
}

// único pipeline para ambos inputs
async function processEvidenceFile(file){
  if(!file) return;
  showSaving('Procesando evidencia…');
  try{
    evidenceDataUrl = await fileToOptimizedDataURL(file);
    evidencePreview.src = evidenceDataUrl;
    evidenceWrap.style.display = 'flex';
    hideSaving(); showToast('Evidencia lista.', 'success');
  }catch(err){
    console.error(err); hideSaving();
    resetEvidence();
    showToast('No se pudo procesar la evidencia.', 'error');
  }
}

// listeners (solo una vez; sin duplicados)
evidenceInput?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  await processEvidenceFile(file);
});
evidenceInputGallery?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  await processEvidenceFile(file);
});
evidenceRemove?.addEventListener('click', resetEvidence);

// =============================
// PREGUNTAS
// =============================
function resetQuestions() {
  ['q1','q2','q3','q4','q5','q6'].forEach(n =>
    document.querySelectorAll(`input[name="${n}"]`).forEach(r => (r.checked = false))
  );
  if (q6Comment) {
    q6Comment.value = '';
    q6Comment.closest('.q6-comment-wrap')?.classList.add('hidden');
  }
}
q6Radios.forEach(r => r.addEventListener('change', () => {
  const wrap = q6Comment?.closest('.q6-comment-wrap');
  const isYes = document.querySelector('input[name="q6"][value="SI"]')?.checked;
  if (isYes) { wrap?.classList.remove('hidden'); if (q6Comment) q6Comment.required = true; }
  else { wrap?.classList.add('hidden'); if (q6Comment) { q6Comment.required = false; q6Comment.value = ''; } }
}));

// =============================
// OFFLINE QUEUE (IndexedDB) PARA FOTOS
// =============================
const IDB_NAME = 'offline-outbox';
const IDB_STORE = 'uploads';
const isOnline = () => navigator.onLine;

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(item){
  const dbx = await idbOpen();
  await new Promise((res, rej) => {
    const tx = dbx.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(item);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  dbx.close();
}
async function idbAll(){
  const dbx = await idbOpen();
  const items = await new Promise((res, rej) => {
    const tx = dbx.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
  dbx.close(); return items;
}
async function idbDel(id){
  const dbx = await idbOpen();
  await new Promise((res, rej) => {
    const tx = dbx.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  dbx.close();
}

// =============================
// ENVÍO → FIREBASE (OFFLINE-FIRST)
// =============================
function makeDocId(payload){
  const rnd = Math.random().toString(36).slice(2,8);
  return `${payload.referenciaQR}_${Date.now()}_${rnd}`;
}

// ===== Ya no usamos Storage =====

async function queueUpload(docId, referenciaQR, nombreAgente, blob) {
  // Esta función ya no se usa
  console.warn('⚠️  queueUpload deprecated - guardando directamente en Firestore');
}

async function processOutbox() {
  // Ya no necesitamos sincronizar Storage
  console.log('⏭️  Storage sincronización deshabilitada - todo en Firestore');
}

formSinNovedad?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentScannedData) return showToast('Primero escanea un punto.', 'error');
  const nombre = document.getElementById('agent-name-sin-novedad').value.trim();
  if (!nombre) return showToast('Ingresa tu Nombre y Apellido.', 'error');

  const payload = buildPayload({
    nombreAgente: nombre, observacion: '', tipo: 'SIN NOVEDAD', fotoDataUrl: '', preguntas: {}
  });

  showSaving('Guardando…');
  await sendToFirebase(payload);
  formSinNovedad.reset();
  resetStartButton();
  showUI('scanner'); cameraMsg?.classList.add('active');
});

formConNovedad?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentScannedData) return showToast('Scan a point first.', 'error');
  const nombre = document.getElementById('agent-name-con-novedad').value.trim();
  const obs = document.getElementById('observation-text').value.trim();
  if (!nombre) return showToast('Enter your Name and Surname.', 'error');

  // Only name, observation, evidence, and location
  const payload = buildPayload({
    nombreAgente: nombre,
    observacion: obs,
    tipo: 'INCIDENT',
    fotoDataUrl: evidenceDataUrl,
    preguntas: {},
    ubicacion: currentLocation
  });

  showSaving('Saving…');
  await sendToFirebase(payload);
  formConNovedad.reset(); resetEvidence(); /* no resetQuestions() since questions are removed */
  resetStartButton();
  showUI('scanner'); cameraMsg?.classList.add('active');
});

function buildPayload({ nombreAgente, observacion, tipo, fotoDataUrl, preguntas }) {
  return {
    puntoMarcacion: currentScannedData.puntoMarcacion,
    referenciaQR: currentScannedData.referencia,
    timestamp: Date.now(),  // Guardar como número (milisegundos desde epoch)
    fechaHoraISO: new Date().toISOString(),  // Mantener también para legibilidad
    nombreAgente, observacion, tipo, fotoDataUrl, preguntas,
    ubicacion: typeof arguments[0].ubicacion !== 'undefined' ? arguments[0].ubicacion : currentLocation,
    meta: {
      ua: navigator.userAgent || '',
      platform: navigator.platform || '',
      lang: navigator.language || 'es',
    }
  };
}

async function sendToFirebase(payload) {
  if (!db) {
    hideSaving(); showToast('Firebase no inicializado.', 'error');
    return;
  }

  try {
    // 0) Generar docId estable
    const docId = makeDocId(payload);

    // 1) Crear documento base en Firestore
    const baseDoc = {
      punto: payload.puntoMarcacion,
      referenciaQR: payload.referenciaQR,
      nombreAgente: payload.nombreAgente,
      observacion: payload.observacion,
      tipo: payload.tipo,
      preguntas: payload.preguntas || {},
      timestamp: payload.timestamp,  // Guardar como número
      fechaHoraISO: payload.fechaHoraISO,  // Mantener también para legibilidad
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      meta: payload.meta || {},
      ubicacion: payload.ubicacion || null
    };
    
    // 2) Guardar evidencia directamente en Firestore (sin Storage)
    if (payload.fotoDataUrl) {
      baseDoc.evidenciaDataUrl = payload.fotoDataUrl;
      baseDoc.evidenciaGuardada = true;
    }
    
    await db.collection(FIRE_COLLECTION).doc(docId).set(baseDoc);
    console.log('✓ Documento guardado:', docId);

    showSaved('Guardado');
    showToast('Registro guardado correctamente.', 'success');
    
  } catch (err) {
    console.error('❌ Error en sendToFirebase:', err.message);
    hideSaving();
    showToast('Error al guardar. Intenta de nuevo.', 'error');
  }
}

// =============================
// TOAST
// =============================
function showToast(msg, type = 'info') {
  if (!statusToast) return alert(msg);
  statusToast.textContent = msg;
  statusToast.className = `show ${type}`;
  setTimeout(() => (statusToast.className = statusToast.className.replace('show', '')), 3000);
}

// =============================
// INICIO
// =============================
showUI('scanner');
cameraMsg?.classList.add('active');  // Mostrar "INICIAR RONDAS"
