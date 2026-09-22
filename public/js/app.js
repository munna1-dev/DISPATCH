// ============================================================
// US COURIER — GEOGRAPHIC ROUTE MAP
// ============================================================

const COURIER_GEO = {
  // =========================
  // United States
  // =========================

  "new york": [40.7128, -74.0060],
  "new york, ny": [40.7128, -74.0060],

  "chicago": [41.8781, -87.6298],
  "chicago, il": [41.8781, -87.6298],

  "los angeles": [34.0522, -118.2437],
  "los angeles, ca": [34.0522, -118.2437],

  "san francisco": [37.7749, -122.4194],
  "san francisco, ca": [37.7749, -122.4194],

  "houston": [29.7604, -95.3698],
  "houston, tx": [29.7604, -95.3698],

  "dallas": [32.7767, -96.7970],
  "dallas, tx": [32.7767, -96.7970],

  "miami": [25.7617, -80.1918],
  "miami, fl": [25.7617, -80.1918],

  "atlanta": [33.7490, -84.3880],
  "atlanta, ga": [33.7490, -84.3880],

  "washington": [38.9072, -77.0369],
  "washington, dc": [38.9072, -77.0369],

  "boston": [42.3601, -71.0589],
  "boston, ma": [42.3601, -71.0589],

  "seattle": [47.6062, -122.3321],
  "seattle, wa": [47.6062, -122.3321],

  "denver": [39.7392, -104.9903],
  "denver, co": [39.7392, -104.9903],

  "phoenix": [33.4484, -112.0740],
  "phoenix, az": [33.4484, -112.0740],

  "detroit": [42.3314, -83.0458],
  "detroit, mi": [42.3314, -83.0458],

  "las vegas": [36.1699, -115.1398],
  "las vegas, nv": [36.1699, -115.1398],

  "philadelphia": [39.9526, -75.1652],
  "philadelphia, pa": [39.9526, -75.1652],

  "portland": [45.5152, -122.6784],
  "portland, or": [45.5152, -122.6784],

  "san diego": [32.7157, -117.1611],
  "san diego, ca": [32.7157, -117.1611],

  "minneapolis": [44.9778, -93.2650],
  "minneapolis, mn": [44.9778, -93.2650],

  "st louis": [38.6270, -90.1994],
  "st. louis": [38.6270, -90.1994],
  "st louis, mo": [38.6270, -90.1994],

  "kansas city": [39.0997, -94.5786],
  "kansas city, mo": [39.0997, -94.5786],

  "orlando": [28.5383, -81.3792],
  "orlando, fl": [28.5383, -81.3792],

  "tampa": [27.9506, -82.4572],
  "tampa, fl": [27.9506, -82.4572],

  "new orleans": [29.9511, -90.0715],
  "new orleans, la": [29.9511, -90.0715],

  "charlotte": [35.2271, -80.8431],
  "charlotte, nc": [35.2271, -80.8431],

  "nashville": [36.1627, -86.7816],
  "nashville, tn": [36.1627, -86.7816],

  "baltimore": [39.2904, -76.6122],
  "baltimore, md": [39.2904, -76.6122],

  // =========================
  // International
  // =========================

  "lagos": [6.5244, 3.3792],
  "lagos, nigeria": [6.5244, 3.3792],

  "abuja": [9.0765, 7.3986],
  "abuja, nigeria": [9.0765, 7.3986],

  "london": [51.5074, -0.1278],
  "london, uk": [51.5074, -0.1278],

  "toronto": [43.6532, -79.3832],
  "toronto, canada": [43.6532, -79.3832],

  "vancouver": [49.2827, -123.1207],
  "vancouver, canada": [49.2827, -123.1207],

  "montreal": [45.5017, -73.5673],
  "montreal, canada": [45.5017, -73.5673],

  "taipei": [25.0330, 121.5654],
  "taipei, taiwan": [25.0330, 121.5654],

  "tokyo": [35.6762, 139.6503],
  "tokyo, japan": [35.6762, 139.6503],

  "beijing": [39.9042, 116.4074],
  "beijing, china": [39.9042, 116.4074],

  "shanghai": [31.2304, 121.4737],
  "shanghai, china": [31.2304, 121.4737],

  "dubai": [25.2048, 55.2708],
  "dubai, uae": [25.2048, 55.2708],

  "paris": [48.8566, 2.3522],
  "paris, france": [48.8566, 2.3522],

  "berlin": [52.5200, 13.4050],
  "berlin, germany": [52.5200, 13.4050],

  "amsterdam": [52.3676, 4.9041],
  "amsterdam, netherlands": [52.3676, 4.9041],

  "singapore": [1.3521, 103.8198],
  "singapore, singapore": [1.3521, 103.8198],

  "hong kong": [22.3193, 114.1694],
  "hong kong, china": [22.3193, 114.1694],

  "sydney": [-33.8688, 151.2093],
  "sydney, australia": [-33.8688, 151.2093],

  "melbourne": [-37.8136, 144.9631],
  "melbourne, australia": [-37.8136, 144.9631],

  "johannesburg": [-26.2041, 28.0473],
  "johannesburg, south africa": [-26.2041, 28.0473],

  "cape town": [-33.9249, 18.4241],
  "cape town, south africa": [-33.9249, 18.4241]
};


