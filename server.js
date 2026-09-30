"use strict";

require("dotenv").config();

const dns = require("dns");
const crypto = require("crypto");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { put, get, del } = require("@vercel/blob");
const { Readable } = require("stream");

const MAIL_ATTACHMENT_MAX_FILES = 5;
const MAIL_ATTACHMENT_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAIL_ATTACHMENT_MAX_TOTAL_SIZE = 3 * 1024 * 1024; // 3 MB

const MAIL_ATTACHMENT_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

const MAIL_ATTACHMENT_BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".js",
  ".mjs",
  ".cjs",
  ".ps1",
  ".sh",
  ".bash",
  ".php",
  ".phtml",
  ".html",
  ".htm",
  ".svg"
]);

const mailAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAIL_ATTACHMENT_MAX_FILES,
    fileSize: MAIL_ATTACHMENT_MAX_FILE_SIZE,
    fieldSize: 100 * 1024
  },
  fileFilter: (req, file, callback) => {
    const filename = String(file.originalname || "").trim();
    const lowerName = filename.toLowerCase();
    const extension = lowerName.includes(".")
      ? lowerName.slice(lowerName.lastIndexOf("."))
      : "";

    if (!filename) {
      return callback(new Error("Attachment filename is required."));
    }

    if (MAIL_ATTACHMENT_BLOCKED_EXTENSIONS.has(extension)) {
      return callback(new Error("This attachment file type is not allowed."));
    }

    if (!MAIL_ATTACHMENT_ALLOWED_TYPES.has(file.mimetype)) {
      return callback(new Error("This attachment file type is not allowed."));
    }

    callback(null, true);
  }
});


function sanitizeMailAttachmentFilename(filename) {
  return String(filename || "attachment")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/"/g, "'")
    .trim()
    .slice(0, 180) || "attachment";
}

function isBlobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN &&
    String(process.env.BLOB_READ_WRITE_TOKEN).trim()
  );
}

function buildMailAttachmentBlobPath(mailboxId, batchId, filename) {
  const safeMailboxId = String(mailboxId || "unknown")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const safeBatchId = String(batchId || crypto.randomUUID())
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const safeFilename = sanitizeMailAttachmentFilename(filename)
    .replace(/[^a-zA-Z0-9._()' -]/g, "_");

  return `mail-attachments/${safeMailboxId}/${safeBatchId}/${crypto.randomUUID()}-${safeFilename}`;
}

async function uploadMailAttachmentBlob(mailboxId, batchId, file) {
  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  const pathname = buildMailAttachmentBlobPath(
    mailboxId,
    batchId,
    file.originalname
  );

  const blob = await put(pathname, file.buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.mimetype || "application/octet-stream"
  });

  return {
    pathname,
    url: blob.url,
    sizeBytes: file.size
  };
}

async function deleteMailAttachmentBlobs(uploadedBlobs) {
  if (!Array.isArray(uploadedBlobs) || !uploadedBlobs.length) {
    return;
  }

  for (const item of uploadedBlobs) {
    if (!item?.pathname) {
      continue;
    }

    try {
      await del(item.pathname);
    } catch (error) {
      console.error(
        "[MAILBOX BLOB] Cleanup failed:",
        item.pathname,
        error.message
      );
    }
  }
}

async function streamPrivateMailAttachment(res, blob) {
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new Error("Private attachment was not found in Blob storage.");
  }

  const stream =
    typeof blob.stream.pipe === "function"
      ? blob.stream
      : Readable.fromWeb(blob.stream);

  stream.on("error", (error) => {
    console.error("[MAILBOX BLOB] Download stream failed:", error.message);

    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy(error);
    }
  });

  stream.pipe(res);
}

async function downloadMailAttachmentWithLimit(response, maxBytes) {
  if (!response || !response.body) {
    throw new Error("Attachment download response has no readable body.");
  }

  const contentLength = Number(
    response.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > maxBytes
  ) {
    throw new Error(
      `Attachment exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB size limit.`
    );
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of response.body) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new Error(
        `Attachment exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB size limit.`
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

async function readPrivateMailAttachmentBlob(blob, maxBytes) {
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new Error("Private attachment was not found in Blob storage.");
  }

  const stream =
    typeof blob.stream.pipe === "function"
      ? blob.stream
      : Readable.fromWeb(blob.stream);

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new Error(
        `Attachment exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB size limit.`
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

function validateMailAttachments(files) {
  const attachments = Array.isArray(files) ? files : [];

  const totalSize = attachments.reduce(
    (total, file) => total + Number(file.size || 0),
    0
  );

  if (totalSize > MAIL_ATTACHMENT_MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: "Attachments exceed the maximum combined size."
    };
  }

  return {
    valid: true,
    error: null
  };
}

function handleMailAttachmentUpload(req, res, next) {
  mailAttachmentUpload.array(
    "attachments",
    MAIL_ATTACHMENT_MAX_FILES
  )(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Each attachment must be 2 MB or smaller."
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          error: "You can attach a maximum of 5 files."
        });
      }

      if (error.code === "LIMIT_FIELD_SIZE") {
        return res.status(400).json({
          success: false,
          error: "Attachment form data is too large."
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid attachment upload."
      });
    }

    console.error("[MAILBOX ATTACHMENT]", error.message);

    return res.status(400).json({
      success: false,
      error: error.message || "Invalid attachment."
    });
  });
}

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

const DATABASE_CONFIGURED = Boolean(process.env.DATABASE_URL);

if (!DATABASE_CONFIGURED && IS_PRODUCTION) {
  console.error("[DATABASE] DATABASE_URL is not configured.");
  process.exit(1);
}

if (!DATABASE_CONFIGURED) {
  console.warn("[DATABASE] DATABASE_URL is not configured. Starting in local routing-only mode.");
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
const MAIL_SEND_WINDOW_MS = 15 * 60 * 1000;
const MAIL_SEND_MAX_ATTEMPTS = 20;
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
    "https://mail.uscourier.app",
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
  "CUSTOM",
  "Withheld for Correspondence Resolution and Procedure"
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
    origin: [
      "https://uscourier.app",
      "https://mail.uscourier.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

function parseMailAddress(value) {
  const raw = cleanString(value, 320);
  const match = raw.match(/^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match) {
    return { name: cleanString(match[1].replace(/^"|"$/g, ""), 160), email: match[2].trim().toLowerCase() };
  }
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!emailMatch) return null;
  return { name: "", email: emailMatch[0].toLowerCase() };
}

function normalizeMailAddresses(values = []) {
  return values.flatMap((value) => {
    const address = parseMailAddress(value);
    return address ? [address] : [];
  });
}

function getMailHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === wanted) return cleanString(value, 1000);
  }
  return "";
}

function normalizeMailSubject(subject) {
  return cleanString(subject, 300).replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase();
}

