"use strict";

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[AUTH] JWT_SECRET is not configured.");
  process.exit(1);
}

// ========== DATABASE ==========
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("[DATABASE] Pool error:", err.message);
});

async function testDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  console.log("[DATABASE] Supabase PostgreSQL connected:", result.rows[0].now);
}

async function queryWithRetry(text, values = [], retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pool.query(text, values);
    } catch (error) {
      lastError = error;

      const retryable = [
        "EAI_AGAIN",
        "ECONNRESET",
        "ECONNABORTED",
        "ETIMEDOUT",
        "ECONNREFUSED"
      ].includes(error.code);

      if (!retryable || attempt === retries) {
        throw error;
      }

      const delay = 500 * (attempt + 1);
      console.warn(
        `[DATABASE] Transient error ${error.code}; retrying in ${delay}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ========== MIDDLEWARE ==========
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// ========== HEALTH ==========
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({
      success: true,
      status: "online",
      database: "connected",
      service: "US COURIER API",
      environment: process.env.NODE_ENV || "development",
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

// ========== PUBLIC TRACKING ==========
app.get("/api/tracking/:trackingNumber", async (req, res) => {
  const trackingNumber = String(req.params.trackingNumber || "").trim();

  if (!trackingNumber) {
    return res.status(400).json({ success: false, message: "Tracking number required" });
  }

  try {
    const [shipmentResult, eventsResult] = await Promise.all([
      queryWithRetry(
        "SELECT * FROM shipments WHERE tracking_number = $1 LIMIT 1",
        [trackingNumber]
      ),
      queryWithRetry(
        `SELECT te.* FROM tracking_events te
         JOIN shipments s ON s.id = te.shipment_id
         WHERE s.tracking_number = $1
         ORDER BY te.event_time ASC`,
        [trackingNumber]
      )
    ]);

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Shipment not found" });
    }

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
});


// ========== AUTH ==========
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await queryWithRetry(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1 LIMIT 1",
      [String(email).trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Operator Credentials" });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: "Invalid Operator Credentials" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid Operator Credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "Admin" },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role || "Admin" }
    });
  } catch (err) {
    console.error("[AUTH LOGIN]", err.message);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/admin/dashboard", authMiddleware, async (req, res) => {
  try {
    const counts = await queryWithRetry(`
      SELECT
        (SELECT COUNT(*) FROM shipments) AS total,
        (SELECT COUNT(*) FROM shipments WHERE status ILIKE '%transit%') AS in_transit,
        (SELECT COUNT(*) FROM shipments WHERE status ILIKE '%delivered%') AS delivered,
        (SELECT COUNT(*) FROM messages) AS messages
    `);
    return res.json({ success: true, counts: counts.rows[0] });
  } catch (err) {
    console.error("[ADMIN DASHBOARD]", err.message);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

app.get("/api/admin/shipments", authMiddleware, async (req, res) => {
  try {
    const result = await queryWithRetry("SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100");
    return res.json({ success: true, shipments: result.rows });
  } catch (err) {
    console.error("[ADMIN SHIPMENTS]", err.message);
    return res.status(500).json({ error: "Failed to load shipments" });
  }
});

app.get("/api/admin/messages", authMiddleware, async (req, res) => {
  try {
    const result = await queryWithRetry("SELECT * FROM messages ORDER BY created_at DESC LIMIT 100");
    return res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error("[ADMIN MESSAGES]", err.message);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ========== START ==========
async function startServer() {
  try {
    await testDatabaseConnection();

    const server = app.listen(PORT, () => {
      console.log(`US COURIER Platform running on Port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`Database: Supabase PostgreSQL`);
    });

    const shutdown = async (signal) => {
      console.log(`[SERVER] ${signal} received. Shutting down...`);
      server.close(async () => {
        await pool.end();
        console.log("[SERVER] Shutdown complete.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("[DATABASE] Startup connection failed:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