// ============================================================
// GLOBAL MAP ANIMATION STATE
// ============================================================

let animationFrameId = null;


// ============================================================
// RESOLVE LOCATION → LAT/LON
// ============================================================

function resolveGeoLocation(location) {
  if (!location) return null;

  // Direct GPS object
  if (
    typeof location === "object" &&
    Number.isFinite(Number(location.lat)) &&
    Number.isFinite(Number(location.lon))
  ) {
    return {
      lat: Number(location.lat),
      lon: Number(location.lon),
      label: location.label || "Current Location"
    };
  }

  const value = String(location)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!value) return null;

  // Exact match
  if (COURIER_GEO[value]) {
    return {
      lat: COURIER_GEO[value][0],
      lon: COURIER_GEO[value][1],
      label: location
    };
  }

  // Partial match
  for (const key of Object.keys(COURIER_GEO)) {
    if (value.includes(key) || key.includes(value)) {
      return {
        lat: COURIER_GEO[key][0],
        lon: COURIER_GEO[key][1],
        label: location
      };
    }
  }

  return null;
}


// ============================================================
// GEO → CANVAS PROJECTION
// ============================================================

function projectGeo(lat, lon, bounds, width, height, padding = 45) {
  const lonRange = bounds.maxLon - bounds.minLon;
  const latRange = bounds.maxLat - bounds.minLat;

  const safeLonRange = lonRange || 1;
  const safeLatRange = latRange || 1;

  const x =
    padding +
    ((lon - bounds.minLon) / safeLonRange) *
      (width - padding * 2);

  const y =
    height -
    padding -
    ((lat - bounds.minLat) / safeLatRange) *
      (height - padding * 2);

  return { x, y };
}


// ============================================================
// DRAW ROUTE
// ============================================================

