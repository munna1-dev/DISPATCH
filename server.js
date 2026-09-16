"use strict";

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const { contactEmailTemplate } = require("./utils/emailTemplate");
const { sendContactReply } = require("./emailService");
const { Resend } = require("resend");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[AUTH] JWT_SECRET is not configured.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("[DATABASE] DATABASE_URL is not configured.");
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.warn("[EMAIL] RESEND_API_KEY is not configured.");
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// ============================================================
// DATABASE
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase PostgreSQL requires SSL.
  // In production, certificate verification should ideally use
  // a trusted CA certificate rather than rejectUnauthorized:false.
  ssl: IS_PRODUCTION
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: false },

  max: 2,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
  console.error("[DATABASE] Pool error:", err.message);
});

async function testDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  console.log(
    "[DATABASE] Supabase PostgreSQL connected:",
    result.rows[0].now
  );
}


// ============================================================
// ADMIN AUDIT LOG HELPER
// ============================================================

async function logAdminAction({
  adminId = null,
  adminEmail = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ipAddress = null
}) {
  try {
    if (!action) return;

    await queryWithRetry(
      `
      INSERT INTO admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_type,
        target_id,
        details,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        adminId,
        adminEmail,
        String(action).slice(0, 100),
        targetType ? String(targetType).slice(0, 50) : null,
        targetId ? String(targetId).slice(0, 100) : null,
        details ? String(details).slice(0, 2000) : null,
        ipAddress ? String(ipAddress).slice(0, 100) : null
      ]
    );
  } catch (err) {
    // Never break the main request because of logging
    console.error("[AUDIT LOG]", err.message);
  }
}

async function queryWithRetry(text, values = [], retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pool.query(text, values);
    } catch (error) {
      lastError = error;

      const retryableCodes = [
        "EAI_AGAIN",
        "ECONNRESET",
        "ECONNABORTED",
        "ETIMEDOUT",
        "ECONNREFUSED"
      ];

      if (
        !retryableCodes.includes(error.code) ||
        attempt === retries
      ) {
        throw error;
      }

      const delay = 500 * (attempt + 1);

      console.warn(
        `[DATABASE] Transient error ${error.code}; retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================
// SECURITY HELPERS
// ============================================================

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_ATTEMPTS = 5;

const TRACKING_WINDOW_MS = 60 * 1000;
const TRACKING_MAX_ATTEMPTS = 60;

const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

function rateLimit(keyPrefix, windowMs, maxAttempts) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${getClientIp(req)}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now - entry.start > windowMs) {
      entry = {
        start: now,
        count: 0
      };
    }

    entry.count += 1;
    rateLimitStore.set(key, entry);

    if (entry.count > maxAttempts) {
      const retryAfter = Math.ceil(
        (windowMs - (now - entry.start)) / 1000
      );

      res.setHeader("Retry-After", String(retryAfter));

      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later."
      });
    }

    next();
  };
}

// Clean old in-memory rate-limit entries periodically.
setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore.entries()) {
    if (
      now - entry.start > Math.max(
        LOGIN_WINDOW_MS,
        CONTACT_WINDOW_MS,
        TRACKING_WINDOW_MS
      )
    ) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

function requireSameOrigin(req, res, next) {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  const allowedOrigins = new Set([
    "https://uscourier.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);

  if (!allowedOrigins.has(origin)) {
    return res.status(403).json({
      success: false,
      error: "Invalid request origin."
    });
  }

  next();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanString(value, maxLength = 500) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
}

function validPositiveNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

function validPositiveInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > 100000
  ) {
    return null;
  }

  return number;
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return value;
}

const ALLOWED_SERVICES = [
  "Express Air Freight",
  "Standard Ground Express",
  "Priority Ocean Container"
];

const ALLOWED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "TWD"
];

const ALLOWED_STATUSES = [
  "Shipment Created",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Customs Hold",
  "Delayed",
  "CUSTOM"
];

function isValidStatus(status) {
  return ALLOWED_STATUSES.includes(status);
}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  cors({
    origin: "https://uscourier.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb"
  })
);

app.use(cookieParser());

