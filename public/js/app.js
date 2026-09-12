let animationFrameId = null;
let html5QrScanner = null;
let currentLoadedShipmentData = null;

function loadQrCodeLibrary() {
  if (typeof QRCode === "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("QR code library failed to load."));
    document.head.appendChild(script);
  });
}

// View Navigation Router
function showSection(sectionId) {
  const sections = ['home', 'tracking', 'services', 'contact', 'admin-login', 'admin-dashboard'];
  sections.forEach(s => {
    const el = document.getElementById(`view-${s}`);
    if (el) el.style.display = (s === sectionId) ? 'block' : 'none';
    const nav = document.getElementById(`nav-${s}`);
    if (nav) nav.classList.toggle('active', s === sectionId);
  });

  if (sectionId === 'tracking') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }
}

// Camera QR Scanner Modal
function openQrScannerModal() {
  showModal('modal-qr-scanner');
  if (typeof Html5Qrcode === "undefined") {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.onload = () => openQrScannerModal();
    script.onerror = () => {
      console.error("QR scanner library failed to load.");
      hideModal("modal-qr-scanner");
      alert("QR scanner could not be loaded.");
    };
    document.head.appendChild(script);
    return;
  }
  if (!html5QrScanner) {
    html5QrScanner = new Html5Qrcode("qr-reader");
  }
  
  html5QrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      // On QR scanned
      closeQrScannerModal();
      const trkNum = parseTrackingFromQr(decodedText);
      const inputEl = document.getElementById('home-tracking-input') || document.getElementById('page-tracking-input');
      if (inputEl) inputEl.value = trkNum; else return;
      handleTrackSubmit(null, inputEl.id);
    },
    (errorMessage) => { /* scanning... */ }
  ).catch(err => {
    console.error("Camera access failed", err);
  });
}

function closeQrScannerModal() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      hideModal('modal-qr-scanner');
    }).catch(() => {
      hideModal('modal-qr-scanner');
    });
  } else {
    hideModal('modal-qr-scanner');
  }
}

function parseTrackingFromQr(text) {
  const value = String(text || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value, window.location.origin);
    const queryTracking = url.searchParams.get("trk");
    if (queryTracking) return queryTracking.trim();

    const parts = url.pathname.split("/").filter(Boolean);
    const trackingIndex = parts.indexOf("tracking");

    if (trackingIndex !== -1 && parts[trackingIndex + 1]) {
      return decodeURIComponent(parts[trackingIndex + 1]).trim();
    }

    if (parts.length) {
      return decodeURIComponent(parts[parts.length - 1]).trim();
    }
  } catch (err) {
    console.warn("QR tracking URL parsing failed:", err);
  }

  return value;
}

// Public Contact Form Submission
async function handleContactSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('contact-alert');
  const payload = {
    sender_name: document.getElementById('cnt-name').value,
    email: document.getElementById('cnt-email').value,
    subject: document.getElementById('cnt-subject').value,
    message: document.getElementById('cnt-message').value
  };

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      alertEl.style.display = 'block';
      alertEl.style.background = 'rgba(46,204,113,0.15)';
      alertEl.style.color = '#2ecc71';
      alertEl.style.border = '1px solid #2ecc71';
      alertEl.innerText = data.message;
      document.getElementById('cnt-name').value = '';
      document.getElementById('cnt-email').value = '';
      document.getElementById('cnt-subject').value = '';
      document.getElementById('cnt-message').value = '';
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    alertEl.style.display = 'block';
    alertEl.style.background = 'rgba(231,76,60,0.15)';
    alertEl.style.color = '#e74c3c';
    alertEl.style.border = '1px solid #e74c3c';
    alertEl.innerText = err.message || 'Error sending message.';
  }
}

