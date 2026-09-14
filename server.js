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

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
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
  max: 2,
  min: 1,
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
        `SELECT te.* FROM shipment_events te
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
        (SELECT COUNT(*) FROM contact_messages) AS messages
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


app.post("/api/admin/shipments",authMiddleware,async(req,res)=>{
 const b=req.body||{};
 if(["sender_name","recipient_name","origin","destination","service_type"].some(k=>!b[k]))
  return res.status(400).json({success:false,error:"Required shipment fields are missing."});
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const n="USC-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+Math.random().toString(36).slice(2,10).toUpperCase();
  const q=await c.query(`INSERT INTO shipments
  (tracking_number,origin,destination,service_type,status,current_location,estimated_delivery,weight,package_count,description,sender_name,sender_country,recipient_name,recipient_country,currency,declared_value)
  VALUES($1,$2,$3,$4,'Shipment Created',$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
  [n,b.origin,b.destination,b.service_type,b.estimated_delivery||null,b.weight||null,b.package_count||1,b.description||null,b.sender_name,b.sender_country||null,b.recipient_name,b.recipient_country||null,b.currency||null,b.declared_value||null]);
  const x=q.rows[0];
  await c.query("INSERT INTO shipment_events(shipment_id,status,location,description) VALUES($1,$2,$3,$4)",[x.id,x.status,x.current_location,"Shipment created"]);
  await c.query("COMMIT");
  res.status(201).json({success:true,tracking_number:x.tracking_number,shipment:x});
 }catch(e){
  await c.query("ROLLBACK"); console.error("[CREATE SHIPMENT]",e.message);
  res.status(500).json({success:false,error:"Failed to create shipment."});
 }finally{c.release();}
});

app.put("/api/admin/shipments/:id",authMiddleware,async(req,res)=>{
 const b=req.body||{},c=await pool.connect();
 try{
  await c.query("BEGIN");
  const q=await c.query("UPDATE shipments SET status=$1,current_location=$2,estimated_delivery=$3,updated_at=NOW() WHERE id=$4 RETURNING *",[b.status,b.current_location,b.estimated_delivery||null,req.params.id]);
  if(!q.rowCount){await c.query("ROLLBACK");return res.status(404).json({success:false,error:"Shipment not found."});}
  const x=q.rows[0];
  await c.query("INSERT INTO shipment_events(shipment_id,status,location,description,event_time) VALUES($1,$2,$3,$4,COALESCE($5,NOW()))",[x.id,x.status,x.current_location,b.event_description||("Shipment status updated to "+x.status),b.event_time||null]);
  await c.query("COMMIT");
  res.json({success:true,shipment:x});
 }catch(e){
  await c.query("ROLLBACK"); console.error("[UPDATE SHIPMENT]",e.message);
  res.status(500).json({success:false,error:"Failed to update shipment."});
 }finally{c.release();}
});
app.get("/api/admin/messages", authMiddleware, async (req, res) => {
  try {
    const result = await queryWithRetry("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100");
    return res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error("[ADMIN MESSAGES]", err.message);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

app.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body;
    const emailSubject = subject || `New Customer Inquiry from ${name}`;
    
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: "Name, email, and message are required fields." });
    }
    
    try {
        await pool.query(
            "INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)",
            [name, email, emailSubject, message]
        );

        const { data, error } = await resend.emails.send({
            from: `US Courier Support <${process.env.MAIL_FROM || 'contact@uscourier.app'}>`,
            to: [process.env.CONTACT_RECIPIENT || 'contact@uscourier.app'],
            replyTo: email,
            subject: emailSubject,
            html: contactEmailTemplate(name, email, emailSubject, message)
        });
        
        if (error) console.warn("[Resend Warning]:", error.message);
        
        return res.status(200).json({ success: true, message: "Message dispatched and saved successfully." });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
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