app.use(
  express.static(path.join(__dirname, "public"))
);

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.json({
      success: true,
      status: "online",
      database: "connected",
      service: "US COURIER API",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[HEALTH]", error.message);

    return res.status(503).json({
      success: false,
      status: "degraded",
      database: "disconnected",
      service: "US COURIER API",
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================
// PUBLIC TRACKING
// ============================================================

app.get(
  "/api/tracking/:trackingNumber",
  rateLimit(
    "tracking",
    TRACKING_WINDOW_MS,
    TRACKING_MAX_ATTEMPTS
  ),
  async (req, res) => {
    const trackingNumber = cleanString(
      req.params.trackingNumber,
      100
    );

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        message: "Tracking number required"
      });
    }

    try {
      /*
       * IMPORTANT:
       * Do not expose SELECT * from the public tracking endpoint.
       *
       * Private information such as:
       * - sender_name
       * - recipient_name
       * - declared_value
       * - currency
       * - exact coordinates
       * - internal IDs
       * must remain private.
       */

      const shipmentResult = await queryWithRetry(
        `
        SELECT
          tracking_number,
          reference,
          status,
          service_type,
          priority,
          sender_name,
          sender_country,
          recipient_name,
          recipient_country,
          origin,
          current_location,
          destination,
          estimated_delivery,
          package_count,
          weight AS weight_kg,
          currency,
          declared_value,
          description
        FROM shipments
        WHERE tracking_number = $1
        LIMIT 1
        `,
        [trackingNumber]
      );

      if (shipmentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Shipment not found"
        });
      }

      const eventsResult = await queryWithRetry(
        `
        SELECT
          status,
          location,
          description,
          event_time
        FROM shipment_events
        WHERE shipment_id = (
          SELECT id
          FROM shipments
          WHERE tracking_number = $1
          LIMIT 1
        )
        ORDER BY event_time ASC
        `,
        [trackingNumber]
      );

      return res.json({
        success: true,
        shipment: shipmentResult.rows[0],
        events: eventsResult.rows
      });
    } catch (error) {
      console.error("[TRACKING]", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve tracking information"
      });
    }
  }
);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function authMiddleware(req, res, next) {
  let token = req.cookies.us_courier_token;

  if (!token) {
    const header = req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

// ============================================================
// ADMIN AUTHORIZATION
// ============================================================

async function adminMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    /*
     * Do not trust the role stored inside the JWT alone.
     * Re-check the database on every admin request.
     */

    const result = await queryWithRetry(
      `
      SELECT id, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "User account not found"
      });
    }

    const user = result.rows[0];

    if (user.role !== "Admin") {
      return res.status(403).json({
        error: "Administrator privileges required"
      });
    }

    req.admin = user;

    next();
  } catch (error) {
    console.error("[ADMIN AUTH]", error.message);

    return res.status(500).json({
      error: "Authorization check failed"
    });
  }
}

// ============================================================
// AUTH LOGIN
// ============================================================

app.post(
  "/api/auth/login",
  requireSameOrigin,
  rateLimit(
    "login",
    LOGIN_WINDOW_MS,
    LOGIN_MAX_ATTEMPTS
  ),
  async (req, res) => {
    try {
      const email = cleanString(req.body?.email, 254)
        .toLowerCase();

      const password = String(
        req.body?.password || ""
      );

      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password required"
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          error: "Invalid email address"
        });
      }

      const result = await queryWithRetry(
        `
        SELECT
          id,
          email,
          role,
          password_hash
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: "Invalid Operator Credentials"
        });
      }

      const user = result.rows[0];

      if (!user.password_hash) {
        return res.status(401).json({
          error: "Invalid Operator Credentials"
        });
      }

      /*
       * Prevent a missing database role from automatically
       * becoming Administrator.
       */
      if (user.role !== "Admin") {
        return res.status(403).json({
          error: "Administrator privileges required"
        });
      }

      const match = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!match) {
        return res.status(401).json({
          error: "Invalid Operator Credentials"
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        JWT_SECRET,
        {
          expiresIn: "12h"
        }
      );

      res.cookie("us_courier_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 12 * 60 * 60 * 1000,
        path: "/"
      });

      /*
       * Token is intentionally NOT returned to JavaScript.
       * Authentication is handled by the HttpOnly cookie.
       */

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      console.error("[AUTH LOGIN]", err.message);

      return res.status(500).json({
        error: "Login failed"
      });
    }
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.post(
  "/api/auth/logout",
  requireSameOrigin,
  (req, res) => {
    res.clearCookie("us_courier_token", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });

    return res.json({
      success: true,
      message: "Logged out successfully"
    });
  }
);

// ============================================================
// ADMIN DASHBOARD
// ============================================================

app.get(
  "/api/admin/dashboard",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const counts = await queryWithRetry(`
        SELECT
          (
            SELECT COUNT(*)
            FROM shipments
          ) AS total,

          (
            SELECT COUNT(*)
            FROM shipments
            WHERE status ILIKE '%transit%'
          ) AS in_transit,

          (
            SELECT COUNT(*)
            FROM shipments
            WHERE status ILIKE '%delivered%'
          ) AS delivered,

          (
            SELECT COUNT(*)
            FROM shipments
            WHERE
              status ILIKE '%pending%'
              OR status ILIKE '%exception%'
              OR status ILIKE '%delay%'
              OR status ILIKE '%held%'
              OR status ILIKE '%failed%'
          ) AS pending_exceptions,

          (
            SELECT COUNT(*)
            FROM users
            WHERE LOWER(
              COALESCE(NULLIF(TRIM(role), ''), 'Customer')
            ) <> 'admin'
          ) AS customers,

          (
            SELECT COUNT(*)
            FROM contact_messages
          ) AS messages,

          (
            SELECT COUNT(*)
            FROM contact_messages
            WHERE LOWER(COALESCE(status, '')) = 'unread'
          ) AS unread_messages
      `);

      return res.json({
        success: true,
        counts: counts.rows[0]
      });
    } catch (err) {
      console.error(
        "[ADMIN DASHBOARD]",
        err.message
      );

      return res.status(500).json({
        error: "Failed to load dashboard"
      });
    }
  }
);

// ============================================================
// ADMIN CUSTOMERS - LIST
// ============================================================

app.get(
  "/api/admin/customers",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(`
        SELECT
          id,
          name,
          email,
          COALESCE(NULLIF(TRIM(role), ''), 'Customer') AS role,
          created_at
        FROM users
        WHERE LOWER(COALESCE(NULLIF(TRIM(role), ''), 'Customer')) <> 'admin'
        ORDER BY created_at DESC
        LIMIT 500
      `);

      return res.json({
        success: true,
        customers: result.rows
      });
    } catch (err) {
      console.error(
        "[ADMIN CUSTOMERS]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to load customers"
      });
    }
  }
);

// ============================================================
// ADMIN SHIPMENTS - LIST
// ============================================================