function drawRouteLine(ctx, points) {
  if (!Array.isArray(points) || points.length < 2) return;

  // Outer route glow
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;

    const curve =
      Math.min(
        55,
        Math.abs(current.x - previous.x) * 0.10
      );

    ctx.quadraticCurveTo(
      midX,
      midY - curve,
      current.x,
      current.y
    );
  }

  ctx.strokeStyle = "rgba(232, 168, 124, 0.25)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke();

  // Main route
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;

    const curve =
      Math.min(
        55,
        Math.abs(current.x - previous.x) * 0.10
      );

    ctx.quadraticCurveTo(
      midX,
      midY - curve,
      current.x,
      current.y
    );
  }

  ctx.strokeStyle = "#e8a87c";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.setLineDash([9, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
}


// ============================================================
// DRAW NODE
// ============================================================

function drawGeoNode(
  ctx,
  point,
  color,
  label,
  type = "normal"
) {
  if (!point) return;

  const radius = type === "current" ? 7 : 5;

  // Current-location glow
  if (type === "current") {
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      18,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "rgba(52, 152, 219, 0.14)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      12,
      0,
      Math.PI * 2
    );

    ctx.strokeStyle = "rgba(52, 152, 219, 0.30)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Node
  ctx.beginPath();
  ctx.arc(
    point.x,
    point.y,
    radius,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.font = "11px Inter, Arial, sans-serif";
  ctx.fillStyle = "#f5f5f7";

  const safeLabel = String(label || "Location");
  const textWidth = ctx.measureText(safeLabel).width;

  const textX = Math.max(
    8,
    Math.min(
      point.x - textWidth / 2,
      ctx.canvas.width - textWidth - 8
    )
  );

  ctx.fillText(
    safeLabel,
    textX,
    point.y + 25
  );
}


// ============================================================
// MAP GRID
// ============================================================

function drawMapGrid(ctx, width, height, bounds) {
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;

  // Longitude
  for (
    let lon = Math.ceil(bounds.minLon / 10) * 10;
    lon <= bounds.maxLon;
    lon += 10
  ) {
    const p1 = projectGeo(
      bounds.minLat,
      lon,
      bounds,
      width,
      height
    );

    const p2 = projectGeo(
      bounds.maxLat,
      lon,
      bounds,
      width,
      height
    );

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Latitude
  for (
    let lat = Math.ceil(bounds.minLat / 10) * 10;
    lat <= bounds.maxLat;
    lat += 10
  ) {
    const p1 = projectGeo(
      lat,
      bounds.minLon,
      bounds,
      width,
      height
    );

    const p2 = projectGeo(
      lat,
      bounds.maxLon,
      bounds,
      width,
      height
    );

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}


// ============================================================
// STYLIZED LANDMASS
// ============================================================

function drawGeoLandmass(ctx, width, height, bounds) {
  const usa = [
    [49.0, -124.7],
    [48.2, -123.0],
    [46.0, -124.0],
    [43.0, -124.2],
    [40.0, -124.0],
    [37.0, -122.0],
    [34.0, -118.5],
    [32.0, -117.0],
    [31.0, -111.0],
    [29.5, -103.0],
    [26.0, -97.5],
    [28.5, -96.0],
    [30.0, -90.0],
    [29.0, -85.0],
    [30.0, -82.0],
    [27.0, -80.0],
    [30.0, -79.0],
    [34.0, -78.0],
    [36.5, -75.0],
    [39.0, -74.0],
    [41.0, -70.0],
    [44.0, -68.0],
    [47.0, -67.0],
    [49.0, -95.0],
    [49.0, -110.0],
    [49.0, -124.7]
  ];

  ctx.beginPath();

  usa.forEach(([lat, lon], index) => {
    const point = projectGeo(
      lat,
      lon,
      bounds,
      width,
      height
    );

    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });

  ctx.closePath();

  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fill();

  ctx.strokeStyle = "rgba(232,168,124,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
}


// ============================================================
// MAIN GEOGRAPHIC MAP
// ============================================================

function initMapCanvas(
  origin,
  current,
  destination,
  status
) {
  const canvas =
    document.getElementById("liveMapCanvas");

  if (!canvas) {
    console.warn(
      "[MAP] liveMapCanvas was not found."
    );
    return;
  }

  const container = canvas.parentElement;

  if (!container) {
    console.warn(
      "[MAP] Canvas container was not found."
    );
    return;
  }

  // Stop previous animation
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  const width = Math.max(
    320,
    container.clientWidth || 600
  );

  const height = Math.max(
    220,
    container.clientHeight || 300
  );

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    console.error(
      "[MAP] Unable to obtain canvas context."
    );
    return;
  }

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  const originGeo =
    resolveGeoLocation(origin);

  const currentGeo =
    resolveGeoLocation(current);

  const destinationGeo =
    resolveGeoLocation(destination);

  const locations = [
    originGeo,
    currentGeo,
    destinationGeo
  ].filter(Boolean);

  let bounds;

  if (locations.length > 0) {
    const lats =
      locations.map(point => point.lat);

    const lons =
      locations.map(point => point.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latPadding =
      Math.max(
        4,
        (maxLat - minLat) * 0.25
      );

    const lonPadding =
      Math.max(
        6,
        (maxLon - minLon) * 0.18
      );

    bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding
    };
  } else {
    bounds = {
      minLat: 20,
      maxLat: 55,
      minLon: -130,
      maxLon: -65
    };
  }

  // Prevent zero-size projections
  if (bounds.maxLat === bounds.minLat) {
    bounds.maxLat += 1;
    bounds.minLat -= 1;
  }

  if (bounds.maxLon === bounds.minLon) {
    bounds.maxLon += 1;
    bounds.minLon -= 1;
  }

  const originPoint =
    originGeo
      ? projectGeo(
          originGeo.lat,
          originGeo.lon,
          bounds,
          width,
          height
        )
      : null;

  const currentPoint =
    currentGeo
      ? projectGeo(
          currentGeo.lat,
          currentGeo.lon,
          bounds,
          width,
          height
        )
      : null;

  const destinationPoint =
    destinationGeo
      ? projectGeo(
          destinationGeo.lat,
          destinationGeo.lon,
          bounds,
          width,
          height
        )
      : null;

  const routePoints = [
    originPoint,
    currentPoint,
    destinationPoint
  ].filter(Boolean);

  let animation = 0;

  function draw() {
    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    // Background
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

    gradient.addColorStop(
      0,
      "#160e0a"
    );

    gradient.addColorStop(
      0.5,
      "#24160f"
    );

    gradient.addColorStop(
      1,
      "#1a100c"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    // Grid
    drawMapGrid(
      ctx,
      width,
      height,
      bounds
    );

    // North American landmass
    if (
      bounds.minLon < -60 &&
      bounds.maxLon > -130 &&
      bounds.maxLat > 35
    ) {
      drawGeoLandmass(
        ctx,
        width,
        height,
        bounds
      );
    }

    // Route
    drawRouteLine(
      ctx,
      routePoints
    );

    // Origin
    if (originPoint) {
      drawGeoNode(
        ctx,
        originPoint,
        "#a19a95",
        `Origin · ${origin || "—"}`,
        "origin"
      );
    }

    // Destination
    if (destinationPoint) {
      drawGeoNode(
        ctx,
        destinationPoint,
        "#2ecc71",
        `Destination · ${destination || "—"}`,
        "destination"
      );
    }

    // Current location
    if (currentPoint) {
      animation += 0.045;

      const pulse =
        7 + Math.sin(animation) * 3;

      ctx.beginPath();

      ctx.arc(
        currentPoint.x,
        currentPoint.y,
        15 + pulse,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        "rgba(52,152,219,0.10)";

      ctx.fill();

      drawGeoNode(
        ctx,
        currentPoint,
        "#3498db",
        `Current · ${current || "Tracking"}`,
        "current"
      );
    }

    // Status
    ctx.font =
      "10px Inter, Arial, sans-serif";

    ctx.fillStyle =
      "rgba(255,255,255,0.48)";

    ctx.fillText(
      `LIVE ROUTE · ${(status || "TRACKING").toUpperCase()}`,
      16,
      20
    );

    // Coordinates
    if (currentGeo) {
      const coordText =
        `${currentGeo.lat.toFixed(4)}°, ` +
        `${currentGeo.lon.toFixed(4)}°`;

      ctx.fillStyle =
        "rgba(255,255,255,0.38)";

      ctx.fillText(
        coordText,
        16,
        height - 16
      );
    }

    if (!document.hidden) {
      animationFrameId =
        requestAnimationFrame(draw);
    }
  }

  draw();
}


// ============================================================
// TRACKING UI HELPERS
// ============================================================

function setTrackingText(id, value) {
  const el =
    document.getElementById(id);

  if (el) {
    el.textContent =
      value ?? "—";
  }
}


// ============================================================
// FORMAT TRACKING DATE
// ============================================================

function formatTrackingDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


// ============================================================
// GET LATEST GPS EVENT
// ============================================================

function getLatestGpsEvent(events) {
  if (!Array.isArray(events)) {
    return null;
  }

  const gpsEvents =
    events
      .filter(event =>
        event &&
        event.latitude !== null &&
        event.latitude !== undefined &&
        event.longitude !== null &&
        event.longitude !== undefined &&
        Number.isFinite(
          Number(event.latitude)
        ) &&
        Number.isFinite(
          Number(event.longitude)
        )
      )
      .sort((a, b) =>
        new Date(
          b.event_time ||
          b.created_at ||
          0
        ) -
        new Date(
          a.event_time ||
          a.created_at ||
          0
        )
      );

  return gpsEvents[0] || null;
}


// ============================================================
// TRACKING TIMELINE
// ============================================================

function updateTrackingTimeline(events) {
  const container =
    document.getElementById(
      "timeline-container"
    );

  if (!container) return;

  container.innerHTML = "";

  if (
    !Array.isArray(events) ||
    events.length === 0
  ) {
    container.innerHTML =
      '<div class="timeline-item">' +
      "<strong>No tracking events recorded.</strong>" +
      "</div>";

    return;
  }

  [...events]
    .sort((a, b) =>
      new Date(
        a.event_time ||
        a.created_at ||
        0
      ) -
      new Date(
        b.event_time ||
        b.created_at ||
        0
      )
    )
    .forEach(event => {
      const item =
        document.createElement(
          "div"
        );

      item.className =
        "timeline-item";

      const location =
        event.location ||
        "Location unavailable";

      const description =
        event.description || "";

      const date =
        formatTrackingDate(
          event.event_time ||
          event.created_at
        );

      item.innerHTML = `
        <div class="timeline-dot"></div>

        <div class="timeline-content">
          <strong>
            ${escapeTrackingHtml(
              event.status ||
              "Shipment Update"
            )}
          </strong>

          <div style="
            color:var(--text-muted);
            font-size:.82rem;
            margin:.25rem 0;
          ">
            ${escapeTrackingHtml(location)}
          </div>

          ${
            description
              ? `
                <div style="font-size:.85rem;">
                  ${escapeTrackingHtml(description)}
                </div>
              `
              : ""
          }

          <small style="color:var(--text-muted);">
            ${escapeTrackingHtml(date)}
          </small>
        </div>
      `;

      container.appendChild(item);
    });
}


// ============================================================
// BASIC HTML ESCAPE FOR TRACKING DATA
// ============================================================

function escapeTrackingHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ============================================================
// QR CODE SCANNER
// ============================================================

let qrScanner = null;

function openQrScannerModal(inputId) {
  const modal = document.getElementById("modal-qr-scanner");
  const reader = document.getElementById("qr-reader");

  if (!modal || !reader) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    console.error("QR scanner library is not loaded.");
    return;
  }

  modal.style.display = "flex";
  reader.innerHTML = "";

  qrScanner = new Html5Qrcode("qr-reader");

  qrScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    async (decodedText) => {
      const decodedValue = String(decodedText || "").trim();

      if (!decodedValue) {
        return;
      }

      let trackingNumber = decodedValue;

      try {
        const decodedUrl = new URL(decodedValue);
        const urlTrackingNumber =
          decodedUrl.searchParams.get("trk");

        if (urlTrackingNumber) {
          trackingNumber = urlTrackingNumber.trim();
        }
      } catch {
        // QR contains a raw tracking number rather than a URL.
      }

      trackingNumber = trackingNumber.trim();

      if (!trackingNumber) {
        return;
      }

      try {
        await qrScanner.stop();
      } catch (error) {
        console.warn("QR scanner stop warning:", error);
      }

      qrScanner.clear();
      qrScanner = null;

      closeQrScannerModal();

      const input =
        document.getElementById(inputId) ||
        document.getElementById("page-tracking-input") ||
        document.getElementById("home-tracking-input");

      if (!input) {
        return;
      }

      input.value = trackingNumber;

      await handleTrackSubmit(
        null,
        input.id
      );
    },
    () => {
      // Ignore normal QR scanning misses while the camera is running.
    }
  ).catch((error) => {
    console.error("QR scanner could not start:", error);
    closeQrScannerModal();
  });
}

function closeQrScannerModal() {
  const modal = document.getElementById("modal-qr-scanner");
  const reader = document.getElementById("qr-reader");

  if (qrScanner) {
    qrScanner.stop()
      .catch(() => {})
      .finally(() => {
        try {
          qrScanner.clear();
        } catch {}

        qrScanner = null;

        if (reader) {
          reader.innerHTML = "";
        }
      });
  } else if (reader) {
    reader.innerHTML = "";
  }

  if (modal) {
    modal.style.display = "none";
  }
}


// ============================================================
// TRACK SHIPMENT
// ============================================================


function triggerPrintOfficialReceipt() {
  const getText = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.textContent || "").trim() : "-";
  };

  const tracking = getText("trk-number-val");

  if (!tracking || tracking === "-") {
    alert("Please track a parcel before printing the receipt.");
    return;
  }

  const existing = document.getElementById("public-print-receipt");
  if (existing) {
    existing.remove();
  }

  const receipt = document.createElement("div");
  receipt.id = "public-print-receipt";

  const rows = [
    ["Tracking Number", tracking],
    ["Reference", getText("trk-reference-val")],
    ["Service Level", getText("trk-service-val")],
    ["Priority", getText("trk-priority-val")],
    ["Status", getText("trk-detail-status-val")],
    ["Origin Gateway", getText("trk-origin-val")],
    ["Current Location", getText("trk-current-val")],
    ["Destination Gateway", getText("trk-destination-val")],
    ["Estimated Delivery", getText("trk-eta-val")],
    ["Package Count / Weight", getText("trk-pkg-val")]
  ];

  receipt.innerHTML = `
    <div class="official-receipt-sheet public-tracking-receipt">
      <div class="receipt-header">
        <div>
          <div class="uc-brand uc-brand--receipt">
            <span class="uc-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <rect x="2.5" y="2.5" width="43" height="43" rx="12"></rect>
                <path d="M9 27h19l5-7h6v12H9z"></path>
                <path d="M12 16h15M12 21h10"></path>
                <circle cx="17" cy="32" r="2.8"></circle>
                <circle cx="34" cy="32" r="2.8"></circle>
                <path d="M11 39h26"></path>
              </svg>
            </span>
            <span class="uc-brand-copy">
              <span class="uc-brand-name">US COURIER</span>
              <small>ENTERPRISE LOGISTICS</small>
            </span>
          </div>
        </div>

        <div style="text-align:right;">
          <h2 style="font-size:1.1rem;color:#b30000;">
            OFFICIAL TRACKING RECEIPT
          </h2>
          <p style="font-size:.8rem;color:#555;">
            Date: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>

      <div class="public-receipt-summary">
        ${rows.map(([label, value]) => `
          <div class="public-receipt-row">
            <strong>${escapeTrackingHtml(label)}</strong>
            <span>${escapeTrackingHtml(value)}</span>
          </div>
        `).join("")}
      </div>

      <div class="public-receipt-timeline">
        <h3>Shipment Chronology & Event Log</h3>
        <div id="public-print-timeline"></div>
      </div>

      <div style="margin-top:2rem;text-align:center;">
        <div style="border-bottom:1px solid #111;width:200px;margin:0 auto .3rem;"></div>
        <p style="font-size:.75rem;color:#555;">
          Public Tracking Verification
        </p>
      </div>

      <div class="receipt-stamp">
        <span>US COURIER</span>
        <span>VERIFIED</span>
        <span>TRACKING RECORD</span>
      </div>
    </div>
  `;

  document.body.appendChild(receipt);

  const timeline = document.getElementById("public-print-timeline");
  const sourceTimeline = document.getElementById("timeline-container");

  if (timeline && sourceTimeline) {
    timeline.innerHTML = sourceTimeline.innerHTML;
  }

  receipt.style.display = "block";

  const cleanup = () => {
    receipt.style.display = "none";
    receipt.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  window.setTimeout(() => {
    window.print();
  }, 250);
}

async function handleTrackSubmit(
  event,
  inputId
) {
  if (event) {
    event.preventDefault();
  }

  const input =
    document.getElementById(inputId);

  const trackingNumber =
    input
      ? input.value.trim()
      : "";

  if (!trackingNumber) {
    return;
  }

  // Show tracking results section
  showSection("tracking");

  const loading =
    document.getElementById(
      "tracking-loading"
    );

  const error =
    document.getElementById(
      "tracking-error"
    );

  const results =
    document.getElementById(
      "tracking-results"
    );

  if (loading) {
    loading.style.display = "block";
  }

  if (error) {
    error.style.display = "none";
    error.textContent = "";
  }

  if (results) {
    results.style.display = "none";
  }

  try {
    const response =
      await fetch(
        `/api/tracking/${encodeURIComponent(
          trackingNumber
        )}`,
        {
          method: "GET",
          headers: {
            "Accept": "application/json"
          }
        }
      );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The tracking server returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.shipment
    ) {
      throw new Error(
        data.message ||
        data.error ||
        "Shipment not found."
      );
    }

    const shipment =
      data.shipment;

    const events =
      Array.isArray(data.events)
        ? data.events
        : [];

    const status =
      String(
        shipment.status || "Tracking"
      ).toLowerCase();

    // ========================================================
    // ROUTE INFORMATION
    // ========================================================

    setTrackingText(
      "tel-origin",
      shipment.origin || "—"
    );

    setTrackingText(
      "tel-current",
      shipment.current_location || "—"
    );

    setTrackingText(
      "tel-destination",
      shipment.destination || "—"
    );

    setTrackingText(
      "tel-eta",
      formatTrackingDate(
        shipment.estimated_delivery
      )
    );

    // ========================================================
    // SHIPMENT DETAILS
    // ========================================================

    setTrackingText(
      "trk-number-val",
      shipment.tracking_number || trackingNumber
    );

    setTrackingText(
      "trk-service-val",
      shipment.service_type || "—"
    );

    // Public route/status information
    setTrackingText(
      "trk-detail-status-val",
      shipment.status || "—"
    );

    setTrackingText(
      "trk-origin-val",
      shipment.origin || "—"
    );

    setTrackingText(
      "trk-current-val",
      shipment.current_location || "—"
    );

    setTrackingText(
      "trk-destination-val",
      shipment.destination || "—"
    );

    setTrackingText(
      "trk-eta-val",
      formatTrackingDate(
        shipment.estimated_delivery
      )
    );

    setTrackingText(
      "trk-reference-val",
      shipment.reference || "—"
    );

    setTrackingText(
      "trk-priority-val",
      shipment.priority || "—"
    );

    const packageCount =
      shipment.package_count || 1;

    const weight =
      shipment.weight_kg !== null &&
      shipment.weight_kg !== undefined &&
      shipment.weight_kg !== ""
        ? `${shipment.weight_kg} kg`
        : "—";

    setTrackingText(
      "trk-pkg-val",
      `${packageCount} / ${weight}`
    );

    // ========================================================
    // STATUS BADGE
    // ========================================================

    const badge =
      document.getElementById(
        "trk-status-badge"
      );

    if (badge) {
      badge.textContent =
        shipment.status || "Tracking";

      badge.className =
        "badge badge-transit";

      if (
        status.includes("delivered")
      ) {
        badge.className =
          "badge badge-delivered";
      } else if (
        status.includes("delay") ||
        status.includes("exception") ||
        status.includes("hold")
      ) {
        badge.className =
          "badge badge-delayed";
      }
    }

    // ========================================================
    // TIMELINE
    // ========================================================

    updateTrackingTimeline(events);

    /*
     * Display the tracking result immediately after the
     * shipment data has been rendered. Map/QR enhancements
     * must never prevent the core tracking result from showing.
     */
    if (results) {
      results.style.display = "block";
    }

    if (loading) {
      loading.style.display = "none";
    }

    // ========================================================
    // MAP
    // ========================================================

    try {
      const latestGps =
        getLatestGpsEvent(events);

      const mapCurrent =
        latestGps
          ? {
              label:
                latestGps.location ||
                shipment.current_location ||
                "Current Location",

              lat:
                Number(
                  latestGps.latitude
                ),

              lon:
                Number(
                  latestGps.longitude
                )
            }
          : shipment.current_location;

      requestAnimationFrame(() => {
        try {
          initMapCanvas(
            shipment.origin,
            mapCurrent,
            shipment.destination,
            shipment.status
          );
        } catch (mapError) {
          console.warn(
            "[TRACKING] Map rendering failed:",
            mapError
          );
        }
      });
    } catch (mapError) {
      console.warn(
        "[TRACKING] Map preparation failed:",
        mapError
      );
    }

    // ========================================================
    // UPDATE URL
    // ========================================================

    try {
      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        "trk",
        shipment.tracking_number
      );

      window.history.replaceState(
        {},
        "",
        url
      );
    } catch (_) {
      // Ignore URL update failures
    }

  } catch (err) {
    console.error(
      "[TRACKING]",
      err
    );

    if (loading) {
      loading.style.display = "none";
    }

    if (error) {
      error.textContent =
        err.message ||
        "Unable to retrieve shipment.";

      error.style.display = "block";
    }
  }
}