app.post(
  "/api/webhooks/resend",
  express.raw({
    type: "application/json",
    limit: "2mb"
  }),
  async (req, res) => {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const webhookId = req.get("svix-id");
    const webhookTimestamp = req.get("svix-timestamp");
    const webhookSignature = req.get("svix-signature");

    if (!webhookSecret) {
      console.error("[RESEND WEBHOOK] Secret is not configured.");
      return res.status(503).json({
        success: false,
        error: "Webhook is not configured."
      });
    }

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook request."
      });
    }
    try {
      const payload = Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : String(req.body || "");

      const event = resend.webhooks.verify({
        webhookSecret,
        payload,
        headers: {
          id: webhookId,
          timestamp: webhookTimestamp,
          signature: webhookSignature
        }
      });

      if (!event || event.type !== "email.received" || !event.data?.email_id) {
        return res.status(200).json({
          success: true,
          received: true
        });
      }

      const eventResult = await pool.query(
        `INSERT INTO mail_webhook_events (
           event_id,
           event_type,
           resend_email_id,
           payload
         )
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING id, processed`,
        [
          webhookId,
          event.type,
          event.data.email_id,
          payload
        ]
      );

      if (eventResult.rowCount === 0) {
        const existingEvent = await pool.query(
          `SELECT processed
           FROM mail_webhook_events
           WHERE event_id = $1
           LIMIT 1`,
          [webhookId]
        );

        if (existingEvent.rows[0]?.processed) {
          return res.status(200).json({
            success: true,
            received: true,
            duplicate: true
          });
        }
      }
      const receivedResult =
        await resend.emails.receiving.get(event.data.email_id);

      if (receivedResult.error || !receivedResult.data) {
        const providerError = receivedResult.error || {};

        console.error(
          "[RESEND WEBHOOK] Receiving API error:",
          JSON.stringify({
            name: providerError.name || null,
            message: providerError.message || null,
            statusCode: providerError.statusCode || null
          })
        );

        throw new Error(
          providerError.message ||
          "Unable to retrieve received email."
        );
      }

      const received = receivedResult.data;
      const sender = parseMailAddress(received.from);

      if (!sender) {
        throw new Error("Received email has no valid sender address.");
      }

      const receivedFor = normalizeMailAddresses(received.received_for || []);
      const recipientsTo = normalizeMailAddresses(received.to || []);
      const recipientsCc = normalizeMailAddresses(received.cc || []);
      const recipientsBcc = normalizeMailAddresses(received.bcc || []);

      const mailboxCandidates = [
        ...receivedFor.map((item) => item.email),
        ...recipientsTo.map((item) => item.email)
      ].filter(Boolean);

      const mailboxResult = await pool.query(
        `SELECT id, email, display_name
         FROM mailboxes
         WHERE status = 'active'
           AND LOWER(email) = ANY($1::text[])
         LIMIT 1`,
        [mailboxCandidates.map((email) => email.toLowerCase())]
      );

      if (!mailboxResult.rows[0]) {
        console.warn("[RESEND WEBHOOK] No active mailbox matched received email.");

        await pool.query(
          `UPDATE mail_webhook_events
           SET processed = true,
               processed_at = now()
           WHERE event_id = $1`,
          [webhookId]
        );

        return res.status(200).json({
          success: true,
          received: true,
          ignored: true
        });
      }

      const mailbox = mailboxResult.rows[0];
      const headers = received.headers || {};
      const inReplyTo = getMailHeader(headers, "in-reply-to");
      const references = getMailHeader(headers, "references");
      const normalizedSubject = normalizeMailSubject(received.subject);

      let threadId = received.message_id || event.data.email_id;

      if (inReplyTo || references) {
        const referenceIds = [
          inReplyTo,
          ...references.split(/\s+/)
        ].filter(Boolean);

        const parentResult = await pool.query(
          `SELECT thread_id, message_id
           FROM mail_messages
           WHERE mailbox_id = $1
             AND message_id = ANY($2::text[])
           ORDER BY created_at DESC
           LIMIT 1`,
          [mailbox.id, referenceIds]
        );

        if (parentResult.rows[0]) {
          threadId = parentResult.rows[0].thread_id || parentResult.rows[0].message_id || threadId;
        }
      }

      if (threadId === received.message_id && normalizedSubject) {
        const subjectResult = await pool.query(
          `SELECT thread_id
           FROM mail_messages
           WHERE mailbox_id = $1
             AND LOWER(TRIM(REGEXP_REPLACE(subject, '^(re|fw|fwd):[[:space:]]*', '', 'i'))) = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [mailbox.id, normalizedSubject]
        );

        if (subjectResult.rows[0]?.thread_id) {
          threadId = subjectResult.rows[0].thread_id;
        }
      }
      const messageResult = await pool.query(
        `INSERT INTO mail_messages (
           mailbox_id,
           resend_email_id,
           message_id,
           in_reply_to,
           thread_id,
           sender_name,
           sender_email,
           subject,
           text_body,
           html_body,
           folder,
           is_read,
           is_starred,
           received_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           'inbox', false, false, $11
         )
         ON CONFLICT (mailbox_id, resend_email_id) DO NOTHING
         RETURNING id`,
        [
          mailbox.id,
          received.id,
          cleanString(received.message_id, 1000) || null,
          inReplyTo || null,
          threadId,
          sender.name || null,
          sender.email,
          cleanString(received.subject, 300),
          received.text || null,
          received.html || null,
          received.created_at || new Date().toISOString()
        ]
      );

      if (messageResult.rowCount > 0) {
        const messageId = messageResult.rows[0].id;
        const recipients = [
          ...recipientsTo.map((item) => ({ ...item, type: "to" })),
          ...recipientsCc.map((item) => ({ ...item, type: "cc" })),
          ...recipientsBcc.map((item) => ({ ...item, type: "bcc" }))
        ];

        for (const recipient of recipients) {
          await pool.query(
            `INSERT INTO mail_recipients (
               message_id,
               recipient_type,
               email,
               display_name
             )
             VALUES ($1, $2, $3, $4)`,
            [
              messageId,
              recipient.type,
              recipient.email,
              recipient.name || null
            ]
          );
        }
        const incomingAttachmentBatchId = crypto.randomUUID();
        const incomingAttachments =
          Array.isArray(received.attachments)
            ? received.attachments.slice(0, MAIL_ATTACHMENT_MAX_FILES)
            : [];

        let incomingAttachmentTotalBytes = 0;

        if (
          Array.isArray(received.attachments) &&
          received.attachments.length > MAIL_ATTACHMENT_MAX_FILES
        ) {
          console.warn(
            "[RESEND WEBHOOK] Incoming attachment count exceeded the maximum; " +
            `only the first ${MAIL_ATTACHMENT_MAX_FILES} attachments will be processed.`
          );
        }

        for (const attachment of incomingAttachments) {
          const filename =
            sanitizeMailAttachmentFilename(
              attachment?.filename || "attachment"
            );

          const lowerFilename =
            filename.toLowerCase();

          const extension =
            lowerFilename.includes(".")
              ? lowerFilename.slice(
                  lowerFilename.lastIndexOf(".")
                )
              : "";

          const contentType =
            String(
              attachment?.content_type ||
              "application/octet-stream"
            )
              .trim()
              .toLowerCase();

          const declaredSize =
            Number(attachment?.size);

          const safeDeclaredSize =
            Number.isFinite(declaredSize) &&
            declaredSize >= 0
              ? declaredSize
              : null;

          const attachmentId =
            String(attachment?.id || "").trim();

          let storageProvider = null;
          let storagePath = null;
          let storageSizeBytes = safeDeclaredSize;
          let uploadedBlob = null;

          const validationError =
            !filename
              ? "Attachment filename is required."
              : MAIL_ATTACHMENT_BLOCKED_EXTENSIONS.has(
                  extension
                )
                ? "This attachment file type is not allowed."
                : !MAIL_ATTACHMENT_ALLOWED_TYPES.has(
                    contentType
                  )
                  ? "This attachment file type is not allowed."
                  : safeDeclaredSize !== null &&
                    safeDeclaredSize >
                      MAIL_ATTACHMENT_MAX_FILE_SIZE
                    ? "Attachment exceeds the 2 MB size limit."
                    : !attachmentId
                      ? "Resend attachment ID is missing."
                      : null;

          if (validationError) {
            console.warn(
              "[RESEND WEBHOOK] Incoming attachment rejected:",
              filename,
              validationError
            );

            await pool.query(
              `INSERT INTO mail_attachments (
                 message_id,
                 resend_attachment_id,
                 filename,
                 content_type,
                 content_disposition,
                 content_id,
                 size_bytes,
                 storage_provider,
                 storage_path,
                 storage_size_bytes,
                 storage_uploaded_at
               )
               VALUES (
                 $1, $2, $3, $4, $5, $6, $7,
                 NULL, NULL, $7, NULL
               )
               ON CONFLICT DO NOTHING`,
              [
                messageId,
                attachmentId || null,
                filename,
                contentType,
                attachment?.content_disposition || null,
                attachment?.content_id || null,
                safeDeclaredSize
              ]
            );

            continue;
          }

          /*
           * Do not add safeDeclaredSize to the aggregate here.
           *
           * Resend's declared size is useful for rejecting an individual
           * attachment before downloading, but the combined-size limit must
           * be calculated from the actual downloaded byte count. Otherwise
           * the attachment can be counted once by declared size and again
           * by buffer.length below.
           */

          if (isBlobStorageConfigured()) {
            try {
              const attachmentResult =
                await resend.emails.receiving.attachments.get({
                  emailId: received.id,
                  id: attachmentId
                });

              if (
                attachmentResult?.error ||
                !attachmentResult?.data?.download_url
              ) {
                throw new Error(
                  "Resend did not return an attachment download URL."
                );
              }

              const downloadUrl =
                String(
                  attachmentResult.data.download_url
                ).trim();

              let parsedDownloadUrl;

              try {
                parsedDownloadUrl =
                  new URL(downloadUrl);
              } catch {
                throw new Error(
                  "Resend returned an invalid attachment download URL."
                );
              }

              if (
                parsedDownloadUrl.protocol !== "https:"
              ) {
                throw new Error(
                  "Attachment download URL must use HTTPS."
                );
              }

              const downloadResponse =
                await fetch(
                  parsedDownloadUrl,
                  {
                    method: "GET",
                    signal:
                      AbortSignal.timeout(15000)
                  }
                );

              if (!downloadResponse.ok) {
                throw new Error(
                  `Attachment download returned HTTP ${downloadResponse.status}.`
                );
              }

              const buffer =
                await downloadMailAttachmentWithLimit(
                  downloadResponse,
                  MAIL_ATTACHMENT_MAX_FILE_SIZE
                );

              if (
                incomingAttachmentTotalBytes +
                  buffer.length >
                MAIL_ATTACHMENT_MAX_TOTAL_SIZE
              ) {
                throw new Error(
                  "Incoming attachment batch exceeds the 3 MB combined size limit."
                );
              }

              storageSizeBytes = buffer.length;

              uploadedBlob =
                await uploadMailAttachmentBlob(
                  mailbox.id,
                  incomingAttachmentBatchId,
                  {
                    originalname: filename,
                    mimetype: contentType,
                    buffer,
                    size: buffer.length
                  }
                );

              storageProvider =
                "vercel_blob";

              storagePath =
                uploadedBlob.pathname;

              incomingAttachmentTotalBytes +=
                buffer.length;

            } catch (attachmentStorageError) {
              console.error(
                "[RESEND WEBHOOK] Incoming attachment storage failed:",
                filename,
                attachmentStorageError.message
              );

              if (uploadedBlob?.pathname) {
                await deleteMailAttachmentBlobs([
                  uploadedBlob
                ]);
              }

              storageProvider = null;
              storagePath = null;
              storageSizeBytes =
                safeDeclaredSize;
            }
          } else {
            console.warn(
              "[RESEND WEBHOOK] BLOB_READ_WRITE_TOKEN is not configured; " +
              `incoming attachment "${filename}" was recorded without binary storage.`
            );
          }

          try {
            await pool.query(
              `INSERT INTO mail_attachments (
                 message_id,
                 resend_attachment_id,
                 filename,
                 content_type,
                 content_disposition,
                 content_id,
                 size_bytes,
                 storage_provider,
                 storage_path,
                 storage_size_bytes,
                 storage_uploaded_at
               )
               VALUES (
                 $1, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10,
                 CASE
                   WHEN $8 = 'vercel_blob'
                    AND $9 IS NOT NULL
                   THEN now()
                   ELSE NULL
                 END
               )
               ON CONFLICT DO NOTHING`,
              [
                messageId,
                attachmentId,
                filename,
                contentType,
                attachment?.content_disposition || null,
                attachment?.content_id || null,
                safeDeclaredSize,
                storageProvider,
                storagePath,
                storageSizeBytes
              ]
            );
          } catch (metadataError) {
            console.error(
              "[RESEND WEBHOOK] Attachment metadata insert failed:",
              filename,
              metadataError.message
            );

            if (uploadedBlob?.pathname) {
              await deleteMailAttachmentBlobs([
                uploadedBlob
              ]);
            }
          }
        }
      }

      await pool.query(
        `UPDATE mail_webhook_events
         SET processed = true,
             processed_at = now()
         WHERE event_id = $1`,
        [webhookId]
      );

      return res.status(200).json({
        success: true,
        received: true
      });
    } catch (error) {
      console.error("[RESEND WEBHOOK] Processing failed:", error.message);

      return res.status(500).json({
        success: false,
        error: "Webhook processing failed."
      });
    }
  }
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

// ============================================================
// STANDALONE ADMIN PORTAL
// SERVER-SIDE PAGE AUTHORIZATION
// ============================================================

function getRequestHostname(req) {
  return String(
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    req.hostname ||
    ""
  )
    .split(",")[0]
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function adminSubdomainOnly(req, res, next) {
  const hostname = getRequestHostname(req);

  if (hostname === "uscourier.app") {
    return next();
  }

  if (
    hostname === "account.uscourier.app" &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    const originalUrl = req.originalUrl || "/";
    const target = originalUrl === "/" ? "/admin" : "/admin" + originalUrl;
    return res.redirect(302, "https://uscourier.app" + target);
  }

  return res.status(404).send("Not Found");
}


/*
 * ============================================================
 * STAFF SESSION VALIDATION
 * ============================================================
 *
 * JWT authenticity is necessary but not sufficient.
 * Every authenticated request also verifies:
 *   - the PostgreSQL user still exists
 *   - the account is Active
 *   - the JWT contains a valid staff session UUID
 *   - the staff session is still Active
 *
 * The session ID is stored only inside the signed JWT and is
 * never exposed to browser JavaScript.
 */
async function validateStaffSession(decoded) {
  if (!decoded || !decoded.id || !decoded.sid) {
    return null;
  }

  const result = await queryWithRetry(
    `
    SELECT
      u.id,
      u.email,
      u.role,
      u.name,
      u.status AS user_status,
      s.id AS session_id,
      s.status AS session_status
    FROM users u
    INNER JOIN staff_sessions s
      ON s.user_id = u.id
    WHERE u.id = $1
      AND s.id = $2::uuid
      AND u.status = 'Active'
      AND s.status = 'Active'
      AND s.last_activity_at >= NOW() - INTERVAL '10 minutes'
    LIMIT 1
    `,
    [decoded.id, decoded.sid]
  );

  if (result.rows.length === 0) {

    /*
     * The session is no longer valid if it has been
     * inactive for 10 minutes or more.
     *
     * Mark the PostgreSQL session as logged out so
     * subsequent requests cannot reuse it.
     */
    await queryWithRetry(
      `
      UPDATE staff_sessions
      SET
        status = 'Logged Out',
        logout_at = NOW(),
        last_activity_at = NOW()
      WHERE id = $1::uuid
        AND user_id = $2
        AND status = 'Active'
        AND last_activity_at < NOW() - INTERVAL '10 minutes'
      `,
      [decoded.sid, decoded.id]
    );

    return null;
  }

  const row = result.rows[0];

  await queryWithRetry(
    `
    UPDATE staff_sessions
    SET last_activity_at = NOW()
    WHERE id = $1::uuid
      AND status = 'Active'
    `,
    [decoded.sid]
  );

  return row;
}

async function adminPageMiddleware(req, res, next) {
  let token = req.cookies.us_courier_token;

  if (!token) {
    const header = req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.redirect("https://uscourier.app/admin");
  }

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (!decoded || !decoded.id || !decoded.sid) {
      return res.redirect("https://uscourier.app/admin");
    }

    /*
     * JWT verification proves the token is authentic.
     * PostgreSQL session validation additionally confirms:
     * - the staff session still exists
     * - the session is still Active
     * - the user still exists
     * - the user account is still Active
     */
    const session = await validateStaffSession(decoded);

    if (!session) {
      return res.redirect("https://uscourier.app/admin");
    }

    /*
     * Never trust the role stored in the JWT alone.
     * validateStaffSession() returns the current role
     * directly from PostgreSQL.
     */
    if (!ADMIN_ALLOWED_ROLES.has(session.role)) {
      return res.redirect("https://uscourier.app/admin");
    }

    req.user = decoded;

    req.admin = {
      id: session.id,
      email: session.email,
      role: session.role,
      name: session.name
    };

    req.staffSession = session;

    next();
  } catch (error) {
    console.warn(
      "[ADMIN PAGE AUTH]",
      error.message
    );

    return res.redirect("https://uscourier.app/admin");
  }
}

app.get("/admin", adminSubdomainOnly, (req, res) => {
  return res.sendFile(
    path.join(__dirname, "public", "admin", "login.html")
  );
});

app.get("/admin/", adminSubdomainOnly, (req, res) => {
  return res.sendFile(
    path.join(__dirname, "public", "admin", "login.html")
  );
});

// ============================================================
// FALLBACK
// ============================================================

// Admin Portal is available through the canonical main-domain /admin path.
app.use("/admin", adminSubdomainOnly);

// The admin subdomain root must never be handled by public/index.html.
// ============================================================
// CANONICAL ADMIN + MAIL ROUTING
// /admin           -> Admin login
// /admin/dashboard -> protected Admin dashboard
// /mail            -> Mailbox
// Legacy subdomains redirect to the canonical main domain.
// ============================================================
app.get("/mail", (req, res) => {
  const hostname = getRequestHostname(req);

  if (hostname === "uscourier.app") {
    return res.sendFile(
      path.join(__dirname, "public", "mail", "index.html")
    );
  }

  if (
    hostname === "mail.uscourier.app" &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    return res.redirect(302, "https://uscourier.app/mail");
  }

  return res.status(404).send("Not Found");
});


app.get("/", (req, res, next) => {
  const hostname = getRequestHostname(req);

  if (hostname === "mail.uscourier.app") {
    return res.sendFile(path.join(__dirname, "public", "mail", "index.html"));
  }

  // Public website
  if (hostname === "uscourier.app") {
    return next();
  }

  // Legacy admin hostname redirects to the canonical main-domain Admin Portal.
  if (hostname === "account.uscourier.app") {
    return res.redirect(302, "https://uscourier.app/admin");
  }

  return next();
});

app.get("/admin/dashboard", adminSubdomainOnly, (req, res, next) => {
  return adminPageMiddleware(req, res, () => {
    return res.sendFile(
      path.join(__dirname, "public", "admin", "index.html")
    );
  });
});

app.get("/login.html", (req, res) => {
  return res.status(404).send("Not Found");
});

app.get("/dashboard.html", (req, res) => {
  if (getRequestHostname(req) !== "uscourier.app") {
    return res.status(404).send("Not Found");
  }

  return res.redirect(302, "/admin/dashboard");
});

app.get("/index.html", (req, res, next) => {
  if (getRequestHostname(req) === "account.uscourier.app") {
    return res.redirect(302, "https://uscourier.app/admin");
  }

  next();
});


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
          origin,
          current_location,
          destination,
          estimated_delivery,
          package_count,
          weight AS weight_kg
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
          event_time,
          latitude,
          longitude
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

async function authMiddleware(req, res, next) {
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
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (!decoded || !decoded.id || !decoded.sid) {
      return res.status(401).json({
        error: "Invalid or expired session"
      });
    }

    /*
     * JWT verification proves the token was signed by this server.
     * PostgreSQL session validation additionally proves that:
     * - this staff session still exists
     * - the session is still Active
     * - the user account still exists
     * - the user account is still Active
     */
    const session = await validateStaffSession(decoded);

    if (!session) {
      return res.status(401).json({
        error: "Invalid or expired session"
      });
    }

    req.user = decoded;
    req.staffSession = session;

    next();
  } catch (error) {
    console.warn(
      "[AUTH SESSION]",
      error.message
    );

    return res.status(401).json({
      error: "Invalid or expired session"
    });
  }
}

// ============================================================
// MAILBOX API
// ============================================================
app.get("/api/mailbox", authMiddleware, async (req, res) => {
  try {
    const result = await queryWithRetry(
      `SELECT id, email, display_name, status, created_at, updated_at
       FROM mailboxes
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Mailbox not provisioned",
        mailbox: null
      });
    }

    return res.json({
      success: true,
      mailbox: result.rows[0]
    });
  } catch (error) {
    console.error("[MAILBOX]", error.message);
    return res.status(500).json({
      error: "Unable to retrieve mailbox"
    });
  }
});