app.get(
  "/api/admin/shipments",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          tracking_number,
          reference,
          status,
          service_type,
          priority,
          sender_name,
          sender_country,
          recipient_name,
          recipient_country,
          origin,
          destination,
          current_location,
          estimated_delivery,
          package_count,
          weight,
          currency,
          declared_value,
          description,
          created_at,
          updated_at
        FROM shipments
        ORDER BY created_at DESC
        LIMIT 100
        `
      );

      return res.json({
        success: true,
        shipments: result.rows
      });
    } catch (err) {
      console.error(
        "[ADMIN SHIPMENTS]",
        err.message
      );

      return res.status(500).json({
        error: "Failed to load shipments"
      });
    }
  }
);

// ============================================================
// ADMIN SHIPMENTS - CREATE
// ============================================================

app.post(
  "/api/admin/shipments",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const b = req.body || {};

    const senderName = cleanString(
      b.sender_name,
      200
    );

    const recipientName = cleanString(
      b.recipient_name,
      200
    );

    const origin = cleanString(
      b.origin,
      300
    );

    const destination = cleanString(
      b.destination,
      300
    );

    const serviceType = cleanString(
      b.service_type,
      100
    );

    if (
      !senderName ||
      !recipientName ||
      !origin ||
      !destination ||
      !serviceType
    ) {
      return res.status(400).json({
        success: false,
        error: "Required shipment fields are missing."
      });
    }

    if (!ALLOWED_SERVICES.includes(serviceType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid service type."
      });
    }

    const packageCount =
      validPositiveInteger(b.package_count) ?? 1;

    const weight =
      validPositiveNumber(b.weight);

    const declaredValue =
      validPositiveNumber(b.declared_value);

    const estimatedDelivery =
      validDate(b.estimated_delivery);

    if (
      b.weight !== undefined &&
      b.weight !== null &&
      b.weight !== "" &&
      weight === null
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid shipment weight."
      });
    }

    if (
      b.declared_value !== undefined &&
      b.declared_value !== null &&
      b.declared_value !== "" &&
      declaredValue === null
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid declared value."
      });
    }

    if (
      b.estimated_delivery &&
      !estimatedDelivery
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid estimated delivery date."
      });
    }

    const currency =
      cleanString(b.currency, 10) || "USD";

    if (!ALLOWED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        success: false,
        error: "Invalid currency."
      });
    }

    const senderCountry = cleanString(
      b.sender_country,
      100
    ) || null;

    const recipientCountry = cleanString(
      b.recipient_country,
      100
    ) || null;

    const description =
      cleanString(b.description, 2000) || null;

    const c = await pool.connect();

    try {
      await c.query("BEGIN");

      const n =
        "USC-" +
        new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "") +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10)
          .toUpperCase();

      const q = await c.query(
        `
        INSERT INTO shipments
        (
          tracking_number,
          origin,
          destination,
          service_type,
          status,
          current_location,
          estimated_delivery,
          weight,
          package_count,
          description,
          sender_name,
          sender_country,
          recipient_name,
          recipient_country,
          currency,
          declared_value
        )
        VALUES
        (
          $1,$2,$3,$4,
          'Shipment Created',
          $2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        RETURNING
          id,
          tracking_number,
          reference,
          status,
          service_type,
          priority,
          sender_name,
          sender_country,
          recipient_name,
          recipient_country,
          origin,
          destination,
          current_location,
          estimated_delivery,
          package_count,
          weight,
          currency,
          declared_value,
          description,
          created_at,
          updated_at
        `,
        [
          n,
          origin,
          destination,
          serviceType,
          estimatedDelivery,
          weight,
          packageCount,
          description,
          senderName,
          senderCountry,
          recipientName,
          recipientCountry,
          currency,
          declaredValue
        ]
      );

      const shipment = q.rows[0];

      await c.query(
        `
        INSERT INTO shipment_events
        (
          shipment_id,
          status,
          location,
          description
        )
        VALUES ($1,$2,$3,$4)
        `,
        [
          shipment.id,
          shipment.status,
          shipment.current_location,
          "Shipment created"
        ]
      );

      await c.query("COMMIT");

      return res.status(201).json({
        success: true,
        tracking_number: shipment.tracking_number,
        shipment
      });
    } catch (e) {
      await c.query("ROLLBACK");

      console.error(
        "[CREATE SHIPMENT]",
        e.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to create shipment."
      });
    } finally {
      c.release();
    }
  }
);



// ============================================================
// ADMIN SHIPMENTS - DELETE
// ============================================================

app.delete(
  "/api/admin/shipments/:id",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const shipmentId = Number(req.params.id);

    if (!Number.isInteger(shipmentId) || shipmentId < 1) {
      return res.status(400).json({
        success: false,
        error: "Invalid shipment ID."
      });
    }

    const c = await pool.connect();

    try {
      await c.query("BEGIN");

      const existing = await c.query(
        `
        SELECT
          id,
          tracking_number
        FROM shipments
        WHERE id = $1
        FOR UPDATE
        `,
        [shipmentId]
      );

      if (!existing.rowCount) {
        await c.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          error: "Shipment not found."
        });
      }

      const shipment = existing.rows[0];

      await c.query(
        `
        DELETE FROM shipments
        WHERE id = $1
        `,
        [shipmentId]
      );

      await c.query("COMMIT");

      return res.json({
        success: true,
        message: "Shipment deleted successfully.",
        tracking_number: shipment.tracking_number
      });

    } catch (e) {
      await c.query("ROLLBACK");

      console.error(
        "[DELETE SHIPMENT]",
        e.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to delete shipment."
      });

    } finally {
      c.release();
    }
  }
);

// ============================================================
// SITE SETTINGS - ADMIN
// ============================================================

const ALLOWED_SETTING_KEYS = new Set([
  "company",
  "contact",
  "tracking",
  "shipment",
  "receipt",
  "qr",
  "notifications",
  "website",
  "footer",
  "maintenance"
]);

const PUBLIC_SETTING_KEYS = new Set([
  "company",
  "contact",
  "tracking",
  "receipt",
  "qr",
  "website",
  "footer",
  "maintenance"
]);

function normalizeSettingsObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      continue;
    }

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (typeof value === "object" && !Array.isArray(value))
    ) {
      output[key] = value;
    }
  }

  return output;
}

app.get(
  "/api/admin/settings",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          setting_key,
          setting_value,
          is_public,
          updated_by,
          created_at,
          updated_at
        FROM site_settings
        WHERE setting_key = ANY($1::text[])
        ORDER BY setting_key ASC
        `,
        [Array.from(ALLOWED_SETTING_KEYS)]
      );

      const settings = {};

      for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value;
      }

      return res.json({
        success: true,
        settings,
        metadata: result.rows.map((row) => ({
          setting_key: row.setting_key,
          is_public: row.is_public,
          updated_by: row.updated_by,
          updated_at: row.updated_at
        }))
      });
    } catch (error) {
      console.error("[ADMIN SETTINGS GET]", error.message);

      return res.status(500).json({
        success: false,
        error: "Failed to load site settings."
      });
    }
  }
);