// ============================================================
// VIEW / DOWNLOAD PUBLIC TRACKING QR
// ============================================================

function downloadPublicTrackingQr() {
  const trackingNumber =
    document
      .getElementById("trk-number-val")
      ?.textContent
      ?.trim();

  if (
    !trackingNumber ||
    trackingNumber === "-" ||
    trackingNumber === "—"
  ) {
    alert("Please track a shipment first.");
    return;
  }

  if (typeof QRCode === "undefined") {
    alert("QR code service is unavailable. Please refresh the page.");
    return;
  }

  const oldModal =
    document.getElementById("public-qr-modal");

  if (oldModal) {
    oldModal.remove();
  }

  const modal =
    document.createElement("div");

  modal.id = "public-qr-modal";

  modal.style.cssText =
    "position:fixed;" +
    "inset:0;" +
    "z-index:99999;" +
    "display:flex;" +
    "align-items:center;" +
    "justify-content:center;" +
    "padding:20px;" +
    "background:rgba(0,0,0,.72);";

  const card =
    document.createElement("div");

  card.style.cssText =
    "width:min(380px,100%);" +
    "background:#fff;" +
    "border-radius:14px;" +
    "padding:22px;" +
    "box-shadow:0 20px 60px rgba(0,0,0,.35);" +
    "text-align:center;" +
    "color:#111;";

  card.innerHTML =
    '<h3 style="margin:0 0 6px;">QR Verification</h3>' +
    '<div style="font-size:.75rem;color:#666;">Tracking Number</div>' +
    '<div style="font-family:monospace;font-weight:700;color:#0b1f3a;margin:5px 0 16px;word-break:break-all;">' +
    trackingNumber +
    '</div>' +
    '<div id="public-qr-modal-code" style="display:flex;align-items:center;justify-content:center;min-height:205px;padding:18px;background:#fff;border:2px solid #d9dee7;border-radius:10px;box-sizing:border-box;"></div>' +
    '<p style="font-size:.75rem;color:#666;margin:12px 0 18px;">Scan to verify this shipment tracking page.</p>' +
    '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
    '<button type="button" id="public-qr-download" class="btn-outline" style="padding:.6rem .9rem;">Download QR Code</button>' +
    '<button type="button" id="public-qr-close" class="btn-gold" style="padding:.6rem .9rem;">Close</button>' +
    '</div>';

  modal.appendChild(card);
  document.body.appendChild(modal);

  const qrContainer =
    document.getElementById(
      "public-qr-modal-code"
    );

  let trackingUrl;

  try {
    const url =
      new URL(window.location.href);

    url.searchParams.set(
      "trk",
      trackingNumber
    );

    trackingUrl =
      url.toString();
  } catch (error) {
    console.error(
      "[QR] Unable to build tracking URL.",
      error
    );
    modal.remove();
    return;
  }

  new QRCode(
    qrContainer,
    {
      text: trackingUrl,
      width: 170,
      height: 170,
      correctLevel:
        QRCode.CorrectLevel.M
    }
  );

  document
    .getElementById("public-qr-download")
    .onclick = function () {
      const canvas =
        qrContainer.querySelector("canvas");

      const image =
        qrContainer.querySelector("img");

      let dataUrl = "";

      if (canvas) {
        try {
          dataUrl =
            canvas.toDataURL("image/png");
        } catch (error) {
          console.error(
            "[QR] QR export failed.",
            error
          );
        }
      }

      if (!dataUrl && image?.src) {
        dataUrl = image.src;
      }

      if (!dataUrl) {
        alert(
          "QR code is not ready yet. Please try again."
        );
        return;
      }

      const link =
        document.createElement("a");

      link.href = dataUrl;

      link.download =
        trackingNumber +
        "-verification-qr.png";

      document.body.appendChild(link);
      link.click();
      link.remove();
    };

  document
    .getElementById("public-qr-close")
    .onclick = function () {
      modal.remove();
    };

  modal.onclick =
    function (event) {
      if (event.target === modal) {
        modal.remove();
      }
    };
}