app.get("/api/mailbox/messages", authMiddleware, async (req, res) => {
  try {
    const folder = String(req.query.folder || "inbox").toLowerCase();
    const allowedFolders = [
      "inbox",
      "starred",
      "sent",
      "drafts",
      "outbox",
      "trash",
      "archive"
    ];

    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        error: "Invalid mailbox folder"
      });
    }

    const result = await queryWithRetry(
      `SELECT
         m.id,
         m.sender_name,
         m.sender_email,
         m.subject,
         m.text_body,
         m.html_body,
         m.folder,
         m.is_read,
         m.is_starred,
         m.thread_id,
         m.delivery_status,
         m.delivery_attempts,
         m.last_delivery_error,
         m.queued_at,
         m.delivered_at,
         m.received_at,
         m.sent_at,
         m.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'type', r.recipient_type,
               'email', r.email,
               'name', r.display_name
             ) ORDER BY r.created_at
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'::json
         ) AS recipients
       FROM mail_messages m
       JOIN mailboxes b ON b.id = m.mailbox_id
       LEFT JOIN mail_recipients r ON r.message_id = m.id
       WHERE b.user_id = $1
         AND b.status = 'active'
         AND (
           ($2 = 'starred' AND m.is_starred = true AND m.folder <> 'trash')
           OR
           ($2 <> 'starred' AND m.folder = $2)
         )
       GROUP BY m.id
       ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) DESC
       LIMIT 100`,
      [req.user.id, folder]
    );

    return res.json({
      success: true,
      folder,
      count: result.rows.length,
      messages: result.rows
    });
  } catch (error) {
    console.error("[MAILBOX MESSAGES]", error.message);
    return res.status(500).json({
      error: "Unable to retrieve mailbox messages"
    });
  }
});

app.get(
  "/api/mailbox/attachments/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const attachmentId = String(req.params.id || "").trim();

      if (!attachmentId) {
        return res.status(400).json({
          success: false,
          error: "Attachment ID is required."
        });
      }

      const result = await queryWithRetry(
        `SELECT
           a.id,
           a.filename,
           a.content_type,
           a.content_disposition,
           a.size_bytes,
           a.storage_provider,
           a.storage_path
         FROM mail_attachments a
         JOIN mail_messages m
           ON m.id = a.message_id
         JOIN mailboxes b
           ON b.id = m.mailbox_id
         WHERE a.id = $1
           AND b.user_id = $2
           AND b.status = 'active'
         LIMIT 1`,
        [attachmentId, req.user.id]
      );

      const attachment = result.rows[0];

      if (!attachment) {
        return res.status(404).json({
          success: false,
          error: "Attachment not found."
        });
      }

      if (
        attachment.storage_provider !== "vercel_blob" ||
        !attachment.storage_path
      ) {
        return res.status(410).json({
          success: false,
          error: "This attachment is no longer available for download."
        });
      }

      if (!isBlobStorageConfigured()) {
        console.error(
          "[MAILBOX BLOB] Download attempted without Blob configuration."
        );

        return res.status(503).json({
          success: false,
          error: "Attachment storage is not configured."
        });
      }

      const blob = await get(attachment.storage_path, {
        access: "private"
      });

      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return res.status(404).json({
          success: false,
          error: "Attachment file was not found in storage."
        });
      }

      const filename = sanitizeMailAttachmentFilename(
        attachment.filename || "attachment"
      );

      const contentType =
        attachment.content_type || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-store");

      if (
        Number.isFinite(Number(attachment.size_bytes)) &&
        Number(attachment.size_bytes) >= 0
      ) {
        res.setHeader(
          "Content-Length",
          String(attachment.size_bytes)
        );
      }

      await streamPrivateMailAttachment(res, blob);
    } catch (error) {
      console.error(
        "[MAILBOX ATTACHMENT DOWNLOAD]",
        error.message
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: "Unable to download attachment."
        });
      }

      res.destroy(error);
    }
  }
);

app.get("/api/mailbox/messages/:id/thread", authMiddleware, async (req, res) => {
  try {
    const messageId = cleanString(req.params.id, 100);

    if (!messageId) {
      return res.status(400).json({ success: false, error: "Message ID is required." });
    }

    const result = await queryWithRetry(
      `SELECT
         m.id,
         m.resend_email_id,
         m.message_id,
         m.in_reply_to,
         m.thread_id,
         m.sender_name,
         m.sender_email,
         m.subject,
         m.text_body,
         m.html_body,
         m.folder,
         m.is_read,
         m.is_starred,
         m.received_at,
         m.sent_at,
         m.created_at,
         m.updated_at,
         COALESCE((
           SELECT json_agg(
             json_build_object(
               'type', r.recipient_type,
               'email', r.email,
               'name', r.display_name
             ) ORDER BY r.created_at
           )
           FROM mail_recipients r
           WHERE r.message_id = m.id
         ), '[]'::json) AS recipients,
         COALESCE((
           SELECT json_agg(
             json_build_object(
               'id', a.id,
               'filename', a.filename,
               'content_type', a.content_type,
               'content_disposition', a.content_disposition,
               'content_id', a.content_id,
               'size_bytes', a.size_bytes,
               'download_url',
                 CASE
                   WHEN a.storage_provider = 'vercel_blob'
                    AND a.storage_path IS NOT NULL
                   THEN '/api/mailbox/attachments/' || a.id::text
                   ELSE NULL
                 END
             ) ORDER BY a.created_at
           )
           FROM mail_attachments a
           WHERE a.message_id = m.id
         ), '[]'::json) AS attachments
       FROM mail_messages m
       JOIN mailboxes b ON b.id = m.mailbox_id
       WHERE b.user_id = $1
         AND b.status = 'active'
         AND m.thread_id = (
           SELECT source.thread_id
           FROM mail_messages source
           WHERE source.id = $2
             AND source.mailbox_id = b.id
           LIMIT 1
         )
       ORDER BY COALESCE(m.received_at, m.sent_at, m.created_at) ASC`,
      [req.user.id, messageId]
    );
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Message not found."
      });
    }

    return res.json({
      success: true,
      thread_id: result.rows[0].thread_id,
      count: result.rows.length,
      messages: result.rows
    });
  } catch (error) {
    console.error("[MAILBOX THREAD]", error.message);
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve message thread."
    });
  }
});