app.put(
  "/api/admin/settings",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const settings = normalizeSettingsObject(
      req.body?.settings
    );

    if (Object.keys(settings).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid settings were provided."
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const [settingKey, settingValue] of Object.entries(settings)) {
        const isPublic =
          PUBLIC_SETTING_KEYS.has(settingKey);

        await client.query(
          `
          INSERT INTO site_settings
          (
            setting_key,
            setting_value,
            is_public,
            updated_by,
            updated_at
          )
          VALUES ($1, $2::jsonb, $3, $4, NOW())
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            is_public = EXCLUDED.is_public,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
          `,
          [
            settingKey,
            JSON.stringify(settingValue),
            isPublic,
            req.admin.id
          ]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Site settings saved successfully.",
        settings
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("[ADMIN SETTINGS SAVE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Failed to save site settings."
      });
    } finally {
      client.release();
    }
  }
);

// ============================================================
// ADMIN USER MANAGEMENT
// ============================================================

const ADMIN_ALLOWED_ROLES = new Set([
  "Admin",
  "Operations Manager",
  "Dispatcher",
  "Driver",
  "Trunk Driver",
  "Cargo Personnel",
  "Warehouse Personnel",
  "Customer Service",
  "Customer"
]);

function normalizeAdminRole(value) {
  const role = cleanString(value, 50);

  if (!ADMIN_ALLOWED_ROLES.has(role)) {
    return null;
  }

  return role;
}

function validateAdminUserName(value) {
  const name = cleanString(value, 120);

  if (!name) {
    return "Name is required.";
  }

  if (name.length < 2) {
    return "Name must contain at least 2 characters.";
  }

  return null;
}

function validateAdminPassword(value) {
  const password = String(value || "");

  if (!password) {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Password must contain at least 8 characters.";
  }

  if (password.length > 200) {
    return "Password is too long.";
  }

  return null;
}


// ------------------------------------------------------------
// LIST USERS
// ------------------------------------------------------------

app.get(
  "/api/admin/users",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        ORDER BY created_at DESC, id DESC
        LIMIT 1000
        `
      );

      return res.json({
        success: true,
        users: result.rows
      });
    } catch (error) {
      console.error("[ADMIN USERS GET]", error.message);

      return res.status(500).json({
        success: false,
        error: "Failed to load users."
      });
    }
  }
);


// ------------------------------------------------------------
// CREATE USER
// ------------------------------------------------------------

app.post(
  "/api/admin/users",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    try {
      const name = cleanString(req.body?.name, 120);
      const email = cleanString(req.body?.email, 254)
        .toLowerCase();
      const password = String(req.body?.password || "");
      const role = normalizeAdminRole(
        req.body?.role || "Customer"
      );

      const nameError = validateAdminUserName(name);

      if (nameError) {
        return res.status(400).json({
          success: false,
          error: nameError
        });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: "A valid email address is required."
        });
      }

      const passwordError =
        validateAdminPassword(password);

      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError
        });
      }

      if (!role) {
        return res.status(400).json({
          success: false,
          error: "Invalid user role."
        });
      }

      const existing = await queryWithRetry(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: "A user with this email address already exists."
        });
      }

      const passwordHash =
        await bcrypt.hash(password, 12);

      /*
       * users.id is a PostgreSQL identity column.
       * Do not supply id here; PostgreSQL generates it.
       */

      const result = await queryWithRetry(
        `
        INSERT INTO users
        (
          name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          name,
          email,
          role,
          created_at
        `,
        [
          name,
          email,
          passwordHash,
          role
        ]
      );

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "user.create",
        targetType: "user",
        targetId: result.rows[0]?.id,
        details: JSON.stringify({
          name,
          email,
          role
        }),
        ipAddress: req.ip || null
      });

      return res.status(201).json({
        success: true,
        message: "User created successfully.",
        user: result.rows[0]
      });
    } catch (error) {
      console.error("[ADMIN USER CREATE]", error.message);

      if (
        error.code === "23505" &&
        error.constraint === "users_email_key"
      ) {
        return res.status(409).json({
          success: false,
          error: "A user with this email address already exists."
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to create user."
      });
    }
  }
);


// ------------------------------------------------------------
// EDIT USER
// ------------------------------------------------------------

app.put(
  "/api/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const userId = Number(req.params.id);

    if (
      !Number.isSafeInteger(userId) ||
      userId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID."
      });
    }

    try {
      const name = cleanString(req.body?.name, 120);
      const email = cleanString(req.body?.email, 254)
        .toLowerCase();

      const nameError = validateAdminUserName(name);

      if (nameError) {
        return res.status(400).json({
          success: false,
          error: nameError
        });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: "A valid email address is required."
        });
      }

      const existing = await queryWithRetry(
        `
        SELECT id, role
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found."
        });
      }

      const duplicate = await queryWithRetry(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
          AND id <> $2
        LIMIT 1
        `,
        [email, userId]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: "Another user already uses this email address."
        });
      }

      const result = await queryWithRetry(
        `
        UPDATE users
        SET
          name = $1,
          email = $2
        WHERE id = $3
        RETURNING
          id,
          name,
          email,
          role,
          created_at
        `,
        [
          name,
          email,
          userId
        ]
      );

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "user.update",
        targetType: "user",
        targetId: result.rows[0]?.id,
        details: JSON.stringify({
          name,
          email
        }),
        ipAddress: req.ip || null
      });

      return res.json({
        success: true,
        message: "User updated successfully.",
        user: result.rows[0]
      });
    } catch (error) {
      console.error("[ADMIN USER UPDATE]", error.message);

      if (
        error.code === "23505" &&
        error.constraint === "users_email_key"
      ) {
        return res.status(409).json({
          success: false,
          error: "Another user already uses this email address."
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to update user."
      });
    }
  }
);


// ------------------------------------------------------------
// CHANGE USER ROLE
// ------------------------------------------------------------

app.put(
  "/api/admin/users/:id/role",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const userId = Number(req.params.id);

    if (
      !Number.isSafeInteger(userId) ||
      userId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID."
      });
    }

    const role = normalizeAdminRole(
      req.body?.role
    );

    if (!role) {
      return res.status(400).json({
        success: false,
        error: "Invalid user role."
      });
    }

    try {
      const targetResult = await queryWithRetry(
        `
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (targetResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found."
        });
      }

      const target = targetResult.rows[0];

      /*
       * The current administrator cannot remove their own
       * Administrator privileges through this endpoint.
       */

      if (
        Number(req.admin.id) === userId &&
        role !== "Admin"
      ) {
        return res.status(400).json({
          success: false,
          error: "You cannot remove your own Administrator role."
        });
      }

      /*
       * Prevent the system from being left without an Admin.
       */

      if (
        target.role === "Admin" &&
        role !== "Admin"
      ) {
        const adminCountResult =
          await queryWithRetry(
            `
            SELECT COUNT(*)::int AS count
            FROM users
            WHERE role = 'Admin'
            `
          );

        const adminCount =
          Number(adminCountResult.rows[0]?.count || 0);

        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            error: "The last Administrator cannot be downgraded."
          });
        }
      }

      const result = await queryWithRetry(
        `
        UPDATE users
        SET role = $1
        WHERE id = $2
        RETURNING
          id,
          name,
          email,
          role,
          created_at
        `,
        [
          role,
          userId
        ]
      );

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "user.role_change",
        targetType: "user",
        targetId: result.rows[0]?.id,
        details: JSON.stringify({
          fromRole: target.role,
          toRole: role
        }),
        ipAddress: req.ip || null
      });

      return res.json({
        success: true,
        message: "User role updated successfully.",
        user: result.rows[0]
      });
    } catch (error) {
      console.error("[ADMIN USER ROLE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Failed to change user role."
      });
    }
  }
);