// ============================================================
// GPS-AWARE MAP WRAPPER
// ============================================================


// ============================================================


// ============================================================

function initMapCanvasWithGps(
  origin,
  current,
  destination,
  status
) {
  initMapCanvas(
    origin,
    current,
    destination,
    status
  );
}


// ============================================================
// SECTION NAVIGATION
// ============================================================

function showSection(section) {
  const isAdminSection =
    typeof section === "string" &&
    section.indexOf("admin-") === 0;

  document.body.classList.toggle(
    "admin-portal-active",
    isAdminSection
  );

  document
    .querySelectorAll(
      "section[id^='view-']"
    )
    .forEach(element => {
      element.style.display =
        "none";
    });

  const target =
    document.getElementById(
      "view-" + section
    );

  if (target) {
    target.style.display =
      "block";
  }

  document
    .querySelectorAll("nav a")
    .forEach(link => {
      link.classList.remove(
        "active"
      );
    });

  const nav =
    document.getElementById(
      "nav-" + section
    );

  if (nav) {
    nav.classList.add(
      "active"
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ============================================================
// CONTACT FORM
// ============================================================

async function handleContactSubmit(
  event
) {
  if (event) {
    event.preventDefault();
  }

  const form =
    document.querySelector(
      "#view-contact form"
    );

  const alertBox =
    document.getElementById(
      "contact-alert"
    );

  const submitButton =
    form
      ? form.querySelector(
          'button[type="submit"]'
        )
      : null;

  if (
    form &&
    form.dataset.contactSubmitting === "true"
  ) {
    return;
  }

  const nameEl =
    document.getElementById(
      "cnt-name"
    );

  const emailEl =
    document.getElementById(
      "cnt-email"
    );

  const subjectEl =
    document.getElementById(
      "cnt-subject"
    );

  const messageEl =
    document.getElementById(
      "cnt-message"
    );

  const payload = {
    name:
      nameEl
        ? nameEl.value.trim()
        : "",

    email:
      emailEl
        ? emailEl.value.trim()
        : "",

    subject:
      subjectEl
        ? subjectEl.value.trim()
        : "",

    message:
      messageEl
        ? messageEl.value.trim()
        : ""
  };

  if (
    !payload.name ||
    !payload.email ||
    !payload.subject ||
    !payload.message
  ) {
    if (alertBox) {
      alertBox.textContent =
        "Please complete all required fields.";

      alertBox.style.display =
        "block";
    }

    return;
  }

  if (form) {
    form.dataset.contactSubmitting =
      "true";
  }

  if (submitButton) {
    submitButton.disabled = true;

    submitButton.setAttribute(
      "aria-busy",
      "true"
    );

    submitButton.dataset.originalText =
      submitButton.textContent;

    submitButton.textContent =
      "Sending…";
  }

  if (alertBox) {
    alertBox.textContent =
      "Sending your message…";

    alertBox.style.display =
      "block";
  }

  try {
    const response =
      await fetch(
        "/api/contact",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "Unable to send message."
      );
    }

    if (alertBox) {
      alertBox.textContent =
        data.message ||
        "Your message has been received successfully.";

      alertBox.style.display =
        "block";
    }

    if (form) {
      form.reset();
    }

  } catch (error) {
    console.error(
      "[CONTACT]",
      error
    );

    if (alertBox) {
      alertBox.textContent =
        error.message ||
        "Unable to send your message.";

      alertBox.style.display =
        "block";
    }

  } finally {
    if (form) {
      delete form.dataset.contactSubmitting;
    }

    if (submitButton) {
      submitButton.disabled = false;

      submitButton.removeAttribute(
        "aria-busy"
      );

      submitButton.textContent =
        submitButton.dataset.originalText ||
        "Send Message";

      delete submitButton.dataset.originalText;
    }
  }
}


// ============================================================

// MODAL FUNCTIONS
// ============================================================

function showModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) {
    console.error(
      "[MODAL] Modal not found:",
      id
    );

    return;
  }

  modal.classList.add(
    "active"
  );

  modal.style.display =
    "flex";

  modal.style.visibility =
    "visible";

  modal.style.opacity =
    "1";

  modal.style.pointerEvents =
    "auto";
}