// ============================================================
// MAILBOX MESSAGE ACTIONS
// ============================================================

async function getOwnedMailboxMessage(userId, messageId) {
  const result = await queryWithRetry(
    `SELECT
       m.id,
       m.mailbox_id,
       m.folder,
       m.is_read,
       m.is_starred,
       m.thread_id,
       m.subject,
       m.sender_email
     FROM mail_messages m
     JOIN mailboxes b ON b.id = m.mailbox_id
     WHERE m.id = $1
       AND b.user_id = $2
       AND b.status = 'active'
     LIMIT 1`,
    [messageId, userId]
  );

  return result.rows[0] || null;
}

app.patch(
  "/api/mailbox/messages/:id/read",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      const isRead =
        typeof req.body?.isRead === "boolean"
          ? req.body.isRead
          : true;

      const result = await queryWithRetry(
        `UPDATE mail_messages
         SET is_read = $1
         WHERE id = $2
           AND mailbox_id = $3
         RETURNING id, is_read, is_starred, folder, updated_at`,
        [isRead, message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        message: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX READ]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to update message read status."
      });
    }
  }
);

app.patch(
  "/api/mailbox/messages/:id/star",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      const isStarred =
        typeof req.body?.isStarred === "boolean"
          ? req.body.isStarred
          : !message.is_starred;

      const result = await queryWithRetry(
        `UPDATE mail_messages
         SET is_starred = $1
         WHERE id = $2
           AND mailbox_id = $3
         RETURNING id, is_read, is_starred, folder, updated_at`,
        [isStarred, message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        message: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX STAR]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to update message star."
      });
    }
  }
);

app.patch(
  "/api/mailbox/messages/:id/archive",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      if (message.folder === "trash") {
        return res.status(400).json({
          success: false,
          error: "Trash messages must be restored before archiving."
        });
      }

      const result = await queryWithRetry(
        `UPDATE mail_messages
         SET folder = 'archive'
         WHERE id = $1
           AND mailbox_id = $2
         RETURNING id, folder, is_read, is_starred, updated_at`,
        [message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        message: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX ARCHIVE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to archive message."
      });
    }
  }
);

app.patch(
  "/api/mailbox/messages/:id/trash",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      if (message.folder === "trash") {
        return res.json({
          success: true,
          message: {
            id: message.id,
            folder: "trash"
          }
        });
      }

      const result = await queryWithRetry(
        `UPDATE mail_messages
         SET folder = 'trash'
         WHERE id = $1
           AND mailbox_id = $2
         RETURNING id, folder, is_read, is_starred, updated_at`,
        [message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        message: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX TRASH]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to move message to trash."
      });
    }
  }
);

app.patch(
  "/api/mailbox/messages/:id/restore",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      if (message.folder !== "trash") {
        return res.status(400).json({
          success: false,
          error: "Only messages in trash can be restored."
        });
      }

      const result = await queryWithRetry(
        `UPDATE mail_messages
         SET folder = 'inbox'
         WHERE id = $1
           AND mailbox_id = $2
         RETURNING id, folder, is_read, is_starred, updated_at`,
        [message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        message: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX RESTORE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to restore message."
      });
    }
  }
);

app.delete(
  "/api/mailbox/messages/:id",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      const message = await getOwnedMailboxMessage(req.user.id, messageId);

      if (!message) {
        return res.status(404).json({
          success: false,
          error: "Message not found."
        });
      }

      if (message.folder !== "trash") {
        return res.status(400).json({
          success: false,
          error: "Move the message to trash before permanently deleting it."
        });
      }

      await queryWithRetry(
        `DELETE FROM mail_messages
         WHERE id = $1
           AND mailbox_id = $2`,
        [message.id, message.mailbox_id]
      );

      return res.json({
        success: true,
        deleted: true,
        message_id: message.id
      });
    } catch (error) {
      console.error("[MAILBOX DELETE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to permanently delete message."
      });
    }
  }
);

app.post(
  "/api/mailbox/messages/:id/retry",
  rateLimit("mail-retry", MAIL_SEND_WINDOW_MS, MAIL_SEND_MAX_ATTEMPTS),
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    let message = null;
    let providerAccepted = false;

    try {
      const messageId = cleanString(req.params.id, 100);

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: "Message ID is required."
        });
      }

      if (!resend) {
        return res.status(503).json({
          success: false,
          error: "Outbound email service is not configured."
        });
      }

      /*
       * Resolve the mailbox from the authenticated user.
       * Never trust a mailbox ID supplied by the browser.
       */
      const mailboxResult = await queryWithRetry(
        `SELECT id, email, display_name
         FROM mailboxes
         WHERE user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (!mailboxResult.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Mailbox not provisioned."
        });
      }

      const mailbox = mailboxResult.rows[0];

      /*
       * Atomically claim the failed Outbox message.
       *
       * The delivery_status='failed' condition prevents two browser
       * requests from sending the same message concurrently.
       */
      const claimResult = await queryWithRetry(
        `UPDATE mail_messages
         SET delivery_status = 'sending',
             delivery_attempts = delivery_attempts + 1,
             last_delivery_error = NULL,
             updated_at = now()
         WHERE id = $1
           AND mailbox_id = $2
           AND folder = 'outbox'
           AND delivery_status = 'failed'
         RETURNING
           id,
           mailbox_id,
           message_id,
           in_reply_to,
           thread_id,
           sender_name,
           sender_email,
           subject,
           text_body,
           html_body,
           delivery_attempts`,
        [messageId, mailbox.id]
      );

      if (!claimResult.rows.length) {
        const existingResult = await queryWithRetry(
          `SELECT id, folder, delivery_status
           FROM mail_messages
           WHERE id = $1
             AND mailbox_id = $2
           LIMIT 1`,
          [messageId, mailbox.id]
        );

        const existing = existingResult.rows[0];

        if (!existing) {
          return res.status(404).json({
            success: false,
            error: "Outbox message not found."
          });
        }

        if (existing.folder !== "outbox") {
          return res.status(409).json({
            success: false,
            error: "Only Outbox messages can be retried."
          });
        }

        if (existing.delivery_status === "sending") {
          return res.status(409).json({
            success: false,
            error: "This message is already being sent."
          });
        }

        if (existing.delivery_status === "sent") {
          return res.status(409).json({
            success: false,
            error: "This message has already been sent."
          });
        }

        return res.status(409).json({
          success: false,
          error: "This message is not currently eligible for retry."
        });
      }

      message = claimResult.rows[0];

      /*
       * Recipients were persisted when the original message was queued.
       * Reuse them exactly rather than trusting browser-supplied values.
       */
      const recipientResult = await queryWithRetry(
        `SELECT recipient_type, email
         FROM mail_recipients
         WHERE message_id = $1
         ORDER BY created_at ASC, id ASC`,
        [message.id]
      );

      const to = recipientResult.rows
        .filter((row) => row.recipient_type === "to")
        .map((row) => row.email)
        .filter(Boolean);

      const cc = recipientResult.rows
        .filter((row) => row.recipient_type === "cc")
        .map((row) => row.email)
        .filter(Boolean);

      const bcc = recipientResult.rows
        .filter((row) => row.recipient_type === "bcc")
        .map((row) => row.email)
        .filter(Boolean);

      if (!to.length && !cc.length && !bcc.length) {
        throw new Error("No recipients are stored for this message.");
      }

      /*
       * Reuse the existing private Blob attachments.
       * Nothing is exposed to the browser.
       */
      const attachmentResult = await queryWithRetry(
        `SELECT
           id,
           filename,
           content_type,
           content_disposition,
           storage_provider,
           storage_path,
           size_bytes,
           storage_size_bytes
         FROM mail_attachments
         WHERE message_id = $1
         ORDER BY created_at ASC, id ASC`,
        [message.id]
      );

      const attachmentRows = attachmentResult.rows;

      if (attachmentRows.length > MAIL_ATTACHMENT_MAX_FILES) {
        throw new Error(
          `Message exceeds the ${MAIL_ATTACHMENT_MAX_FILES} attachment limit.`
        );
      }

      const attachments = [];
      let totalAttachmentBytes = 0;

      if (attachmentRows.length) {
        if (!isBlobStorageConfigured()) {
          throw new Error("Attachment storage is not configured.");
        }

        for (const attachment of attachmentRows) {
          if (
            attachment.storage_provider !== "vercel_blob" ||
            !attachment.storage_path
          ) {
            throw new Error(
              `Attachment "${sanitizeMailAttachmentFilename(
                attachment.filename || "attachment"
              )}" is not available for retry.`
            );
          }

          const blob = await get(attachment.storage_path, {
            access: "private"
          });

          const buffer = await readPrivateMailAttachmentBlob(
            blob,
            MAIL_ATTACHMENT_MAX_FILE_SIZE
          );

          totalAttachmentBytes += buffer.length;

          if (totalAttachmentBytes > MAIL_ATTACHMENT_MAX_TOTAL_SIZE) {
            throw new Error(
              `Attachments exceed the ${Math.floor(
                MAIL_ATTACHMENT_MAX_TOTAL_SIZE / (1024 * 1024)
              )} MB total size limit.`
            );
          }

          attachments.push({
            content: buffer,
            filename: sanitizeMailAttachmentFilename(
              attachment.filename || "attachment"
            ),
            contentType:
              attachment.content_type || "application/octet-stream"
          });
        }
      }

      const generatedMessageId =
        message.message_id ||
        `<${crypto.randomUUID()}@uscourier.app>`;

      const inReplyTo = message.in_reply_to || null;

      /*
       * The current schema does not store a separate References column.
       * Preserve the existing reply relationship when available.
       */
      const references = inReplyTo || null;

      let result;
      let providerAccepted = false;

      try {
        result = await resend.emails.send({
          from: `${mailbox.display_name} <${mailbox.email}>`,
          to,
          cc: cc.length ? cc : undefined,
          bcc: bcc.length ? bcc : undefined,
          subject: message.subject || "",
          text: message.text_body || "",
          html: message.html_body || undefined,
          attachments: attachments.length ? attachments : undefined,
          headers: {
            "Message-ID": generatedMessageId,
            ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
            ...(references ? { References: references } : {})
          }
        });

        if (!result?.error) {
          providerAccepted = true;
        }
      } catch (sendError) {
        console.error(
          "[MAILBOX RETRY]",
          sendError.message
        );

        await queryWithRetry(
          `UPDATE mail_messages
           SET delivery_status = 'failed',
               last_delivery_error = $3,
               updated_at = now()
           WHERE id = $1
             AND mailbox_id = $2
             AND folder = 'outbox'`,
          [
            message.id,
            mailbox.id,
            sendError.message || "Unable to send email."
          ]
        );

        return res.status(502).json({
          success: false,
          error: "Unable to send email. The message remains in Outbox for another retry."
        });
      }

      if (result?.error) {
        console.error(
          "[MAILBOX RETRY]",
          result.error.message
        );

        await queryWithRetry(
          `UPDATE mail_messages
           SET delivery_status = 'failed',
               last_delivery_error = $3,
               updated_at = now()
           WHERE id = $1
             AND mailbox_id = $2
             AND folder = 'outbox'`,
          [
            message.id,
            mailbox.id,
            result.error.message || "Unable to send email."
          ]
        );

        return res.status(502).json({
          success: false,
          error: "Unable to send email. The message remains in Outbox for another retry."
        });
      }

      /*
       * Resend accepted the retry.
       * Convert the SAME Outbox row into Sent.
       */
      const finalizedResult = await queryWithRetry(
        `UPDATE mail_messages
         SET resend_email_id = $3,
             folder = 'sent',
             delivery_status = 'sent',
             last_delivery_error = NULL,
             sent_at = now(),
             delivered_at = now(),
             updated_at = now()
         WHERE id = $1
           AND mailbox_id = $2
           AND folder = 'outbox'
           AND delivery_status = 'sending'
         RETURNING
           id,
           resend_email_id,
           message_id,
           thread_id,
           created_at,
           sent_at,
           delivered_at`,
        [
          message.id,
          mailbox.id,
          result?.data?.id || null
        ]
      );

      if (!finalizedResult.rows.length) {
        throw new Error(
          "The message was accepted by the mail provider but could not be finalized."
        );
      }

      const finalized = finalizedResult.rows[0];

      return res.status(200).json({
        success: true,
        message: {
          id: finalized.id,
          resend_email_id: finalized.resend_email_id,
          message_id: finalized.message_id,
          thread_id: finalized.thread_id,
          sent_at: finalized.sent_at,
          delivered_at: finalized.delivered_at
        }
      });
    } catch (error) {
      console.error("[MAILBOX RETRY]", error.message);

      /*
       * Only return the message to "failed" when the provider did NOT
       * accept it. If Resend accepted the message but database
       * finalization failed, leave it in "sending" so a retry cannot
       * immediately send the same email twice.
       */
      if (message?.id && !providerAccepted) {
        try {
          await queryWithRetry(
            `UPDATE mail_messages
             SET delivery_status = 'failed',
                 last_delivery_error = $3,
                 updated_at = now()
             WHERE id = $1
               AND mailbox_id = $2
               AND folder = 'outbox'
               AND delivery_status = 'sending'`,
            [
              message.id,
              message.mailbox_id,
              error.message || "Unable to retry email."
            ]
          );
        } catch (stateError) {
          console.error(
            "[MAILBOX RETRY] Failed to restore failed state:",
            stateError.message
          );
        }
      } else if (message?.id && providerAccepted) {
        console.error(
          "[MAILBOX RETRY] Provider accepted message but finalization failed; leaving delivery_status=sending to prevent duplicate retry."
        );
      }

      return res.status(502).json({
        success: false,
        error: providerAccepted
          ? "Email was accepted by the mail provider, but delivery status could not be finalized. Do not retry this message yet."
          : "Unable to retry email. The message remains in Outbox for another retry."
      });
    }
  }
);