// ------------------------------------------------------------
// RESET USER PASSWORD
// ------------------------------------------------------------

app.post(
  "/api/admin/users/:id/reset-password",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const userId = Number(req.params.id);

    if (
      !Number.isSafeInteger(userId) ||
      userId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID."
      });
    }

    try {
      const password =
        String(req.body?.password || "");

      const passwordError =
        validateAdminPassword(password);

      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError
        });
      }

      const target = await queryWithRetry(
        `
        SELECT id, role
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (target.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "User not found."
        });
      }

      /*
       * Password changes are hashed on the server.
       * The plaintext password is never stored.
       */

      const passwordHash =
        await bcrypt.hash(password, 12);

      await queryWithRetry(
        `
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
        `,
        [
          passwordHash,
          userId
        ]
      );

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "user.password_reset",
        targetType: "user",
        targetId: userId,
        details: JSON.stringify({
          targetUserId: userId
        }),
        ipAddress: req.ip || null
      });

      return res.json({
        success: true,
        message: "User password reset successfully."
      });
    } catch (error) {
      console.error(
        "[ADMIN USER PASSWORD RESET]",
        error.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to reset user password."
      });
    }
  }
);


// ------------------------------------------------------------
// ADMIN PROFILE
// ------------------------------------------------------------

app.get(
  "/api/admin/profile",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          name,
          email,
          role,
          created_at
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [req.admin.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Administrator account not found."
        });
      }

      return res.json({
        success: true,
        profile: result.rows[0]
      });
    } catch (error) {
      console.error("[ADMIN PROFILE GET]", error.message);

      return res.status(500).json({
        success: false,
        error: "Failed to load administrator profile."
      });
    }
  }
);


// ------------------------------------------------------------
// UPDATE ADMIN PROFILE
// ------------------------------------------------------------

app.put(
  "/api/admin/profile",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    try {
      const name = cleanString(req.body?.name, 120);
      const email = cleanString(req.body?.email, 254)
        .toLowerCase();

      const nameError = validateAdminUserName(name);

      if (nameError) {
        return res.status(400).json({
          success: false,
          error: nameError
        });
      }

      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: "A valid email address is required."
        });
      }

      const duplicate = await queryWithRetry(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
          AND id <> $2
        LIMIT 1
        `,
        [
          email,
          req.admin.id
        ]
      );

      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: "Another user already uses this email address."
        });
      }

      const result = await queryWithRetry(
        `
        UPDATE users
        SET
          name = $1,
          email = $2
        WHERE id = $3
          AND role = 'Admin'
        RETURNING
          id,
          name,
          email,
          role,
          created_at
        `,
        [
          name,
          email,
          req.admin.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Administrator account not found."
        });
      }

      /*
       * The current JWT may contain the old email.
       * The database remains the source of truth for admin
       * authorization, so no new token is issued here.
       */

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "admin.profile_update",
        targetType: "admin",
        targetId: result.rows[0]?.id,
        details: JSON.stringify({
          name,
          email
        }),
        ipAddress: req.ip || null
      });

      return res.json({
        success: true,
        message: "Administrator profile updated successfully.",
        profile: result.rows[0]
      });
    } catch (error) {
      console.error("[ADMIN PROFILE UPDATE]", error.message);

      if (
        error.code === "23505" &&
        error.constraint === "users_email_key"
      ) {
        return res.status(409).json({
          success: false,
          error: "Another user already uses this email address."
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to update administrator profile."
      });
    }
  }
);