function hideModal(id) {
  const modal =
    document.getElementById(id);

  if (!modal) {
    console.error(
      "[MODAL] Modal not found:",
      id
    );

    return;
  }

  modal.classList.remove(
    "active"
  );

  modal.style.display =
    "none";

  modal.style.visibility =
    "hidden";

  modal.style.opacity =
    "0";

  modal.style.pointerEvents =
    "none";
}


// ============================================================
// STOP MAP ANIMATION WHEN PAGE IS HIDDEN
// ============================================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.hidden &&
      animationFrameId
    ) {
      cancelAnimationFrame(
        animationFrameId
      );

      animationFrameId =
        null;
    }
  }
);


// ============================================================
// RESUME MAP WHEN PAGE BECOMES VISIBLE
// ============================================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      !document.hidden &&
      !animationFrameId
    ) {
      const canvas =
        document.getElementById(
          "liveMapCanvas"
        );

      if (
        canvas &&
        canvas.dataset.trackingInitialized ===
          "true"
      ) {
        // Map will be redrawn on next tracking request.
      }
    }
  }
);

// ============================================================
// AUTO-TRACK FROM PUBLIC QR URL
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Always start the public portal on a clean Home view.
  // Tracking is opened only after an intentional user lookup.
  if (!window.location.pathname.startsWith("/admin")) {
    const homeTrackingInput =
      document.getElementById("home-tracking-input");

    const pageTrackingInput =
      document.getElementById("page-tracking-input");

    if (homeTrackingInput) {
      homeTrackingInput.value = "";
    }

    if (pageTrackingInput) {
      pageTrackingInput.value = "";
    }

    showSection("home");
  }

  const adminParams = new URLSearchParams(window.location.search);

  if (adminParams.get("admin") === "1") {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    try {
      if (
        typeof scheduleAdminRBACBootstrap === "function"
      ) {
        await scheduleAdminRBACBootstrap();
      }

      if (
        typeof loadAdminDashboard === "function"
      ) {
        await loadAdminDashboard();
      }

    } catch (error) {
      console.error(
        "[ADMIN REDIRECT]",
        error
      );
    }

    return;
  }


  try {
    const params = new URLSearchParams(window.location.search);
    const trackingNumber = (params.get("trk") || "").trim();

    if (!trackingNumber) {
      const homeInput =
        document.getElementById("home-tracking-input");

      const pageInput =
        document.getElementById("page-tracking-input");

      if (homeInput) {
        homeInput.value = "";
      }

      if (pageInput) {
        pageInput.value = "";
      }

      showSection("home");
      return;
    }

    const input =
      document.getElementById("home-tracking-input") ||
      document.getElementById("page-tracking-input");

    if (!input) {
      console.warn(
        "[QR] Tracking input not found."
      );
      return;
    }

    input.value = trackingNumber;

    const form = input.closest("form");

    if (form) {
      handleTrackSubmit(
        {
          preventDefault() {}
        },
        input.id
      );
    } else {
      console.warn(
        "[QR] Tracking form not found."
      );
    }
  } catch (error) {
    console.warn(
      "[QR] Automatic tracking failed:",
      error
    );
  }
});