app.post(
  "/api/mailbox/drafts",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const draftId = cleanString(req.body?.draftId, 100);
      const to = cleanString(req.body?.to, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const cc = cleanString(req.body?.cc, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const bcc = cleanString(req.body?.bcc, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const subject = cleanString(req.body?.subject, 200);
      const textBody = cleanString(req.body?.body, 10000);
      const replyToMessageId = cleanString(req.body?.replyToMessageId, 100);

      if (
        to.some((email) => !isValidEmail(email)) ||
        cc.some((email) => !isValidEmail(email)) ||
        bcc.some((email) => !isValidEmail(email))
      ) {
        return res.status(400).json({
          success: false,
          error: "One or more recipients are invalid."
        });
      }

      const mailboxResult = await queryWithRetry(
        `SELECT id, email, display_name
         FROM mailboxes
         WHERE user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (!mailboxResult.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Mailbox not provisioned."
        });
      }

      const mailbox = mailboxResult.rows[0];

      let parentMessage = null;

      if (replyToMessageId) {
        const parentResult = await queryWithRetry(
          `SELECT id, message_id, thread_id, subject
           FROM mail_messages
           WHERE id = $1
             AND mailbox_id = $2
           LIMIT 1`,
          [replyToMessageId, mailbox.id]
        );

        parentMessage = parentResult.rows[0] || null;

        if (!parentMessage) {
          return res.status(404).json({
            success: false,
            error: "The message you are replying to could not be found."
          });
        }
      }

      const recipients = [
        ...to.map((email) => ({ type: "to", email })),
        ...cc.map((email) => ({ type: "cc", email })),
        ...bcc.map((email) => ({ type: "bcc", email }))
      ];

      let message;

      if (draftId) {
        const existingResult = await queryWithRetry(
          `SELECT
             id,
             mailbox_id,
             folder,
             thread_id,
             in_reply_to
           FROM mail_messages
           WHERE id = $1
             AND mailbox_id = $2
           LIMIT 1`,
          [draftId, mailbox.id]
        );

        if (!existingResult.rows.length) {
          return res.status(404).json({
            success: false,
            error: "Draft not found."
          });
        }

        if (existingResult.rows[0].folder !== "drafts") {
          return res.status(409).json({
            success: false,
            error: "Only draft messages can be edited."
          });
        }

        // When editing an existing draft without a new
        // replyToMessageId, preserve its existing thread
        // relationship. If a new parent message is supplied,
        // explicitly rebuild the reply relationship.
        const threadId =
          parentMessage?.thread_id ||
          parentMessage?.message_id ||
          existingResult.rows[0].thread_id ||
          null;

        const inReplyTo =
          parentMessage?.message_id ||
          existingResult.rows[0].in_reply_to ||
          null;

        const updateResult = await queryWithRetry(
          `UPDATE mail_messages
           SET subject = $1,
               text_body = $2,
               thread_id = $3,
               in_reply_to = $4,
               updated_at = now()
           WHERE id = $5
             AND mailbox_id = $6
             AND folder = 'drafts'
           RETURNING id, folder, subject, created_at, updated_at`,
          [
            subject,
            textBody,
            threadId,
            inReplyTo,
            draftId,
            mailbox.id
          ]
        );

        message = updateResult.rows[0];

        await queryWithRetry(
          `DELETE FROM mail_recipients
           WHERE message_id = $1`,
          [message.id]
        );
      } else {
        const generatedMessageId =
          `<${crypto.randomUUID()}@uscourier.app>`;

        const threadId =
          parentMessage?.thread_id ||
          parentMessage?.message_id ||
          generatedMessageId;

        const inReplyTo =
          parentMessage?.message_id ||
          null;

        const messageResult = await queryWithRetry(
          `INSERT INTO mail_messages (
             mailbox_id,
             message_id,
             in_reply_to,
             thread_id,
             sender_name,
             sender_email,
             subject,
             text_body,
             folder,
             is_read
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'drafts', true)
           RETURNING id, folder, subject, created_at, updated_at`,
          [
            mailbox.id,
            generatedMessageId,
            inReplyTo,
            threadId,
            mailbox.display_name,
            mailbox.email,
            subject,
            textBody
          ]
        );

        message = messageResult.rows[0];
      }

      for (const recipient of recipients) {
        await queryWithRetry(
          `INSERT INTO mail_recipients (
             message_id,
             recipient_type,
             email
           ) VALUES ($1, $2, $3)`,
          [
            message.id,
            recipient.type,
            recipient.email
          ]
        );
      }

      return res.status(draftId ? 200 : 201).json({
        success: true,
        draft_id: message.id,
        message: {
          ...message,
          draft_id: message.id
        }
      });
    } catch (error) {
      console.error("[MAILBOX DRAFT]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to save draft."
      });
    }
  }
);

app.get(
  "/api/mailbox/drafts/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const mailboxResult = await queryWithRetry(
        `SELECT id
         FROM mailboxes
         WHERE user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (!mailboxResult.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Mailbox not provisioned."
        });
      }

      const result = await queryWithRetry(
        `SELECT
           m.id,
           m.subject,
           m.text_body,
           m.thread_id,
           m.in_reply_to,
           m.created_at,
           m.updated_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'type', r.recipient_type,
                 'email', r.email,
                 'display_name', r.display_name
               )
               ORDER BY r.recipient_type, r.email
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'::json
           ) AS recipients
         FROM mail_messages m
         LEFT JOIN mail_recipients r
           ON r.message_id = m.id
         WHERE m.id = $1
           AND m.mailbox_id = $2
           AND m.folder = 'drafts'
         GROUP BY
           m.id,
           m.subject,
           m.text_body,
           m.thread_id,
           m.in_reply_to,
           m.created_at,
           m.updated_at
         LIMIT 1`,
        [
          req.params.id,
          mailboxResult.rows[0].id
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Draft not found."
        });
      }

      return res.json({
        success: true,
        draft: result.rows[0]
      });
    } catch (error) {
      console.error("[MAILBOX DRAFT GET]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to load draft."
      });
    }
  }
);