// ------------------------------------------------------------
// CHANGE ADMIN PASSWORD
// ------------------------------------------------------------

app.put(
  "/api/admin/profile/password",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    try {
      const currentPassword =
        String(req.body?.currentPassword || "");

      const newPassword =
        String(req.body?.newPassword || "");

      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: "Current password is required."
        });
      }

      const passwordError =
        validateAdminPassword(newPassword);

      if (passwordError) {
        return res.status(400).json({
          success: false,
          error: passwordError
        });
      }

      const result = await queryWithRetry(
        `
        SELECT
          id,
          password_hash
        FROM users
        WHERE id = $1
          AND role = 'Admin'
        LIMIT 1
        `,
        [req.admin.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Administrator account not found."
        });
      }

      const adminUser = result.rows[0];

      const currentMatches =
        await bcrypt.compare(
          currentPassword,
          adminUser.password_hash
        );

      if (!currentMatches) {
        return res.status(401).json({
          success: false,
          error: "Current password is incorrect."
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          error: "New password must be different from the current password."
        });
      }

      const passwordHash =
        await bcrypt.hash(newPassword, 12);

      await queryWithRetry(
        `
        UPDATE users
        SET password_hash = $1
        WHERE id = $2
          AND role = 'Admin'
        `,
        [
          passwordHash,
          req.admin.id
        ]
      );

      /*
       * Force a fresh login after an administrator password
       * change so an existing session cannot remain active
       * indefinitely.
       */

      res.clearCookie("us_courier_token", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/"
      });

      await logAdminAction({
        adminId: req.admin?.id || null,
        adminEmail: req.admin?.email || null,
        action: "admin.password_change",
        targetType: "admin",
        targetId: req.admin?.id || null,
        details: JSON.stringify({
          passwordChanged: true
        }),
        ipAddress: req.ip || null
      });

      return res.json({
        success: true,
        message: "Administrator password changed successfully. Please sign in again."
      });
    } catch (error) {
      console.error(
        "[ADMIN PASSWORD CHANGE]",
        error.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to change administrator password."
      });
    }
  }
);


// ============================================================
// SITE SETTINGS - PUBLIC
// ============================================================

app.get(
  "/api/public/settings",
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          setting_key,
          setting_value
        FROM site_settings
        WHERE is_public = TRUE
          AND setting_key = ANY($1::text[])
        ORDER BY setting_key ASC
        `,
        [Array.from(PUBLIC_SETTING_KEYS)]
      );

      const settings = {};

      for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value;
      }

      return res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error("[PUBLIC SETTINGS]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to load website settings."
      });
    }
  }
);

// ============================================================
// ADMIN SHIPMENT EVENTS - VIEW
// ============================================================

app.get(
  "/api/admin/shipments/:id/events",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const shipmentId = Number(req.params.id);

    if (
      !Number.isInteger(shipmentId) ||
      shipmentId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid shipment ID."
      });
    }

    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          shipment_id,
          status,
          location,
          description,
          event_time,
          latitude,
          longitude,
          created_at
        FROM shipment_events
        WHERE shipment_id = $1
        ORDER BY event_time ASC, id ASC
        `,
        [shipmentId]
      );

      return res.json({
        success: true,
        events: result.rows
      });
    } catch (err) {
      console.error(
        "[ADMIN SHIPMENT EVENTS]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to load shipment events."
      });
    }
  }
);

// ============================================================
// ADMIN SHIPMENT EVENTS - EDIT
// ============================================================

app.put(
  "/api/admin/shipment-events/:id",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const b = req.body || {};
    const eventId = Number(req.params.id);

    if (
      !Number.isInteger(eventId) ||
      eventId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid event ID."
      });
    }

    const status =
      cleanString(b.status, 100);

    const location =
      cleanString(b.location, 300);

    const description =
      cleanString(b.description, 2000) || null;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Event status is required."
      });
    }

    let eventTime = null;

    if (
      b.event_time !== undefined &&
      b.event_time !== null &&
      b.event_time !== ""
    ) {
      eventTime = new Date(b.event_time);

      if (Number.isNaN(eventTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid event date/time."
        });
      }
    }

    const c = await pool.connect();

    try {
      await c.query("BEGIN");

      const existing = await c.query(
        `
        SELECT
          id,
          shipment_id
        FROM shipment_events
        WHERE id = $1
        FOR UPDATE
        `,
        [eventId]
      );

      if (!existing.rowCount) {
        await c.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          error: "Tracking event not found."
        });
      }

      const shipmentId =
        existing.rows[0].shipment_id;

      const updated = await c.query(
        `
        UPDATE shipment_events
        SET
          status = $1,
          location = $2,
          description = $3,
          event_time = COALESCE($4::timestamptz, event_time)
        WHERE id = $5
        RETURNING
          id,
          shipment_id,
          status,
          location,
          description,
          event_time,
          latitude,
          longitude,
          created_at
        `,
        [
          status,
          location || null,
          description,
          eventTime
            ? eventTime.toISOString()
            : null,
          eventId
        ]
      );

      /*
       * Keep the shipment's current status/location synchronized
       * with its most recent tracking event.
       */
      const latestEvent = await c.query(
        `
        SELECT
          status,
          location
        FROM shipment_events
        WHERE shipment_id = $1
        ORDER BY event_time DESC NULLS LAST, id DESC
        LIMIT 1
        `,
        [shipmentId]
      );

      if (latestEvent.rowCount) {
        await c.query(
          `
          UPDATE shipments
          SET
            status = $1,
            current_location = $2,
            updated_at = NOW()
          WHERE id = $3
          `,
          [
            latestEvent.rows[0].status,
            latestEvent.rows[0].location || null,
            shipmentId
          ]
        );
      }

      await c.query("COMMIT");

      return res.json({
        success: true,
        event: updated.rows[0]
      });

    } catch (err) {
      await c.query("ROLLBACK");

      console.error(
        "[ADMIN EVENT UPDATE]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to update tracking event."
      });
    } finally {
      c.release();
    }
  }
);