// Tracking Submission Handler
async function handleTrackSubmit(e, inputId) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById(inputId);
  const trackingNumber = inputEl ? inputEl.value.trim() : '';

  if (!trackingNumber) return alert('Please enter a tracking number.');

  const pInput = document.getElementById('page-tracking-input');
  if (pInput) pInput.value = trackingNumber;

  showSection('tracking');

  const loadingDiv = document.getElementById('tracking-loading');
  const errorDiv = document.getElementById('tracking-error');
  const resultsDiv = document.getElementById('tracking-results');

  loadingDiv.style.display = 'block';
  errorDiv.style.display = 'none';
  resultsDiv.style.display = 'none';

  try {
    const res = await fetch(`/api/tracking/${encodeURIComponent(trackingNumber)}`);
    const data = await res.json();

    loadingDiv.style.display = 'none';

    if (!res.ok) {
      errorDiv.innerText = data.error || 'Tracking details not found.';
      errorDiv.style.display = 'block';
      return;
    }

    currentLoadedShipmentData = data;
    renderTrackingDashboard(data);
    resultsDiv.style.display = 'block';

  } catch (err) {
    loadingDiv.style.display = 'none';
    errorDiv.innerText = "Unable to retrieve tracking data. Please check server connection.";
    errorDiv.style.display = 'block';
  }
}

// Render Tracking View
function renderTrackingDashboard(data) {
  const s = data.shipment;

  document.getElementById('trk-number-val').innerText = s.tracking_number;
  document.getElementById('trk-service-val').innerText = s.service_type || 'Express Cargo';
  document.getElementById('trk-sender-val').innerText = `${s.sender_name || 'Sender'} (${s.sender_country || s.origin})`;
  document.getElementById('trk-recipient-val').innerText = `${s.recipient_name || 'Recipient'} (${s.recipient_country || s.destination})`;
  document.getElementById('trk-pkg-val').innerText = `${s.package_count || 1} Pkg / ${s.weight || '1.0'} kg`;
  document.getElementById('trk-val-val').innerText = `${s.currency || 'USD'} ${s.declared_value || '0.00'}`;
  document.getElementById('trk-desc-val').innerText = s.description || 'Logistics Consignment';

  document.getElementById('tel-origin').innerText = s.origin;
  document.getElementById('tel-current').innerText = s.current_location;
  document.getElementById('tel-destination').innerText = s.destination;
  document.getElementById('tel-eta').innerText = s.estimated_delivery || 'In Transit';

  const badge = document.getElementById('trk-status-badge');
  badge.innerText = s.status;
  const statusKey = s.status.toLowerCase().replace(/\s+/g, '');
  badge.className = `badge badge-${statusKey}`;

  // Timeline
  const timeline = document.getElementById('timeline-container');
  timeline.innerHTML = '';

  if (data.events && data.events.length > 0) {
    data.events.forEach((ev, idx) => {
      const isLatest = idx === data.events.length - 1;
      const item = document.createElement('div');

      item.className = 'timeline-item';
      item.innerHTML = `
        <div class="timeline-dot ${isLatest ? 'active' : ''}"></div>
        <div style="font-weight:700;">${ev.status} - <span style="color:var(--accent-gold);">${ev.location}</span></div>
        <div style="font-size:0.88rem; color:var(--text-main); margin-top:2px;">${ev.description}</div>
        <div class="timeline-time">${new Date(ev.event_time).toLocaleString()}</div>
      `;

      timeline.appendChild(item);
    });
  }

  // Generate Waybill QR Code
  const qrContainer = document.getElementById('public-parcel-qrcode');
  qrContainer.innerHTML = '';

  loadQrCodeLibrary().then(() => {
    new QRCode(qrContainer, {
      text: window.location.origin + '/?trk=' + s.tracking_number,
      width: 128,
      height: 128,
      colorDark: "#000000",
      colorLight: "#ffffff"
    });
  }).catch(err => {
    console.error("Tracking QR generation failed:", err);
  });

  // Update Dynamic Schema.org JSON-LD for Search Engines
  const schemaScript = document.getElementById('schema-jsonld');
  if (schemaScript) {
    schemaScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ParcelDelivery",
      "deliveryStatus": `https://schema.org/${s.status === 'Delivered' ? 'DeliveredDutyPaid' : 'InTransit'}`,
      "trackingNumber": s.tracking_number,
      "provider": {
        "@type": "Organization",
        "name": "US Courier Enterprise Logistics",
        "url": window.location.origin
      },
      "originAddress": { "@type": "PostalAddress", "addressLocality": s.origin },
      "deliveryAddress": { "@type": "PostalAddress", "addressLocality": s.destination }
    });
  }

  initMapCanvas(s.origin, s.current_location, s.destination, s.status);
}

