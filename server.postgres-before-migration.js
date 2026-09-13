"use strict";

require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

const {
  sendContactNotification,
  sendContactReply
} = require("./emailService");

const app = express();

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "us_courier_enterprise_secure_jwt_key_2026";

/* =========================================================
   APPLICATION MIDDLEWARE
========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors());

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/* =========================================================
   SQLITE DATABASE
========================================================= */

const db = new sqlite3.Database(
  path.join(__dirname, "database.sqlite"),
  (err) => {
    if (err) {
      console.error(
        "[DATABASE] Connection error:",
        err.message
      );
    } else {
      console.log(
        "Connected to SQLite Relational Database."
      );
    }
  }
);

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

db.serialize(() => {
  /* -------------------------------------------------------
     USERS
  ------------------------------------------------------- */

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /* -------------------------------------------------------
     SHIPMENTS
  ------------------------------------------------------- */

  db.run(`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT UNIQUE NOT NULL,
      reference TEXT,
      status TEXT DEFAULT 'Pending',
      service_type TEXT,
      priority TEXT DEFAULT 'Standard',

      sender_name TEXT,
      sender_country TEXT,

      recipient_name TEXT,
      recipient_country TEXT,

      origin TEXT,
      destination TEXT,
      current_location TEXT,

      estimated_delivery TEXT,

      package_count INTEGER DEFAULT 1,
      weight REAL,

      currency TEXT DEFAULT 'USD',
      declared_value REAL,

      description TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /* -------------------------------------------------------
     TRACKING EVENTS
  ------------------------------------------------------- */

  db.run(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER,
      status TEXT,
      location TEXT,
      description TEXT,
      event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'System',

      FOREIGN KEY(shipment_id)
      REFERENCES shipments(id)
      ON DELETE CASCADE
    )
  `);

  /* -------------------------------------------------------
     CONTACT MESSAGES
  ------------------------------------------------------- */

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'Unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /* -------------------------------------------------------
     ADMIN ACCOUNT
  ------------------------------------------------------- */

  db.get(
    `
    SELECT *
    FROM users
    WHERE email = ?
    `,
    ["admin@uscourier.app"],
    async (err, row) => {
      if (err) {
        console.error(
          "[DATABASE] Admin lookup error:",
          err.message
        );
        return;
      }

      /*
       * Existing temporary project password.
       *
       * For production deployment this should be moved
       * into an environment variable.
       */
      const hash = await bcrypt.hash(
        "66334121",
        10
      );

      if (!row) {
        db.run(
          `
          INSERT INTO users
          (
            name,
            email,
            password_hash,
            role
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            "Operations Admin",
            "admin@uscourier.app",
            hash,
            "Admin"
          ],
          (insertErr) => {
            if (insertErr) {
              console.error(
                "[DATABASE] Admin creation error:",
                insertErr.message
              );
            }
          }
        );
      } else {
        db.run(
          `
          UPDATE users
          SET password_hash = ?
          WHERE email = ?
          `,
          [
            hash,
            "admin@uscourier.app"
          ],
          (updateErr) => {
            if (updateErr) {
              console.error(
                "[DATABASE] Admin password update error:",
                updateErr.message
              );
            }
          }
        );
      }
    }
  );

  /* -------------------------------------------------------
     SAMPLE SHIPMENT
  ------------------------------------------------------- */

  db.get(
    `
    SELECT *
    FROM shipments
    WHERE tracking_number = ?
    `,
    ["ED-20260906-CCF14B32"],
    (err, row) => {
      if (err) {
        console.error(
          "[DATABASE] Sample shipment lookup error:",
          err.message
        );
        return;
      }

      if (!row) {
        db.run(
          `
          INSERT INTO shipments (
            tracking_number,
            reference,
            status,
            service_type,
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
            description
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
          `,
          [
            "ED-20260906-CCF14B32",
            "REF-992041",
            "In Transit",
            "Express Air Freight",
            "Taiwan Electronics Corp",
            "Taiwan",
            "Metro Distribution Hub",
            "United States",
            "Taipei, Taiwan",
            "New York, NY, USA",
            "Transit Hub - Los Angeles, CA",
            "2026-09-15",
            2,
            14.5,
            "USD",
            2500,
            "High-precision microcontrollers"
          ],
          function (insertErr) {
            if (insertErr) {
              console.error(
                "[DATABASE] Sample shipment creation error:",
                insertErr.message
              );
              return;
            }

            const shipmentId =
              this.lastID;

            const sampleEvents = [
              [
                "Shipment Created",
                "Taipei, Taiwan",
                "Shipment order initialized",
                "2026-09-06 08:30:00"
              ],
              [
                "Package Received",
                "Taipei Sorting Hub",
                "Cargo received at facility",
                "2026-09-06 14:15:00"
              ],
              [
                "In Transit",
                "Transit Hub - Los Angeles, CA",
                "Customs cleared and processing in transit gateway",
                "2026-09-09 11:45:00"
              ]
            ];

            const stmt = db.prepare(`
              INSERT INTO tracking_events (
                shipment_id,
                status,
                location,
                description,
                event_time
              )
              VALUES (?, ?, ?, ?, ?)
            `);

            sampleEvents.forEach(
              (event) => {
                stmt.run([
                  shipmentId,
                  event[0],
                  event[1],
                  event[2],
                  event[3]
                ]);
              }
            );

            stmt.finalize();
          }
        );
      }
    }
  );
});

/* =========================================================
   JWT AUTHENTICATION
========================================================= */

function authenticateToken(
  req,
  res,
  next
) {
  const authHeader =
    req.headers.authorization;

  const token =
    authHeader &&
    authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized token access"
    });
  }

  jwt.verify(
    token,
    JWT_SECRET,
    (err, user) => {
      if (err) {
        return res.status(403).json({
          error: "Forbidden"
        });
      }

      req.user = user;
      next();
    }
  );
}

/* =========================================================
   PUBLIC ROUTES
========================================================= */

/* ---------------------------------------------------------
   PUBLIC TRACKING
--------------------------------------------------------- */

app.get(
  "/api/tracking/:trackingNumber",
  (req, res) => {
    const trackingNumber =
      String(
        req.params.trackingNumber || ""
      ).trim();

    if (!trackingNumber) {
      return res.status(400).json({
        error: "Tracking number is required."
      });
    }

    db.get(
      `
      SELECT *
      FROM shipments
      WHERE tracking_number = ?
      `,
      [trackingNumber],
      (err, shipment) => {
        if (err) {
          console.error(
            "[TRACKING] Database error:",
            err.message
          );

          return res.status(500).json({
            error: "Database error."
          });
        }

        if (!shipment) {
          return res.status(404).json({
            error:
              "Tracking number not found in database.",
            trackingNumber
          });
        }

        db.all(
          `
          SELECT *
          FROM tracking_events
          WHERE shipment_id = ?
          ORDER BY event_time ASC
          `,
          [shipment.id],
          (eventErr, events) => {
            if (eventErr) {
              console.error(
                "[TRACKING] Event lookup error:",
                eventErr.message
              );

              return res.status(500).json({
                error:
                  "Unable to load tracking events."
              });
            }

            return res.json({
              shipment,
              events: events || []
            });
          }
        );
      }
    );
  }
);

/* ---------------------------------------------------------
   PUBLIC CONTACT FORM
--------------------------------------------------------- */

app.post(
  "/api/contact",
  (req, res) => {
    const {
      sender_name,
      email,
      subject,
      message
    } = req.body || {};

    if (
      !sender_name ||
      !email ||
      !subject ||
      !message
    ) {
      return res.status(400).json({
        error: "All fields are required."
      });
    }

    db.run(
      `
      INSERT INTO messages (
        sender_name,
        email,
        subject,
        message
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        String(sender_name).trim(),
        String(email).trim(),
        String(subject).trim(),
        String(message).trim()
      ],
      function (err) {
        if (err) {
          console.error(
            "[CONTACT] Database error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Failed to dispatch message."
          });
        }

        /*
         * Correct property name:
         * emailService.js expects senderName.
         *
         * The database record is already saved, so an
         * email failure does not destroy the customer's
         * message.
         */

        sendContactNotification({
          senderName: sender_name,
          email,
          subject,
          message
        })
          .then(() => {
            console.log(
              "[EMAIL] Contact notification sent successfully."
            );
          })
          .catch((emailError) => {
            console.error(
              "[EMAIL] Contact notification failed:",
              emailError.message ||
                emailError
            );
          });

        return res.json({
          success: true,
          message:
            "Message sent successfully to US COURIER Support.",
          id: this.lastID
        });
      }
    );
  }
);

/* =========================================================
   AUTHENTICATION
========================================================= */

/* ---------------------------------------------------------
   ADMIN LOGIN
--------------------------------------------------------- */

app.post(
  "/api/auth/login",
  (req, res) => {
    const {
      email,
      password
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error:
          "Email and password are required."
      });
    }

    db.get(
      `
      SELECT *
      FROM users
      WHERE email = ?
      `,
      [String(email).trim()],
      async (err, user) => {
        if (err) {
          console.error(
            "[AUTH] Database error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Authentication service error."
          });
        }

        if (!user) {
          return res.status(401).json({
            error:
              "Invalid operator credentials"
          });
        }

        try {
          const valid =
            await bcrypt.compare(
              password,
              user.password_hash
            );

          if (!valid) {
            return res.status(401).json({
              error:
                "Invalid operator credentials"
            });
          }

          const token =
            jwt.sign(
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

          return res.json({
            success: true,
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
        } catch (passwordError) {
          console.error(
            "[AUTH] Password verification error:",
            passwordError.message
          );

          return res.status(500).json({
            error:
              "Authentication service error."
          });
        }
      }
    );
  }
);

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

app.get(
  "/api/admin/dashboard",
  authenticateToken,
  (req, res) => {
    db.get(
      `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'In Transit'
            THEN 1
            ELSE 0
          END
        ) AS in_transit,

        SUM(
          CASE
            WHEN status = 'Delivered'
            THEN 1
            ELSE 0
          END
        ) AS delivered,

        SUM(
          CASE
            WHEN status = 'Pending'
            THEN 1
            ELSE 0
          END
        ) AS pending,

        SUM(
          CASE
            WHEN status = 'Delayed'
            THEN 1
            ELSE 0
          END
        ) AS exceptions

      FROM shipments
      `,
      (err, counts) => {
        if (err) {
          console.error(
            "[DASHBOARD] Shipment statistics error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Unable to load dashboard."
          });
        }

        db.get(
          `
          SELECT COUNT(*) AS unread_messages
          FROM messages
          WHERE status = 'Unread'
          `,
          (messageErr, msgCount) => {
            if (messageErr) {
              console.error(
                "[DASHBOARD] Message statistics error:",
                messageErr.message
              );

              return res.status(500).json({
                error:
                  "Unable to load message statistics."
              });
            }

            return res.json({
              counts: counts || {},
              unread_messages:
                msgCount
                  ? msgCount.unread_messages
                  : 0
            });
          }
        );
      }
    );
  }
);

/* =========================================================
   ADMIN SHIPMENTS
========================================================= */

/* ---------------------------------------------------------
   LIST SHIPMENTS
--------------------------------------------------------- */

app.get(
  "/api/admin/shipments",
  authenticateToken,
  (req, res) => {
    db.all(
      `
      SELECT *
      FROM shipments
      ORDER BY created_at DESC
      `,
      (err, rows) => {
        if (err) {
          console.error(
            "[SHIPMENTS] List error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Unable to load shipments."
          });
        }

        return res.json(
          rows || []
        );
      }
    );
  }
);

/* ---------------------------------------------------------
   CREATE SHIPMENT
--------------------------------------------------------- */

app.post(
  "/api/admin/shipments",
  authenticateToken,
  (req, res) => {
    const s = req.body || {};

    const trackingNumber =
      `ED-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase()}`;

    db.run(
      `
      INSERT INTO shipments (
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
        description
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
      `,
      [
        trackingNumber,
        s.reference || null,
        s.status || "Pending",
        s.service_type || null,
        s.priority || "Standard",
        s.sender_name || null,
        s.sender_country || null,
        s.recipient_name || null,
        s.recipient_country || null,
        s.origin || null,
        s.destination || null,
        s.current_location ||
          s.origin ||
          null,
        s.estimated_delivery ||
          null,
        Number(s.package_count) || 1,
        Number(s.weight) || 1,
        s.currency || "USD",
        Number(s.declared_value) || 0,
        s.description || null
      ],
      function (err) {
        if (err) {
          console.error(
            "[SHIPMENTS] Create error:",
            err.message
          );

          return res.status(500).json({
            error: err.message
          });
        }

        const shipmentId =
          this.lastID;

        db.run(
          `
          INSERT INTO tracking_events (
            shipment_id,
            status,
            location,
            description,
            created_by
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            shipmentId,
            s.status || "Pending",
            s.origin || "",
            "Waybill generated in system",
            req.user?.email ||
              "Admin"
          ],
          (eventErr) => {
            if (eventErr) {
              console.error(
                "[SHIPMENTS] Tracking event error:",
                eventErr.message
              );
            }
          }
        );

        return res.status(201).json({
          success: true,
          tracking_number:
            trackingNumber,
          shipment_id:
            shipmentId
        });
      }
    );
  }
);

/* ---------------------------------------------------------
   UPDATE SHIPMENT
--------------------------------------------------------- */

app.put(
  "/api/admin/shipments/:id",
  authenticateToken,
  (req, res) => {
    const {
      status,
      current_location,
      event_time,
      estimated_delivery,
      event_description
    } = req.body || {};

    const shipmentId =
      req.params.id;

    if (!status) {
      return res.status(400).json({
        error: "Status is required."
      });
    }

    db.run(
      `
      UPDATE shipments
      SET
        status = ?,
        current_location = ?,
        estimated_delivery =
          COALESCE(?, estimated_delivery),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        status,
        current_location || null,
        estimated_delivery || null,
        shipmentId
      ],
      function (err) {
        if (err) {
          console.error(
            "[SHIPMENTS] Update error:",
            err.message
          );

          return res.status(500).json({
            error: err.message
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            error:
              "Shipment not found."
          });
        }

        let eventTime;

        if (event_time) {
          eventTime =
            String(event_time)
              .replace("T", " ");

          if (
            eventTime.length === 16
          ) {
            eventTime += ":00";
          }
        } else {
          eventTime =
            new Date()
              .toISOString()
              .slice(0, 19)
              .replace("T", " ");
        }

        db.run(
          `
          INSERT INTO tracking_events (
            shipment_id,
            status,
            location,
            description,
            event_time,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            shipmentId,
            status,
            current_location || "",
            event_description ||
              `Updated to ${status}`,
            eventTime,
            req.user?.email ||
              "Admin"
          ],
          (eventErr) => {
            if (eventErr) {
              console.error(
                "[SHIPMENTS] Tracking event creation error:",
                eventErr.message
              );
            }
          }
        );

        return res.json({
          success: true,
          message:
            "Shipment updated successfully."
        });
      }
    );
  }
);

/* =========================================================
   ADMIN MESSAGES
========================================================= */

/* ---------------------------------------------------------
   GET MESSAGES
--------------------------------------------------------- */

app.get(
  "/api/admin/messages",
  authenticateToken,
  (req, res) => {
    db.all(
      `
      SELECT *
      FROM messages
      ORDER BY created_at DESC
      `,
      (err, rows) => {
        if (err) {
          console.error(
            "[MESSAGES] Database error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Unable to load messages."
          });
        }

        return res.json(
          rows || []
        );
      }
    );
  }
);

/* ---------------------------------------------------------
   MARK MESSAGE AS READ
--------------------------------------------------------- */

app.put(
  "/api/admin/messages/:id/read",
  authenticateToken,
  (req, res) => {
    db.run(
      `
      UPDATE messages
      SET status = 'Read'
      WHERE id = ?
      `,
      [req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            error:
              "Message not found."
          });
        }

        return res.json({
          success: true
        });
      }
    );
  }
);

/* ---------------------------------------------------------
   REPLY TO CUSTOMER
--------------------------------------------------------- */

app.post(
  "/api/admin/messages/:id/reply",
  authenticateToken,
  (req, res) => {
    console.log("[REPLY] POST /api/admin/messages/:id/reply invoked", { id: req.params.id, pid: process.pid });
    const message =
      typeof req.body?.message ===
      "string"
        ? req.body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        error:
          "Reply message is required."
      });
    }

    db.get(
      `
      SELECT *
      FROM messages
      WHERE id = ?
      `,
      [req.params.id],
      (err, customerMessage) => {
        if (err) {
          console.error(
            "[REPLY] Database lookup error:",
            err.message
          );

          return res.status(500).json({
            error:
              "Database error."
          });
        }

        if (!customerMessage) {
          return res.status(404).json({
            error:
              "Customer message not found."
          });
        }

        if (
          !customerMessage.email
        ) {
          return res.status(400).json({
            error:
              "Customer email address is missing."
          });
        }

        sendContactReply({
          recipientEmail:
            customerMessage.email,

          recipientName:
            customerMessage.sender_name,

          subject:
            `Re: ${
              customerMessage.subject ||
              "US COURIER Support"
            }`,

          message
        })
          .then(() => {
            db.run(
              `
              UPDATE messages
              SET status = 'Read'
              WHERE id = ?
              `,
              [req.params.id],
              (updateErr) => {
                if (updateErr) {
                  console.error(
                    "[DATABASE] Failed to mark message as read:",
                    updateErr.message
                  );
                }
              }
            );

            return res.json({
              success: true,
              message:
                "Reply sent successfully."
            });
          })
          .catch((emailError) => {
            console.error(
              "[EMAIL] Customer reply failed:",
              emailError.message ||
                emailError
            );

            return res.status(500).json({
              error:
                "Unable to send reply."
            });
          });
      }
    );
  }
);

/* ---------------------------------------------------------
   DELETE MESSAGE
--------------------------------------------------------- */

app.delete(
  "/api/admin/messages/:id",
  authenticateToken,
  (req, res) => {
    db.run(
      `
      DELETE FROM messages
      WHERE id = ?
      `,
      [req.params.id],
      function (err) {
        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            error:
              "Message not found."
          });
        }

        return res.json({
          success: true
        });
      }
    );
  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    return res.json({
      success: true,
      status: "online",
      service:
        "US COURIER API",
      environment:
        process.env.NODE_ENV ||
        "development",
      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.get(
  "*",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "[SERVER ERROR]",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    return res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

const server =
  app.listen(
    PORT,
    () => {
      console.log(
        `US Courier Platform running on Port ${PORT}`
      );
    }
  );

server.on(
  "error",
  (err) => {
    console.error(
      "[SERVER] Failed to start:",
      err.message
    );
  }
);

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(
  signal
) {
  console.log(
    `[SERVER] ${signal} received. Shutting down...`
  );

  server.close(() => {
    db.close((err) => {
      if (err) {
        console.error(
          "[DATABASE] Shutdown error:",
          err.message
        );
      }

      console.log(
        "[SERVER] Shutdown complete."
      );

      process.exit(
        err ? 1 : 0
      );
    });
  });
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);