app.delete(
  "/api/mailbox/drafts/:id",
  requireSameOrigin,
  authMiddleware,
  async (req, res) => {
    try {
      const mailboxResult = await queryWithRetry(
        `SELECT id
         FROM mailboxes
         WHERE user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (!mailboxResult.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Mailbox not provisioned."
        });
      }

      const result = await queryWithRetry(
        `DELETE FROM mail_messages
         WHERE id = $1
           AND mailbox_id = $2
           AND folder = 'drafts'
         RETURNING id`,
        [
          req.params.id,
          mailboxResult.rows[0].id
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Draft not found."
        });
      }

      return res.json({
        success: true,
        message: {
          id: result.rows[0].id
        }
      });
    } catch (error) {
      console.error("[MAILBOX DRAFT DELETE]", error.message);

      return res.status(500).json({
        success: false,
        error: "Unable to delete draft."
      });
    }
  }
);


app.post(
  "/api/mailbox/send",
  rateLimit("mail-send", MAIL_SEND_WINDOW_MS, MAIL_SEND_MAX_ATTEMPTS),
  requireSameOrigin,
  authMiddleware,
  handleMailAttachmentUpload,
  async (req, res) => {
    try {
      if (!resend) {
        return res.status(503).json({
          success: false,
          error: "Email service is not configured."
        });
      }

      const to = cleanString(req.body?.to, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const cc = cleanString(req.body?.cc, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const bcc = cleanString(req.body?.bcc, 2000)
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const subject = cleanString(req.body?.subject, 200);
      const textBody = cleanString(req.body?.body, 10000);
      const draftId = cleanString(req.body?.draftId, 100);
      const replyToMessageId = cleanString(
        req.body?.replyToMessageId,
        100
      );

      const uploadedFiles = Array.isArray(req.files)
        ? req.files
        : [];

      const attachmentValidation =
        validateMailAttachments(uploadedFiles);

      if (!attachmentValidation.valid) {
        return res.status(400).json({
          success: false,
          error: attachmentValidation.error
        });
      }

      if (!to.length || to.some((email) => !isValidEmail(email))) {
        return res.status(400).json({
          success: false,
          error: "Please provide at least one valid recipient."
        });
      }

      if (cc.some((email) => !isValidEmail(email)) || bcc.some((email) => !isValidEmail(email))) {
        return res.status(400).json({
          success: false,
          error: "One or more recipients are invalid."
        });
      }

      if (!textBody) {
        return res.status(400).json({
          success: false,
          error: "Message body is required."
        });
      }

      const mailboxResult = await queryWithRetry(
        `SELECT id, email, display_name
         FROM mailboxes
         WHERE user_id = $1
           AND status = 'active'
         LIMIT 1`,
        [req.user.id]
      );

      if (!mailboxResult.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Mailbox not provisioned."
        });
      }

      const mailbox = mailboxResult.rows[0];

      let draftMessage = null;

      if (draftId) {
        const draftResult = await queryWithRetry(
          `SELECT id, folder
           FROM mail_messages
           WHERE id = $1
             AND mailbox_id = $2
           LIMIT 1`,
          [draftId, mailbox.id]
        );

        draftMessage = draftResult.rows[0] || null;

        if (!draftMessage) {
          return res.status(404).json({
            success: false,
            error: "Draft not found."
          });
        }

        if (draftMessage.folder !== "drafts") {
          return res.status(409).json({
            success: false,
            error: "Only a draft can be sent using draftId."
          });
        }
      }

      const generatedMessageId = `<${crypto.randomUUID()}@uscourier.app>`;

      let parentMessage = null;
      if (replyToMessageId) {
        const parentResult = await queryWithRetry(
          `SELECT id, message_id, in_reply_to, thread_id, subject
           FROM mail_messages
           WHERE id = $1
             AND mailbox_id = $2
           LIMIT 1`,
          [replyToMessageId, mailbox.id]
        );
        parentMessage = parentResult.rows[0] || null;

        if (!parentMessage) {
          return res.status(404).json({
            success: false,
            error: "The message you are replying to could not be found."
          });
        }
      }

      const inReplyTo = parentMessage?.message_id || null;
      const threadId = parentMessage?.thread_id || parentMessage?.message_id || generatedMessageId;
      const references = parentMessage?.message_id || null;

      const htmlBody = textBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br>");

      const safeSubject = String(subject || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      const brandedHtmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeSubject} | US COURIER</title>
</head>

<body style="
  margin:0;
  padding:0;
  width:100%;
  background:#f3f6fa;
  color:#172033;
  font-family:Arial,Helvetica,sans-serif;
">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="width:100%;margin:0;padding:28px 12px;background:#f3f6fa;">
    <tr>
      <td align="center">

        <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0"
          style="
            width:100%;
            max-width:680px;
            background:#ffffff;
            border:1px solid #dfe5ee;
            border-radius:14px;
            overflow:hidden;
          ">

          <tr>
            <td style="
              padding:22px 28px;
              background:#111827;
              border-bottom:4px solid #c9a227;
            ">

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="52" valign="middle">
                    <div style="
                      width:42px;
                      height:42px;
                      line-height:42px;
                      text-align:center;
                      background:#111827;
                      border:2px solid #c9a227;
                      border-radius:9px;
                      color:#ffffff;
                      font-size:21px;
                      font-weight:900;
                    ">UC</div>
                  </td>

                  <td valign="middle" style="padding-left:12px;">
                    <div style="
                      color:#ffffff;
                      font-size:18px;
                      line-height:22px;
                      font-weight:900;
                      letter-spacing:2px;
                    ">US COURIER</div>

                    <div style="
                      color:#c9a227;
                      font-size:9px;
                      line-height:14px;
                      font-weight:800;
                      letter-spacing:2px;
                    ">LOGISTICS &amp; DELIVERY</div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding:30px 30px 8px 30px;">

              <div style="
                color:#173b76;
                font-size:25px;
                line-height:34px;
                font-weight:800;
              ">${safeSubject}</div>

              <div style="
                width:48px;
                height:3px;
                margin-top:12px;
                background:#c9a227;
              "></div>

            </td>
          </tr>

          <tr>
            <td style="
              padding:12px 30px 30px 30px;
              color:#34445d;
              font-size:15px;
              line-height:1.7;
            ">

              <div style="
                background:#f7f9fc;
                border:1px solid #e2e7ef;
                border-left:4px solid #c9a227;
                border-radius:8px;
                padding:20px;
                white-space:normal;
                word-break:break-word;
              ">
                ${htmlBody}
              </div>

            </td>
          </tr>

          <tr>
            <td style="
              padding:22px 30px;
              background:#f7f9fc;
              border-top:1px solid #e3e8ef;
            ">

              <div style="
                color:#173b76;
                font-size:14px;
                line-height:20px;
                font-weight:800;
              ">US COURIER</div>

              <div style="
                margin-top:4px;
                color:#68778c;
                font-size:12px;
                line-height:18px;
              ">
                Reliable logistics. Professional delivery.
              </div>

              <div style="
                margin-top:12px;
                font-size:12px;
                line-height:18px;
              ">
                <a
                  href="https://uscourier.app"
                  style="
                    color:#173b76;
                    font-weight:700;
                    text-decoration:none;
                  "
                >uscourier.app</a>
              </div>

              <div style="
                margin-top:14px;
                padding-top:14px;
                border-top:1px solid #dfe5ee;
                color:#8793a4;
                font-size:11px;
                line-height:17px;
              ">
                This email was sent from the US COURIER mail service.
                Please treat any confidential shipment or account
                information with care.
              </div>

            </td>
          </tr>

        </table>

        <div style="
          max-width:680px;
          padding:14px 12px 0;
          color:#8a96a7;
          font-size:10px;
          line-height:16px;
          text-align:center;
        ">
          &copy; ${new Date().getFullYear()} US COURIER. All rights reserved.
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
`;


      /*
       * Create the persistent Outbox record BEFORE contacting Resend.
       *
       * This guarantees that an accepted message remains visible in
       * the user's Outbox even when the external delivery provider
       * later fails.
       */
      const outboxResult = await queryWithRetry(
        `INSERT INTO mail_messages (
           mailbox_id,
           message_id,
           in_reply_to,
           thread_id,
           sender_name,
           sender_email,
           subject,
           text_body,
           html_body,
           folder,
           is_read,
           delivery_status,
           delivery_attempts,
           queued_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           'outbox',
           true,
           'queued',
           0,
           now()
         )
         RETURNING id, message_id, thread_id, created_at, queued_at`,
        [
          mailbox.id,
          generatedMessageId,
          inReplyTo,
          threadId,
          mailbox.display_name,
          mailbox.email,
          subject,
          textBody,
          brandedHtmlBody
        ]
      );

      const outboxMessageId = outboxResult.rows[0].id;

      /*
       * Store outgoing attachments in private Vercel Blob before
       * sending the email.
       *
       * The browser never receives the Blob token and the private
       * Blob URL is never exposed directly to the client.
       */
      const attachmentBatchId = crypto.randomUUID();
      const storedAttachments = [];

      if (uploadedFiles.length) {
        if (!isBlobStorageConfigured()) {
          try {
            await queryWithRetry(
              `UPDATE mail_messages
               SET delivery_status = 'failed',
                   last_delivery_error = $3,
                   updated_at = now()
               WHERE id = $1
                 AND mailbox_id = $2
                 AND folder = 'outbox'`,
              [
                outboxMessageId,
                mailbox.id,
                "Attachment storage is not configured."
              ]
            );
          } catch (stateError) {
            console.error(
              "[MAILBOX OUTBOX] Failed to record attachment-storage state:",
              stateError.message
            );
          }

          return res.status(503).json({
            success: false,
            error: "Attachment storage is not configured."
          });
        }

        try {
          for (const file of uploadedFiles) {
            const stored = await uploadMailAttachmentBlob(
              mailbox.id,
              attachmentBatchId,
              file
            );

            storedAttachments.push({
              file,
              ...stored
            });
          }
        } catch (storageError) {
          console.error(
            "[MAILBOX BLOB] Outgoing upload failed:",
            storageError.message
          );

          await deleteMailAttachmentBlobs(storedAttachments);

          try {
            await queryWithRetry(
              `UPDATE mail_messages
               SET delivery_status = 'failed',
                   last_delivery_error = $3,
                   updated_at = now()
               WHERE id = $1
                 AND mailbox_id = $2
                 AND folder = 'outbox'`,
              [
                outboxMessageId,
                mailbox.id,
                "Unable to store one or more attachments."
              ]
            );
          } catch (stateError) {
            console.error(
              "[MAILBOX OUTBOX] Failed to record attachment-storage failure:",
              stateError.message
            );
          }

          return res.status(502).json({
            success: false,
            error: "Unable to store one or more attachments."
          });
        }
      }

      /*
       * Persist recipients and attachment metadata on the Outbox
       * record BEFORE contacting Resend.
       *
       * This makes the Outbox record self-contained so a failed
       * delivery can later be retried without losing recipients
       * or attachment references.
       */
      const recipients = [
        ...to.map((email) => ({ type: "to", email })),
        ...cc.map((email) => ({ type: "cc", email })),
        ...bcc.map((email) => ({ type: "bcc", email }))
      ];

      try {
        for (const recipient of recipients) {
          await queryWithRetry(
            `INSERT INTO mail_recipients (
               message_id,
               recipient_type,
               email
             ) VALUES ($1, $2, $3)`,
            [outboxMessageId, recipient.type, recipient.email]
          );
        }

        for (const stored of storedAttachments) {
          await queryWithRetry(
            `INSERT INTO mail_attachments (
               message_id,
               filename,
               content_type,
               content_disposition,
               size_bytes,
               storage_provider,
               storage_path,
               storage_size_bytes,
               storage_uploaded_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
            [
              outboxMessageId,
              stored.file.originalname,
              stored.file.mimetype,
              "attachment",
              stored.file.size,
              "vercel_blob",
              stored.pathname,
              stored.sizeBytes
            ]
          );
        }
      } catch (metadataError) {
        console.error(
          "[MAILBOX OUTBOX] Metadata preparation failed:",
          metadataError.message
        );

        await deleteMailAttachmentBlobs(storedAttachments);

        try {
          await queryWithRetry(
            `UPDATE mail_messages
             SET delivery_status = 'failed',
                 last_delivery_error = $3,
                 updated_at = now()
             WHERE id = $1
               AND mailbox_id = $2
               AND folder = 'outbox'`,
            [
              outboxMessageId,
              mailbox.id,
              "Unable to prepare message metadata for delivery."
            ]
          );
        } catch (stateError) {
          console.error(
            "[MAILBOX OUTBOX] Failed to record metadata failure:",
            stateError.message
          );
        }

        return res.status(502).json({
          success: false,
          error: "Unable to prepare message for delivery."
        });
      }

      /*
       * Claim the queued message for delivery.
       *
       * This gives the Outbox a real delivery state while Resend
       * is processing the message.
       */
      await queryWithRetry(
        `UPDATE mail_messages
         SET delivery_status = 'sending',
             delivery_attempts = delivery_attempts + 1,
             last_delivery_error = NULL,
             updated_at = now()
         WHERE id = $1
           AND mailbox_id = $2
           AND folder = 'outbox'`,
        [outboxMessageId, mailbox.id]
      );

      let result;
      let providerAccepted = false;

      try {
        result = await resend.emails.send({
          from: `${mailbox.display_name} <${mailbox.email}>`,
          to,
          cc: cc.length ? cc : undefined,
          bcc: bcc.length ? bcc : undefined,
          subject,
          text: textBody,
          html: brandedHtmlBody,
          attachments: uploadedFiles.length
            ? uploadedFiles.map((file) => ({
                content: file.buffer,
                filename: file.originalname,
                contentType: file.mimetype
              }))
            : undefined,
          headers: {
            "Message-ID": generatedMessageId,
            ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
            ...(references ? { "References": references } : {})
          }
        });

        if (!result?.error) {
          providerAccepted = true;
        }
      } catch (sendError) {
        console.error(
          "[MAILBOX SEND]",
          sendError.message
        );

        /*
         * Keep the private Blob attachments when delivery fails.
         * The Outbox record retains their metadata so a later retry
         * can reuse the stored files.
         */

        try {
          await queryWithRetry(
            `UPDATE mail_messages
             SET delivery_status = 'failed',
                 last_delivery_error = $3,
                 updated_at = now()
             WHERE id = $1
               AND mailbox_id = $2
               AND folder = 'outbox'`,
            [
              outboxMessageId,
              mailbox.id,
              sendError.message || "Unable to send email."
            ]
          );
        } catch (stateError) {
          console.error(
            "[MAILBOX OUTBOX] Failed to record send failure:",
            stateError.message
          );
        }

        return res.status(502).json({
          success: false,
          error: "Unable to send email."
        });
      }

      if (result?.error) {
        console.error("[MAILBOX SEND]", result.error.message);

        /*
         * Keep the private Blob attachments when Resend rejects the
         * message. They remain available for Outbox retry.
         */

        try {
          await queryWithRetry(
            `UPDATE mail_messages
             SET delivery_status = 'failed',
                 last_delivery_error = $3,
                 updated_at = now()
             WHERE id = $1
               AND mailbox_id = $2
               AND folder = 'outbox'`,
            [
              outboxMessageId,
              mailbox.id,
              result.error.message || "Unable to send email."
            ]
          );
        } catch (stateError) {
          console.error(
            "[MAILBOX OUTBOX] Failed to record provider failure:",
            stateError.message
          );
        }

        return res.status(502).json({
          success: false,
          error: "Unable to send email."
        });
      }

      /*
       * Resend accepted the message.
       * Convert the existing Outbox record into the Sent record.
       * Do NOT create a second mail_messages row.
       */
      let messageResult;

      try {
        messageResult = await queryWithRetry(
          `UPDATE mail_messages
           SET resend_email_id = $3,
               folder = 'sent',
               delivery_status = 'sent',
               last_delivery_error = NULL,
               sent_at = now(),
               delivered_at = now(),
               updated_at = now()
           WHERE id = $1
             AND mailbox_id = $2
             AND folder = 'outbox'
           RETURNING id, resend_email_id, message_id, thread_id, created_at, sent_at, delivered_at`,
          [
            outboxMessageId,
            mailbox.id,
            result?.data?.id || null
          ]
        );

        if (!messageResult.rows.length) {
          throw new Error("Outbox message could not be finalized as sent.");
        }
      } catch (finalizeError) {
        console.error(
          "[MAILBOX SEND] Provider accepted email but Sent finalization failed:",
          finalizeError.message
        );

        /*
         * Resend has already accepted the email.
         * Keep the Outbox row in "sending" so the client cannot
         * immediately retry and create a duplicate delivery.
         */
        return res.status(502).json({
          success: false,
          providerAccepted: true,
          retryable: false,
          error:
            "Email was accepted by the mail provider, but delivery status could not be finalized. Do not retry this message yet."
        });
      }

      const messageId = messageResult.rows[0].id;

      if (draftMessage) {
        try {
          await queryWithRetry(
            `DELETE FROM mail_messages
             WHERE id = $1
               AND mailbox_id = $2
               AND folder = 'drafts'`,
            [draftMessage.id, mailbox.id]
          );
        } catch (draftCleanupError) {
          console.error(
            "[MAILBOX SEND] Draft cleanup failed:",
            draftCleanupError.message
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: {
          id: messageId,
          resend_email_id: result?.data?.id || null,
          message_id: generatedMessageId,
          thread_id: threadId
        }
      });
    } catch (error) {
      console.error("[MAILBOX SEND]", error.message);
      return res.status(500).json({
        success: false,
        error: "Unable to send email right now."
      });
    }
  }
);


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

    if (
      user.role !== "Admin" &&
      user.role !== "Super Admin"
    ) {
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
// ROLE-AWARE ADMIN PORTAL AUTHORIZATION
// ============================================================

async function adminPortalMiddleware(req, res, next) {
  try {
    /*
     * The Admin API uses the same canonical main-domain origin
     * as the Admin Portal: https://uscourier.app/admin
     *
     * The legacy account subdomain is no longer an API origin.
     * Keep the hostname check server-side so authenticated
     * admin APIs cannot be operated through another hostname.
     */
    if (getRequestHostname(req) !== "uscourier.app") {
      return res.status(404).json({
        error: "Not Found"
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

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

    if (!ADMIN_ALLOWED_ROLES.has(user.role)) {
      return res.status(403).json({
        error: "Portal access denied"
      });
    }

    req.admin = user;

    next();
  } catch (error) {
    console.error(
      "[ADMIN PORTAL AUTH]",
      error.message
    );

    return res.status(500).json({
      error: "Authorization check failed"
    });
  }
}

// ============================================================

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
    let createdSessionId = null;

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
          password_hash,
          status
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

      /*
       * Disabled staff accounts must never receive a
       * new authenticated session.
       */
      if (user.status !== "Active") {
        return res.status(403).json({
          error: "Portal access denied"
        });
      }

      if (!user.password_hash) {
        return res.status(401).json({
          error: "Invalid Operator Credentials"
        });
      }

      /*
       * Prevent a missing or unexpected database role from
       * automatically becoming Administrator.
       */
      if (!ADMIN_ALLOWED_ROLES.has(user.role)) {
        return res.status(403).json({
          error: "Portal access denied"
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

      /*
       * Capture the connection information for the staff
       * session. x-forwarded-for may contain a comma-separated
       * proxy chain, so retain only the first address.
       */
      const forwardedFor = String(
        req.headers["x-forwarded-for"] || ""
      );

      const ipAddress = (
        forwardedFor.split(",")[0].trim() ||
        String(req.socket?.remoteAddress || "").trim()
      ).slice(0, 200) || null;

      const userAgent = cleanString(
        req.headers["user-agent"],
        1000
      ) || null;

      /*
       * Create the PostgreSQL-backed staff session BEFORE
       * issuing the JWT. The JWT references this session by UUID.
       */
      const sessionResult = await queryWithRetry(
        `
        INSERT INTO staff_sessions (
          user_id,
          ip_address,
          user_agent,
          status
        )
        VALUES ($1, $2, $3, 'Active')
        RETURNING id
        `,
        [
          user.id,
          ipAddress,
          userAgent
        ]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error("Unable to create staff session");
      }

      const sessionId = sessionResult.rows[0].id;
      createdSessionId = sessionId;

      /*
       * Record the successful login against the staff account.
       */
      await queryWithRetry(
        `
        UPDATE users
        SET
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [user.id]
      );

      /*
       * The JWT is still only an authentication reference.
       * Its sid must correspond to an Active PostgreSQL session.
       */
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          sid: sessionId
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
       * Authentication remains cookie-based. The JWT itself
       * is never returned to browser JavaScript.
       */
      try {
        if (typeof writeAdminAuditLog === "function") {
          await writeAdminAuditLog({
            adminId: user.id,
            adminEmail: user.email,
            action: "auth.login",
            targetType: "staff_session",
            targetId: String(sessionId),
            details: JSON.stringify({
              method: "password"
            }),
            ipAddress
          });
        }
      } catch (auditError) {
        console.error(
          "[AUTH LOGIN AUDIT]",
          auditError.message
        );
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      /*
       * If PostgreSQL created the staff session but a later
       * login step failed, immediately invalidate that session.
       * This prevents orphaned Active sessions.
       */
      if (createdSessionId) {
        try {
          await queryWithRetry(
            `
            UPDATE staff_sessions
            SET
              status = 'Terminated',
              terminated_at = NOW(),
              last_activity_at = NOW()
            WHERE id = $1::uuid
              AND status = 'Active'
            `,
            [createdSessionId]
          );
        } catch (cleanupError) {
          console.error(
            "[AUTH LOGIN SESSION CLEANUP]",
            cleanupError.message
          );
        }
      }

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
  async (req, res) => {
    let token = req.cookies.us_courier_token;

    if (!token) {
      const header = req.headers.authorization || "";

      if (header.startsWith("Bearer ")) {
        token = header.slice(7);
      }
    }

    try {
      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            JWT_SECRET
          );

          if (decoded && decoded.id && decoded.sid) {
            const sessionResult = await queryWithRetry(
              `
              UPDATE staff_sessions
              SET
                status = 'Logged Out',
                logout_at = NOW(),
                last_activity_at = NOW()
              WHERE id = $1::uuid
                AND user_id = $2
                AND status = 'Active'
              RETURNING id
              `,
              [
                decoded.sid,
                decoded.id
              ]
            );

            if (sessionResult.rows.length > 0) {
              try {
                if (typeof writeAdminAuditLog === "function") {
                  await writeAdminAuditLog({
                    adminId: decoded.id,
                    adminEmail: decoded.email || null,
                    action: "auth.logout",
                    targetType: "staff_session",
                    targetId: String(decoded.sid),
                    details: JSON.stringify({
                      method: "password"
                    }),
                    ipAddress: (
                      String(
                        req.headers["x-forwarded-for"] || ""
                      ).split(",")[0].trim() ||
                      String(
                        req.socket?.remoteAddress || ""
                      ).trim()
                    ).slice(0, 200) || null
                  });
                }
              } catch (auditError) {
                console.error(
                  "[AUTH LOGOUT AUDIT]",
                  auditError.message
                );
              }
            }
          }
        } catch (sessionError) {
          /*
           * Logout must still clear the browser cookie if the
           * JWT is expired, malformed, or the database session
           * can no longer be updated.
           */
          console.warn(
            "[AUTH LOGOUT SESSION]",
            sessionError.message
          );
        }
      }
    } catch (error) {
      console.error(
        "[AUTH LOGOUT]",
        error.message
      );
    }

    /*
     * Always clear the authentication cookie.
     */
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
  adminPortalMiddleware,
  requireAdminPermission("dashboard.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("shipments.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("shipments.create"),
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
  adminPortalMiddleware,
  requireAdminPermission("shipments.delete"),
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

      // Remove dependent tracking history first.
      // This keeps deletion deterministic even when the FK does
      // not use ON DELETE CASCADE.
      await c.query(
        `
        DELETE FROM shipment_events
        WHERE shipment_id = $1
        `,
        [shipmentId]
      );

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
// ROLE-BASED ACCESS CONTROL
// ============================================================

/*
 * Centralized RBAC policy.
 *
 * Keep the existing users.role values exactly as stored in
 * PostgreSQL. Do not rename legacy roles here.
 *
 * "admin" remains the compatibility gate for the existing
 * administrator portal. The permissions below are used by
 * individual API operations when role-aware access is enabled.
 */

const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  "Super Admin": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "shipments.delete",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "messages.delete",
    "staff.view",
    "staff.create",
    "staff.update",
    "staff.role",
    "staff.password",
    "settings.view",
    "settings.update",
    "profile.view",
    "profile.update",
    "profile.password",
    "developer.view",
    "developer.health",
    "developer.database",
    "developer.sessions",
    "developer.audit",
    "developer.environment",
    "developer.deployments",
    "developer.settings",
    "mail.view",
    "mail.users.view",
    "mail.users.create",
    "mail.users.update",
    "mail.users.password",
    "mail.users.disable"
  ]),

  "Admin": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "shipments.delete",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "messages.delete",
    "staff.view",
    "staff.create",
    "staff.update",
    "staff.role",
    "staff.password",
    "settings.view",
    "settings.update",
    "profile.view",
    "profile.update",
    "profile.password",
    "developer.view",
    "developer.health",
    "developer.database",
    "developer.sessions",
    "developer.audit",
    "developer.environment",
    "developer.deployments",
    "developer.settings"
  ]),

  "Operations Manager": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "shipments.delete",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "messages.delete",
    "staff.view",
    "staff.create",
    "staff.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Dispatcher": new Set([
    "dashboard.view",
    "shipments.view",
    "shipments.create",
    "shipments.update",
    "tracking.view",
    "tracking.update",
    "messages.view",
    "messages.reply",
    "messages.read",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Driver": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Trunk Driver": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Cargo Personnel": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Warehouse Personnel": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "tracking.update",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Customer Service": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "messages.view",
    "messages.reply",
    "messages.read",
    "profile.view",
    "profile.update",
    "profile.password"
  ]),

  "Customer": new Set([
    "dashboard.view",
    "shipments.view",
    "tracking.view",
    "profile.view",
    "profile.update",
    "profile.password"
  ])
});