// Print Official Waybill Receipt
async function triggerPrintOfficialReceipt() {
  if (!currentLoadedShipmentData) return;

  const s = currentLoadedShipmentData.shipment;

  document.getElementById('prt-date').innerText =
    "Date: " + new Date().toLocaleDateString();

  document.getElementById('prt-tracking').innerText =
    s.tracking_number;

  document.getElementById('prt-service').innerText =
    s.service_type || 'Express Cargo';

  document.getElementById('prt-status').innerText =
    s.status;

  document.getElementById('prt-sender-name').innerHTML =
    `<strong>Name:</strong> ${s.sender_name || 'N/A'}`;

  document.getElementById('prt-sender-origin').innerHTML =
    `<strong>Origin:</strong> ${s.sender_country || s.origin}`;

  document.getElementById('prt-recipient-name').innerHTML =
    `<strong>Name:</strong> ${s.recipient_name || 'N/A'}`;

  document.getElementById('prt-recipient-dest').innerHTML =
    `<strong>Destination:</strong> ${s.recipient_country || s.destination}`;

  document.getElementById('prt-desc').innerHTML =
    `<strong>Cargo Manifest:</strong> ${s.description || 'N/A'}`;

  document.getElementById('prt-pkg').innerHTML =
    `<strong>Package Count / Weight:</strong> ${s.package_count || 1} Pkg (${s.weight || '1.0'} kg)`;

  document.getElementById('prt-value').innerHTML =
    `<strong>Declared Value:</strong> ${s.currency || 'USD'} ${s.declared_value || '0.00'}`;

  const qrBox = document.getElementById('prt-qrcode-box');
  qrBox.innerHTML = '';

  try {
    await loadQrCodeLibrary();

    new QRCode(qrBox, {
      text: window.location.origin + '/?trk=' + s.tracking_number,
      width: 100,
      height: 100
    });
  } catch (err) {
    console.error('Print QR generation failed:', err);
  }

  const printArea =
    document.getElementById('printable-receipt-container');

  printArea.style.display = 'block';

  window.print();

  printArea.style.display = 'none';
}

// Dynamic Map Visualizer
function initMapCanvas(origin, current, destination, status) {
  const canvas = document.getElementById('liveMapCanvas');
  if (!canvas) return;

  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const ctx = canvas.getContext('2d');
  let progress = 0.5;

  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1d1714';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const p1 = { x: canvas.width * 0.15, y: canvas.height * 0.65 };
    const pCurrent = { x: canvas.width * 0.50, y: canvas.height * 0.35 };
    const p2 = { x: canvas.width * 0.85, y: canvas.height * 0.65 };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(pCurrent.x, pCurrent.y - 30, p2.x, p2.y);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    drawNode(ctx, p1.x, p1.y, '#a19a95', `Origin: ${origin}`);
    drawNode(ctx, p2.x, p2.y, '#2ecc71', `Destination: ${destination}`);

    progress = (progress + 0.015) % Math.PI;
    const pulseRadius = 8 + Math.sin(progress) * 5;

    ctx.beginPath();
    ctx.arc(pCurrent.x, pCurrent.y - 15, pulseRadius + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
    ctx.fill();

    drawNode(ctx, pCurrent.x, pCurrent.y - 15, '#3498db', `Active: ${current}`, true);

    animationFrameId = requestAnimationFrame(draw);
  }

  draw();
}

function drawNode(ctx, x, y, color, label, isActive = false) {
  ctx.beginPath();
  ctx.arc(x, y, isActive ? 8 : 6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#f5f5f7';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(label, x - 40, y + 22);
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

// Auto-check URL Parameters for ?trk=
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const trk = urlParams.get('trk');
  if (trk) {
    const input = document.getElementById('home-tracking-input');
    if (input) input.value = trk;
    handleTrackSubmit(null, 'home-tracking-input');
  }
});

window.addEventListener('resize', () => {
  const canvas = document.getElementById('liveMapCanvas');
  if (canvas && canvas.parentElement && document.getElementById('view-tracking').style.display !== 'none') {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
});
