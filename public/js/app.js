// ============================================================
// US COURIER — GEOGRAPHIC ROUTE MAP
// ============================================================

const COURIER_GEO = {
  // Common US locations
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

  // International locations commonly used by US COURIER
  "lagos": [6.5244, 3.3792],
  "lagos, nigeria": [6.5244, 3.3792],
  "london": [51.5074, -0.1278],
  "london, uk": [51.5074, -0.1278],
  "toronto": [43.6532, -79.3832],
  "toronto, canada": [43.6532, -79.3832],
  "vancouver": [49.2827, -123.1207],
  "vancouver, canada": [49.2827, -123.1207],
  "taipei": [25.0330, 121.5654],
  "taipei, taiwan": [25.0330, 121.5654],
  "tokyo": [35.6762, 139.6503],
  "tokyo, japan": [35.6762, 139.6503]
};

function resolveGeoLocation(location) {
  if (!location) return null;

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

function projectGeo(lat, lon, bounds, width, height, padding = 45) {
  const x =
    padding +
    ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) *
      (width - padding * 2);

  const y =
    height -
    padding -
    ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) *
      (height - padding * 2);

  return { x, y };
}

function drawRouteLine(ctx, points) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;

    ctx.quadraticCurveTo(
      midX,
      midY - Math.min(55, Math.abs(current.x - previous.x) * 0.10),
      current.x,
      current.y
    );
  }

  ctx.strokeStyle = "rgba(232, 168, 124, 0.25)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;

    ctx.quadraticCurveTo(
      midX,
      midY - Math.min(55, Math.abs(current.x - previous.x) * 0.10),
      current.x,
      current.y
    );
  }

  ctx.strokeStyle = "#e8a87c";
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGeoNode(ctx, point, color, label, type = "normal") {
  const radius = type === "current" ? 7 : 5;

  // Glow for active shipment position
  if (type === "current") {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(52, 152, 219, 0.14)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(52, 152, 219, 0.30)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "11px Inter, Arial, sans-serif";
  ctx.fillStyle = "#f5f5f7";

  const textWidth = ctx.measureText(label).width;

  ctx.fillText(
    label,
    Math.max(8, Math.min(point.x - textWidth / 2, ctx.canvas.width - textWidth - 8)),
    point.y + 25
  );
}

function drawMapGrid(ctx, width, height, bounds) {
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;

  // Longitude grid
  for (
    let lon = Math.ceil(bounds.minLon / 10) * 10;
    lon <= bounds.maxLon;
    lon += 10
  ) {
    const p1 = projectGeo(bounds.minLat, lon, bounds, width, height);
    const p2 = projectGeo(bounds.maxLat, lon, bounds, width, height);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Latitude grid
  for (
    let lat = Math.ceil(bounds.minLat / 10) * 10;
    lat <= bounds.maxLat;
    lat += 10
  ) {
    const p1 = projectGeo(lat, bounds.minLon, bounds, width, height);
    const p2 = projectGeo(lat, bounds.maxLon, bounds, width, height);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

function drawGeoLandmass(ctx, width, height, bounds) {
  /*
   * Stylized North American land silhouette.
   * This is deliberately lightweight so the existing canvas
   * remains fast and does not require an external map library.
   */

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
    const p = projectGeo(lat, lon, bounds, width, height);

    if (index === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
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

function initMapCanvas(origin, current, destination, status) {
  const canvas = document.getElementById("liveMapCanvas");
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  const width = Math.max(320, container.clientWidth || 600);
  const height = Math.max(220, container.clientHeight || 300);

  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const originGeo = resolveGeoLocation(origin);
  const currentGeo = resolveGeoLocation(current);
  const destinationGeo = resolveGeoLocation(destination);

  /*
   * Default geographic view.
   * Covers most of North America while still allowing
   * international destinations such as Lagos to appear.
   */
  const locations = [
    originGeo,
    currentGeo,
    destinationGeo
  ].filter(Boolean);

  let bounds;

  if (locations.length) {
    const lats = locations.map(p => p.lat);
    const lons = locations.map(p => p.lon);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latPadding = Math.max(4, (maxLat - minLat) * 0.25);
    const lonPadding = Math.max(6, (maxLon - minLon) * 0.18);

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

  // Prevent a zero-size projection.
  if (bounds.maxLat === bounds.minLat) {
    bounds.maxLat += 1;
    bounds.minLat -= 1;
  }

  if (bounds.maxLon === bounds.minLon) {
    bounds.maxLon += 1;
    bounds.minLon -= 1;
  }

  const originPoint = originGeo
    ? projectGeo(originGeo.lat, originGeo.lon, bounds, width, height)
    : null;

  const currentPoint = currentGeo
    ? projectGeo(currentGeo.lat, currentGeo.lon, bounds, width, height)
    : null;

  const destinationPoint = destinationGeo
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
    ctx.clearRect(0, 0, width, height);

    // Map background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);

    gradient.addColorStop(0, "#160e0a");
    gradient.addColorStop(0.5, "#24160f");
    gradient.addColorStop(1, "#1a100c");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Geographic grid
    drawMapGrid(ctx, width, height, bounds);

    // Stylized landmass when viewing North America
    if (
      bounds.minLon < -60 &&
      bounds.maxLon > -130 &&
      bounds.maxLat > 35
    ) {
      drawGeoLandmass(ctx, width, height, bounds);
    }

    // Route
    drawRouteLine(ctx, routePoints);

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

    // Current shipment position
    if (currentPoint) {
      animation += 0.045;

      const pulse = 7 + Math.sin(animation) * 3;

      ctx.beginPath();
      ctx.arc(
        currentPoint.x,
        currentPoint.y,
        15 + pulse,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = "rgba(52,152,219,0.10)";
      ctx.fill();

      drawGeoNode(
        ctx,
        currentPoint,
        "#3498db",
        `Current · ${current || "Tracking"}`,
        "current"
      );
    }

    // Map status label
    ctx.font = "10px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.fillText(
      `LIVE ROUTE · ${(status || "TRACKING").toUpperCase()}`,
      16,
      20
    );

    // Coordinate information
    if (currentGeo) {
      const coordText =
        `${currentGeo.lat.toFixed(4)}°, ${currentGeo.lon.toFixed(4)}°`;

      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.fillText(coordText, 16, height - 16);
    }

    if (!document.hidden) animationFrameId = requestAnimationFrame(draw);
  }

  draw();
}
/* ============================================================
   US COURIER — TRACKING API + GPS MAP CONNECTION
   ============================================================ */

function setTrackingText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function formatTrackingDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getLatestGpsEvent(events) {
  if (!Array.isArray(events)) return null;

  const gpsEvents = events
    .filter(e =>
      e &&
      e.latitude !== null &&
      e.latitude !== undefined &&
      e.longitude !== null &&
      e.longitude !== undefined
    )
    .sort((a, b) =>
      new Date(b.event_time || b.created_at || 0) -
      new Date(a.event_time || a.created_at || 0)
    );

  return gpsEvents[0] || null;
}

function updateTrackingTimeline(events) {
  const container = document.getElementById("timeline-container");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(events) || events.length === 0) {
    container.innerHTML =
      '<div class="timeline-item"><strong>No tracking events recorded.</strong></div>';
    return;
  }

  [...events]
    .sort((a, b) =>
      new Date(a.event_time || a.created_at || 0) -
      new Date(b.event_time || b.created_at || 0)
    )
    .forEach((event, index, list) => {
      const item = document.createElement("div");
      item.className = "timeline-item";

      const location = event.location || "Location unavailable";
      const description = event.description || "";
      const date = formatTrackingDate(event.event_time || event.created_at);

      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <strong>${event.status || "Shipment Update"}</strong>
          <div style="color:var(--text-muted);font-size:.82rem;margin:.25rem 0;">
            ${location}
          </div>
          ${description ? `<div style="font-size:.85rem;">${description}</div>` : ""}
          <small style="color:var(--text-muted);">${date}</small>
        </div>
      `;

      container.appendChild(item);
    });
}

async function handleTrackSubmit(event, inputId) {
  if (event) event.preventDefault();

  const input = document.getElementById(inputId);
  const trackingNumber = input ? input.value.trim() : "";

  if (!trackingNumber) return;

  const loading = document.getElementById("tracking-loading");
  const error = document.getElementById("tracking-error");
  const results = document.getElementById("tracking-results");

  if (loading) loading.style.display = "block";
  if (error) {
    error.style.display = "none";
    error.textContent = "";
  }
  if (results) results.style.display = "none";

  try {
    const response = await fetch(
      `/api/tracking/${encodeURIComponent(trackingNumber)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success || !data.shipment) {
      throw new Error(data.message || "Shipment not found.");
    }

    const shipment = data.shipment;
    const events = Array.isArray(data.events) ? data.events : [];

    const latestGps = getLatestGpsEvent(events);

    /*
     * Prefer the latest real GPS event.
     * If no GPS event exists, initMapCanvas will use
     * the existing city/location coordinate resolver.
     */
    const isDelivered = String(shipment.status || "").toLowerCase().includes("delivered");

    const mapCurrent = isDelivered
      ? shipment.current_location
      : latestGps
        ? {
            label: latestGps.location || shipment.current_location,
            lat: Number(latestGps.latitude),
            lon: Number(latestGps.longitude)
          }
        : shipment.current_location;

    setTrackingText("tel-origin", shipment.origin);
    setTrackingText("tel-current", shipment.current_location);
    setTrackingText("tel-destination", shipment.destination);
    setTrackingText(
      "tel-eta",
      formatTrackingDate(shipment.estimated_delivery)
    );

    setTrackingText("trk-number-val", shipment.tracking_number);
    setTrackingText("trk-service-val", shipment.service_type);
    setTrackingText("trk-sender-val", shipment.sender_name);
    setTrackingText("trk-recipient-val", shipment.recipient_name);

    setTrackingText(
      "trk-pkg-val",
      `${shipment.package_count || 1} / ${
        shipment.weight_kg ? shipment.weight_kg + " kg" : "—"
      }`
    );

    setTrackingText(
      "trk-val-val",
      shipment.declared_value !== null &&
      shipment.declared_value !== undefined
        ? `${shipment.currency || ""} ${shipment.declared_value}`
        : "—"
    );

    setTrackingText("trk-desc-val", shipment.description || "—");

    const badge = document.getElementById("trk-status-badge");
    if (badge) {
      badge.textContent = shipment.status || "Tracking";
      badge.className = "badge badge-transit";

      const status = String(shipment.status || "").toLowerCase();

      if (status.includes("delivered")) {
        badge.className = "badge badge-delivered";
      } else if (
        status.includes("delay") ||
        status.includes("exception")
      ) {
        badge.className = "badge badge-delayed";
      }
    }

    updateTrackingTimeline(events);

    if (results) results.style.display = "block";
    if (loading) loading.style.display = "none";

    /*
     * Initialize the geographic route map.
     */
    requestAnimationFrame(() => {
      if (latestGps) {
        initMapCanvasWithGps(
          shipment.origin,
          mapCurrent,
          shipment.destination,
          shipment.status
        );
      } else {
        initMapCanvas(
          shipment.origin,
          shipment.current_location,
          shipment.destination,
          shipment.status
        );
      }
    });

    // Keep tracking number available to the URL.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("trk", shipment.tracking_number);
      window.history.replaceState({}, "", url);
    } catch (_) {}

  } catch (err) {
    console.error("[TRACKING]", err);

    if (loading) loading.style.display = "none";

    if (error) {
      error.textContent = err.message || "Unable to retrieve shipment.";
      error.style.display = "block";
    }
  }
}


/* ============================================================
   GPS-AWARE MAP WRAPPER
   ============================================================ */

function initMapCanvasWithGps(origin, current, destination, status) {
  initMapCanvas(origin, current, destination, status);
}

function showSection(section) {
  document.querySelectorAll("section[id^='view-']").forEach(el => {
    el.style.display = "none";
  });

  const target = document.getElementById("view-" + section);
  if (target) {
    target.style.display = "block";
  }

  document.querySelectorAll("nav a").forEach(a => {
    a.classList.remove("active");
  });

  const nav = document.getElementById("nav-" + section);
  if (nav) nav.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