function hasAdminPermission(role, permission) {
  const permissions =
    ADMIN_ROLE_PERMISSIONS[String(role || "")];

  return Boolean(
    permissions &&
    permissions.has(permission)
  );
}


function requireAdminPermission(permission) {

  return function(req, res, next) {

    const role =
      req.admin?.role ||
      req.user?.role ||
      "";

    if (!hasAdminPermission(role, permission)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions."
      });
    }

    next();
  };

}


// ============================================================
// ADMIN USER MANAGEMENT
// ============================================================

const ADMIN_ALLOWED_ROLES = new Set([
  "Super Admin",
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
  adminPortalMiddleware,
  requireAdminPermission("staff.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("staff.create"),
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

      /*
       * Super Admin accounts may only be created
       * by an existing Super Admin.
       *
       * Backend enforcement is required even when
       * the frontend hides the role option.
       */
      if (
        role === "Super Admin" &&
        req.admin?.role !== "Super Admin"
      ) {
        return res.status(403).json({
          success: false,
          error: "Only a Super Admin can create a Super Admin account."
        });
      }

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
  adminPortalMiddleware,
  requireAdminPermission("staff.update"),
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

    if (
      role === "Super Admin" &&
      req.admin?.role !== "Super Admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Only a Super Admin can assign the Super Admin role."
      });
    }

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

      const administratorRoles = new Set([
        "Admin",
        "Super Admin"
      ]);

      /*
       * An administrator cannot remove their own
       * administrator privileges through this endpoint.
       */

      if (
        Number(req.admin.id) === userId &&
        !administratorRoles.has(role)
      ) {
        return res.status(400).json({
          success: false,
          error: "You cannot remove your own Administrator role."
        });
      }

      /*
       * Prevent the system from being left without an
       * administrator account.
       */

      if (
        administratorRoles.has(target.role) &&
        !administratorRoles.has(role)
      ) {
        const adminCountResult =
          await queryWithRetry(
            `
            SELECT COUNT(*)::int AS count
            FROM users
            WHERE role IN ('Admin', 'Super Admin')
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



// ============================================================
// ADMIN MAIL MANAGEMENT
// ============================================================

app.get(
  "/api/admin/mail",
  authMiddleware,
  adminPortalMiddleware,
  requireAdminPermission("mail.users.view"),
  async (req, res) => {
    try {
      const result = await queryWithRetry(
        `
        SELECT
          u.id AS user_id,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role,
          u.status AS user_status,
          m.id AS mailbox_id,
          m.email AS mailbox_email,
          m.display_name AS mailbox_display_name,
          m.status AS mailbox_status,
          m.created_at AS mailbox_created_at,
          m.updated_at AS mailbox_updated_at
        FROM users u
        LEFT JOIN mailboxes m
          ON m.user_id = u.id
        ORDER BY
          CASE
            WHEN m.id IS NULL THEN 1
            ELSE 0
          END,
          LOWER(COALESCE(m.email, u.email)),
          u.id
        `
      );

      const mailboxes = result.rows.map((row) => ({
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          role: row.user_role,
          status: row.user_status
        },
        mailbox: row.mailbox_id
          ? {
              id: row.mailbox_id,
              email: row.mailbox_email,
              display_name: row.mailbox_display_name,
              status: row.mailbox_status,
              created_at: row.mailbox_created_at,
              updated_at: row.mailbox_updated_at
            }
          : null
      }));

      return res.json({
        success: true,
        count: mailboxes.length,
        mailboxes
      });
    } catch (error) {
      console.error(
        "[ADMIN MAIL LIST]",
        error.message
      );

      return res.status(500).json({
        success: false,
        error: "Unable to retrieve mail management data."
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
  adminPortalMiddleware,
  requireAdminPermission("profile.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("profile.update"),
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
  adminPortalMiddleware,
  requireAdminPermission("profile.password"),
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
  adminPortalMiddleware,
  requireAdminPermission("tracking.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("tracking.update"),
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

    const latitude =
      b.latitude === undefined ||
      b.latitude === null ||
      b.latitude === ""
        ? null
        : Number(b.latitude);

    const longitude =
      b.longitude === undefined ||
      b.longitude === null ||
      b.longitude === ""
        ? null
        : Number(b.longitude);

    if (
      latitude !== null &&
      (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Latitude must be between -90 and 90."
      });
    }

    if (
      longitude !== null &&
      (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      )
    ) {
      return res.status(400).json({
        success: false,
        error: "Longitude must be between -180 and 180."
      });
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
          event_time = COALESCE($4::timestamptz, event_time),
          latitude = $5,
          longitude = $6
        WHERE id = $7
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
          latitude,
          longitude,
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

      await writeAdminAuditLog({
        adminId: req.admin?.id || req.user?.id || null,
        adminEmail: req.admin?.email || null,
        action: "tracking_event.update",
        targetType: "shipment_event",
        targetId: String(eventId),
        details: JSON.stringify({
          shipment_id: shipmentId,
          status,
          location: location || null,
          description,
          event_time: eventTime
            ? eventTime.toISOString()
            : null,
          latitude,
          longitude
        }),
        ipAddress:
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          null
      });

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
  adminPortalMiddleware,
  requireAdminPermission("shipments.update"),
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
  adminPortalMiddleware,
  requireAdminPermission("messages.view"),
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
  adminPortalMiddleware,
  requireAdminPermission("messages.reply"),
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
  adminPortalMiddleware,
  requireAdminPermission("messages.read"),
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
  adminPortalMiddleware,
  requireAdminPermission("messages.delete"),
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
              `US COURIER Support <support@uscourier.app>`,
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
// SECURED DEVELOPER CONSOLE
// Must remain before the public catch-all.
// ============================================================

const createDeveloperConsoleRouter = require("./developerConsoleController");

app.use(
  "/api/admin/developer",
  authMiddleware,
  adminPortalMiddleware,
  createDeveloperConsoleRouter({
    queryWithRetry,
    logAdminAction,
    requireAdminPermission,
    requireSameOrigin
  })
);

// ============================================================
// API 404 BOUNDARY
// Prevent unknown /api/* requests from falling through to the
// public website catch-all.
// ============================================================

app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

app.get("*", (req, res) => {
  const hostname = getRequestHostname(req);

  // Legacy admin hostname redirects to the canonical Admin Portal.
  if (
    hostname === "account.uscourier.app" &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    const originalUrl = req.originalUrl || "/";
    const target = originalUrl === "/" ? "/admin" : "/admin" + originalUrl;
    return res.redirect(302, "https://uscourier.app" + target);
  }

  // Never expose the public portal through the legacy admin hostname
  // for non-browser methods.
  if (hostname === "account.uscourier.app") {
    return res.status(404).send("Not Found");
  }

  // Public portal is served only from the main domain.
  return res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ============================================================
// SERVER STARTUP / VERCEL EXPORT
// ============================================================

async function testDatabaseConnectionSafe() {
  if (!DATABASE_CONFIGURED) {
    if (IS_PRODUCTION) {
      console.error("[DATABASE] DATABASE_URL is required in production.");
      return false;
    }

    console.warn("[DATABASE] Local routing-only mode: database connection test skipped.");
    return true;
  }

  try {
    await testDatabaseConnection();
    return true;
  } catch (error) {
    console.error("[DATABASE] Connection failed:", error.message);
    return false;
  }
}

async function startServer() {
  const connected = await testDatabaseConnectionSafe();

  if (!connected) {
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`US COURIER Platform running on Port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
    console.log("Database: Supabase PostgreSQL");
    console.log("Live URL: https://uscourier.app");
console.log("Admin Portal: https://uscourier.app/admin");
  });

  const shutdown = async (signal) => {
    console.log(`[SERVER] ${signal} received. Shutting down...`);

    server.close(async () => {
      try {
        await pool.end();
        console.log("[SERVER] Shutdown complete.");
        process.exit(0);
      } catch (error) {
        console.error("[SERVER] Shutdown error:", error.message);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Local Node.js execution only.
// Vercel imports the Express app instead of calling app.listen().
if (require.main === module) {
  startServer();
}

module.exports = app;