// ============================================================
// ADMIN SHIPMENTS - UPDATE
// ============================================================

app.put(
  "/api/admin/shipments/:id",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const b = req.body || {};

    const shipmentId = Number(req.params.id);

    if (
      !Number.isInteger(shipmentId) ||
      shipmentId < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid shipment ID."
      });
    }

    const trackingNumber =
      cleanString(b.tracking_number, 150);

    const reference =
      cleanString(b.reference, 150);

    const senderName =
      cleanString(b.sender_name, 200);

    const senderCountry =
      cleanString(b.sender_country, 100);

    const recipientName =
      cleanString(b.recipient_name, 200);

    const recipientCountry =
      cleanString(b.recipient_country, 100);

    const origin =
      cleanString(b.origin, 300);

    const destination =
      cleanString(b.destination, 300);

    const currentLocation =
      cleanString(b.current_location, 300);

    const serviceType =
      cleanString(b.service_type, 100);

    const priority =
      cleanString(b.priority, 50);

    const status =
      cleanString(b.status, 100);

    const currency =
      cleanString(b.currency, 10) || "USD";

    const description =
      cleanString(b.description, 5000);

    const eventDescription =
      cleanString(b.event_description, 2000) ||
      `Shipment details updated by administrator.`;

    const estimatedDelivery =
      validDate(b.estimated_delivery);

    const packageCount =
      Number(b.package_count);

    const weight =
      b.weight === null ||
      b.weight === undefined ||
      b.weight === ""
        ? null
        : Number(b.weight);

    const declaredValue =
      b.declared_value === null ||
      b.declared_value === undefined ||
      b.declared_value === ""
        ? null
        : Number(b.declared_value);

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        error: "Tracking number is required."
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Shipment status is required."
      });
    }

    if (!isValidStatus(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid shipment status."
      });
    }

    if (
      !Number.isInteger(packageCount) ||
      packageCount < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "Package count must be a whole number of at least 1."
      });
    }

    if (
      weight !== null &&
      (!Number.isFinite(weight) || weight < 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid weight."
      });
    }

    if (
      declaredValue !== null &&
      (!Number.isFinite(declaredValue) ||
       declaredValue < 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid declared value."
      });
    }

    if (
      b.estimated_delivery &&
      !estimatedDelivery
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid estimated delivery date."
      });
    }

    const c = await pool.connect();

    try {
      await c.query("BEGIN");

      const q = await c.query(
        `
        UPDATE shipments
        SET
          tracking_number = $1,
          reference = $2,
          sender_name = $3,
          sender_country = $4,
          recipient_name = $5,
          recipient_country = $6,
          origin = $7,
          destination = $8,
          current_location = $9,
          service_type = $10,
          priority = $11,
          status = $12,
          estimated_delivery = $13,
          package_count = $14,
          weight = $15,
          currency = $16,
          declared_value = $17,
          description = $18,
          updated_at = NOW()
        WHERE id = $19
        RETURNING
          id,
          tracking_number,
          reference,
          status,
          service_type,
          priority,
          sender_name,
          sender_country,
          recipient_name,
          recipient_country,
          origin,
          destination,
          current_location,
          estimated_delivery,
          package_count,
          weight,
          currency,
          declared_value,
          description,
          created_at,
          updated_at
        `,
        [
          trackingNumber,
          reference || null,
          senderName || null,
          senderCountry || null,
          recipientName || null,
          recipientCountry || null,
          origin || null,
          destination || null,
          currentLocation || null,
          serviceType || null,
          priority || null,
          status,
          estimatedDelivery,
          packageCount,
          weight,
          currency,
          declaredValue,
          description || null,
          shipmentId
        ]
      );

      if (!q.rowCount) {
        await c.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          error: "Shipment not found."
        });
      }

      const shipment = q.rows[0];

      await c.query(
        `
        INSERT INTO shipment_events
        (
          shipment_id,
          status,
          location,
          description,
          event_time
        )
        VALUES
        ($1, $2, $3, $4, NOW())
        `,
        [
          shipment.id,
          shipment.status,
          shipment.current_location,
          eventDescription
        ]
      );

      await c.query("COMMIT");

      return res.json({
        success: true,
        shipment
      });

    } catch (e) {
      await c.query("ROLLBACK");

      console.error(
        "[UPDATE SHIPMENT]",
        e.message
      );

      if (e.code === "23505") {
        return res.status(409).json({
          success: false,
          error: "Tracking number already exists."
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to update shipment."
      });

    } finally {
      c.release();
    }
  }
);

// ============================================================
// ADMIN MESSAGES
// ============================================================

app.get(
  "/api/admin/messages",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          name AS sender_name,
          email,
          subject,
          message,
          created_at,
          status,
          read_at,
          replied_at
        FROM contact_messages
        ORDER BY created_at DESC
        LIMIT 100
        `
      );

      return res.json({
        success: true,
        messages: result.rows
      });
    } catch (err) {
      console.error(
        "[ADMIN MESSAGES]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to load messages"
      });
    }
  }
);

// ============================================================
// ADMIN MESSAGE ACTIONS
// ============================================================

/*
 * Send a reply to a customer.
 *
 * The email is sent first. The database is only marked as
 * replied/read after the email service succeeds.
 */
app.post(
  "/api/admin/messages/:id/reply",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  rateLimit(
    "admin-message-reply",
    60 * 1000,
    10
  ),
  async (req, res) => {
    const messageId = Number(req.params.id);
    const message = cleanString(
      req.body?.message,
      5000
    );

    if (
      !Number.isSafeInteger(messageId) ||
      messageId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid message ID."
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Reply message is required."
      });
    }

    try {
      const result = await queryWithRetry(
        `
        SELECT
          id,
          name,
          email,
          subject
        FROM contact_messages
        WHERE id = $1
        LIMIT 1
        `,
        [messageId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Customer message not found."
        });
      }

      const customerMessage = result.rows[0];

      await sendContactReply({
        recipientEmail: customerMessage.email,
        recipientName: customerMessage.name,
        subject:
          customerMessage.subject ||
          "US COURIER Support",
        message
      });

      await queryWithRetry(
        `
        UPDATE contact_messages
        SET
          status = 'Read',
          read_at = COALESCE(read_at, NOW()),
          replied_at = NOW()
        WHERE id = $1
        `,
        [messageId]
      );

      return res.json({
        success: true,
        message: "Reply sent successfully."
      });
    } catch (err) {
      console.error(
        "[ADMIN MESSAGE REPLY]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to send the customer reply."
      });
    }
  }
);


/*
 * Mark a customer message as read.
 */
app.put(
  "/api/admin/messages/:id/read",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const messageId = Number(req.params.id);

    if (
      !Number.isSafeInteger(messageId) ||
      messageId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid message ID."
      });
    }

    try {
      const result = await queryWithRetry(
        `
        UPDATE contact_messages
        SET
          status = 'Read',
          read_at = COALESCE(read_at, NOW())
        WHERE id = $1
        RETURNING id
        `,
        [messageId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Customer message not found."
        });
      }

      return res.json({
        success: true,
        message: "Message marked as read."
      });
    } catch (err) {
      console.error(
        "[ADMIN MESSAGE READ]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to update the message."
      });
    }
  }
);


/*
 * Permanently delete a customer message.
 */
app.delete(
  "/api/admin/messages/:id",
  authMiddleware,
  adminMiddleware,
  requireSameOrigin,
  async (req, res) => {
    const messageId = Number(req.params.id);

    if (
      !Number.isSafeInteger(messageId) ||
      messageId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid message ID."
      });
    }

    try {
      const result = await queryWithRetry(
        `
        DELETE FROM contact_messages
        WHERE id = $1
        RETURNING id
        `,
        [messageId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Customer message not found."
        });
      }

      return res.json({
        success: true,
        message: "Message deleted successfully."
      });
    } catch (err) {
      console.error(
        "[ADMIN MESSAGE DELETE]",
        err.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to delete the message."
      });
    }
  }
);

// ============================================================
// CONTACT FORM
// ============================================================

app.post(
  "/api/contact",
  requireSameOrigin,
  rateLimit(
    "contact",
    CONTACT_WINDOW_MS,
    CONTACT_MAX_ATTEMPTS
  ),
  async (req, res) => {
    const name = cleanString(
      req.body?.name,
      100
    );

    const email = cleanString(
      req.body?.email,
      254
    ).toLowerCase();

    const subject =
      cleanString(
        req.body?.subject,
        200
      ) ||
      `New Customer Inquiry from ${name}`;

    const message = cleanString(
      req.body?.message,
      5000
    );

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error:
          "Name, email, and message are required fields."
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address."
      });
    }

    try {
      await pool.query(
        `
        INSERT INTO contact_messages
        (
          name,
          email,
          subject,
          message
        )
        VALUES ($1,$2,$3,$4)
        `,
        [
          name,
          email,
          subject,
          message
        ]
      );

      let emailSent = false;

      if (resend) {
        const result =
          await resend.emails.send({
            from:
              `US Courier Support <${process.env.MAIL_FROM || "contact@uscourier.app"}>`,
            to: [
              process.env.CONTACT_RECIPIENT ||
              "contact@uscourier.app"
            ],
            replyTo: email,
            subject,
            html: contactEmailTemplate(
              name,
              email,
              subject,
              message
            )
          });

        if (result?.error) {
          console.warn(
            "[RESEND WARNING]",
            result.error.message
          );
        } else {
          emailSent = true;
        }
      }

      return res.status(200).json({
        success: true,
        saved: true,
        email_sent: emailSent,
        message:
          "Thank you for contacting us. All management representatives are currently busy assisting customers. Your message has been received successfully, and a response will be sent back shortly."
      });
    } catch (err) {
      console.error(
        "[CONTACT]",
        err.message
      );

      /*
       * Never return raw database/provider error
       * messages to the public.
       */

      return res.status(500).json({
        success: false,
        error:
          "Unable to process your message right now."
      });
    }
  }
);

// ============================================================
// FALLBACK
// ============================================================

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ============================================================
// START SERVER
// ============================================================

async function startServer() {
  try {
    await testDatabaseConnection();

    const server = app.listen(
      PORT,
      () => {
        console.log(
          `US COURIER Platform running on Port ${PORT}`
        );

        console.log(
          `Environment: ${NODE_ENV}`
        );

        console.log(
          "Database: Supabase PostgreSQL"
        );

        console.log(
          "Live URL: https://uscourier.app"
        );
      }
    );

    const shutdown = async (signal) => {
      console.log(
        `[SERVER] ${signal} received. Shutting down...`
      );

      server.close(async () => {
        try {
          await pool.end();

          console.log(
            "[SERVER] Shutdown complete."
          );

          process.exit(0);
        } catch (error) {
          console.error(
            "[SERVER] Shutdown error:",
            error.message
          );

          process.exit(1);
        }
      });
    };

    process.on(
      "SIGINT",
      () => shutdown("SIGINT")
    );

    process.on(
      "SIGTERM",
      () => shutdown("SIGTERM")
    );
  } catch (error) {
    console.error(
      "[DATABASE] Startup connection failed:"
    );

    console.error(error.message);

    process.exit(1);
  }
}

startServer();