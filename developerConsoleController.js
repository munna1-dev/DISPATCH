const express = require("express");

function createDeveloperConsoleRouter({
  queryWithRetry,
  logAdminAction,
  requireAdminPermission,
  requireSameOrigin
}) {
  const router = express.Router();

  if (
    typeof queryWithRetry !== "function" ||
    typeof logAdminAction !== "function" ||
    typeof requireAdminPermission !== "function" ||
    typeof requireSameOrigin !== "function"
  ) {
    throw new Error(
      "Developer Console dependencies are not correctly configured."
    );
  }

  function getIpAddress(req) {
    const forwarded = String(
      req.headers["x-forwarded-for"] || ""
    );

    return (
      forwarded.split(",")[0].trim() ||
      String(req.socket?.remoteAddress || "").trim() ||
      null
    ).slice(0, 100);
  }

  function auditDetails(value) {
    if (value === undefined || value === null) {
      return null;
    }

    try {
      return JSON.stringify(value).slice(0, 2000);
    } catch {
      return String(value).slice(0, 2000);
    }
  }

  async function audit(req, action, targetType = null, targetId = null, details = null) {
    await logAdminAction({
      adminId: req.admin?.id || req.user?.id || null,
      adminEmail: req.admin?.email || null,
      action,
      targetType,
      targetId,
      details: auditDetails(details),
      ipAddress: getIpAddress(req)
    });
  }

  function requireDeveloper(permission) {
    return requireAdminPermission(permission);
  }

  /*
   * SYSTEM HEALTH
   *
   * Real application/process/database information only.
   * External integrations are reported as configured/not configured
   * unless a safe live provider check exists.
   */
  router.get(
    "/health",
    requireDeveloper("developer.health"),
    async (req, res) => {
      const started = process.hrtime.bigint();

      let database = {
        status: "Unknown",
        provider: "PostgreSQL",
        latencyMs: null
      };

      try {
        await queryWithRetry("SELECT 1 AS ok");

        const elapsed =
          Number(process.hrtime.bigint() - started) / 1e6;

        database = {
          status: "Connected",
          provider: "PostgreSQL",
          latencyMs: Math.round(elapsed * 100) / 100
        };
      } catch (error) {
        database = {
          status: "Unavailable",
          provider: "PostgreSQL",
          latencyMs: null,
          error: "Database health check failed"
        };
      }

      const environment =
        process.env.VERCEL_ENV ||
        process.env.NODE_ENV ||
        "unknown";

      return res.json({
        success: true,

        application: {
          status: "Operational",
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version
        },

        database,

        authentication: {
          status: "Operational",
          provider: "USCourier JWT + PostgreSQL staff sessions"
        },

        mail: {
          provider: "Resend",
          status: process.env.RESEND_API_KEY
            ? "Configured"
            : "Not configured"
        },

        dns: {
          provider: "Cloudflare",
          status:
            process.env.CLOUDFLARE_API_TOKEN ||
            process.env.CLOUDFLARE_TOKEN
              ? "Configured"
              : "Not configured"
        },

        deployment: {
          platform: process.env.VERCEL
            ? "Vercel"
            : "Unknown",
          environment,
          commit:
            process.env.VERCEL_GIT_COMMIT_SHA || null,
          deploymentId:
            process.env.VERCEL_DEPLOYMENT_ID || null,
          url:
            process.env.VERCEL_URL || null
        }
      });
    }
  );

  /*
   * DATABASE OVERVIEW
   *
   * No arbitrary SQL execution.
   * Only predefined, server-controlled queries are used.
   */
  router.get(
    "/database",
    requireDeveloper("developer.database"),
    async (req, res) => {
      const tables = [
        "users",
        "shipments",
        "staff_sessions",
        "admin_audit_logs",
        "site_settings",
        "contact_messages",
        "mailboxes",
        "mail_messages",
        "mail_recipients",
        "mail_attachments",
        "mail_webhook_events"
      ];

      const results = [];

      for (const table of tables) {
        try {
          const result = await queryWithRetry(
            `
            SELECT COUNT(*)::bigint AS count
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
            `,
            [table]
          );

          const exists =
            Number(result.rows[0]?.count || 0) > 0;

          if (!exists) {
            results.push({
              name: table,
              exists: false,
              records: null
            });
            continue;
          }

          const countResult = await queryWithRetry(
            `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
            []
          );

          results.push({
            name: table,
            exists: true,
            records: Number(
              countResult.rows[0]?.count || 0
            )
          });
        } catch {
          results.push({
            name: table,
            exists: null,
            records: null,
            status: "Unavailable"
          });
        }
      }

      return res.json({
        success: true,
        database: "PostgreSQL",
        tables: results
      });
    }
  );

  /*
   * DATABASE SCHEMA INFORMATION
   *
   * Read-only metadata only.
   */
  router.get(
    "/database/schema",
    requireDeveloper("developer.database"),
    async (req, res) => {
      try {
        const result = await queryWithRetry(
          `
          SELECT
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
          `,
          []
        );

        return res.json({
          success: true,
          columns: result.rows
        });
      } catch (error) {
        console.error(
          "[DEVELOPER DATABASE SCHEMA]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error: "Unable to retrieve database schema."
        });
      }
    }
  );

  /*
   * AUDIT LOGS
   */
  router.get(
    "/audit",
    requireDeveloper("developer.audit"),
    async (req, res) => {
      const requestedLimit =
        Number.parseInt(req.query.limit, 10);

      const limit = Math.min(
        Math.max(
          Number.isFinite(requestedLimit)
            ? requestedLimit
            : 50,
          1
        ),
        200
      );

      try {
        const result = await queryWithRetry(
          `
          SELECT
            id,
            admin_id,
            admin_email,
            action,
            target_type,
            target_id,
            details,
            ip_address,
            created_at
          FROM admin_audit_logs
          ORDER BY created_at DESC
          LIMIT $1
          `,
          [limit]
        );

        return res.json({
          success: true,
          logs: result.rows
        });
      } catch (error) {
        console.error(
          "[DEVELOPER AUDIT]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error: "Unable to retrieve audit logs."
        });
      }
    }
  );

  /*
   * ACTIVE STAFF SESSIONS
   */
  router.get(
    "/sessions",
    requireDeveloper("developer.sessions"),
    async (req, res) => {
      try {
        const result = await queryWithRetry(
          `
          SELECT
            s.id,
            s.user_id,
            u.email,
            u.role,
            u.status AS user_status,
            s.login_at,
            s.last_activity_at,
            s.ip_address,
            s.user_agent,
            s.status,
            s.logout_at,
            s.terminated_at
          FROM staff_sessions s
          INNER JOIN users u
            ON u.id = s.user_id
          ORDER BY
            CASE
              WHEN s.status = 'Active' THEN 0
              ELSE 1
            END,
            s.last_activity_at DESC
          LIMIT 200
          `,
          []
        );

        return res.json({
          success: true,
          sessions: result.rows
        });
      } catch (error) {
        console.error(
          "[DEVELOPER SESSIONS]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error: "Unable to retrieve staff sessions."
        });
      }
    }
  );

  /*
   * TERMINATE AN EXISTING SESSION
   */
  router.post(
    "/sessions/:sessionId/terminate",
    requireDeveloper("developer.sessions"),
    requireSameOrigin,
    async (req, res) => {
      const sessionId =
        String(req.params.sessionId || "").trim();

      if (
        !/^[0-9a-fA-F-]{36}$/.test(sessionId)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid session identifier."
        });
      }

      try {
        const currentSessionId =
          String(req.staffSession?.id || "");

        if (
          currentSessionId &&
          currentSessionId === sessionId
        ) {
          return res.status(400).json({
            success: false,
            error:
              "The current administrator session cannot be terminated from this screen."
          });
        }

        const result = await queryWithRetry(
          `
          UPDATE staff_sessions
          SET
            status = 'Terminated',
            terminated_at = NOW(),
            terminated_by = $2,
            logout_at = COALESCE(logout_at, NOW()),
            last_activity_at = NOW()
          WHERE id = $1::uuid
            AND status = 'Active'
          RETURNING
            id,
            user_id,
            status,
            terminated_at
          `,
          [
            sessionId,
            req.admin?.id || req.user?.id
          ]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error:
              "Active session not found."
          });
        }

        await audit(
          req,
          "developer.session.terminate",
          "staff_session",
          sessionId,
          {
            affectedUserId:
              result.rows[0].user_id
          }
        );

        return res.json({
          success: true,
          session: result.rows[0]
        });
      } catch (error) {
        console.error(
          "[DEVELOPER SESSION TERMINATE]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error: "Unable to terminate session."
        });
      }
    }
  );

  /*
   * ENVIRONMENT STATUS
   *
   * Values are NEVER returned.
   */
  router.get(
    "/environment",
    requireDeveloper("developer.environment"),
    async (req, res) => {
      const environmentKeys = [
        "DATABASE_URL",
        "JWT_SECRET",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "RESEND_ADMIN_EMAIL",
        "RESEND_REPLY_TO",
        "PUBLIC_APP_URL",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_TOKEN",
        "VERCEL_TOKEN",
        "VERCEL_PROJECT_ID"
      ];

      const environment = {};

      for (const key of environmentKeys) {
        environment[key] =
          process.env[key]
            ? "Configured"
            : "Not configured";
      }

      return res.json({
        success: true,
        environment
      });
    }
  );

  /*
   * DEPLOYMENT METADATA
   *
   * This does not execute deployments or shell commands.
   */
  router.get(
    "/deployments",
    requireDeveloper("developer.deployments"),
    async (req, res) => {
      return res.json({
        success: true,
        deployment: {
          platform:
            process.env.VERCEL
              ? "Vercel"
              : "Unknown",

          environment:
            process.env.VERCEL_ENV ||
            process.env.NODE_ENV ||
            "unknown",

          deploymentId:
            process.env.VERCEL_DEPLOYMENT_ID ||
            null,

          commit:
            process.env.VERCEL_GIT_COMMIT_SHA ||
            null,

          commitMessage:
            process.env.VERCEL_GIT_COMMIT_MESSAGE ||
            null,

          url:
            process.env.VERCEL_URL ||
            null
        }
      });
    }
  );

  /*
   * MAINTENANCE MODE
   *
   * Stored in existing site_settings as JSONB.
   */
  router.get(
    "/maintenance",
    requireDeveloper("developer.settings"),
    async (req, res) => {
      try {
        const result = await queryWithRetry(
          `
          SELECT
            setting_value,
            updated_at,
            updated_by
          FROM site_settings
          WHERE setting_key = 'maintenance_mode'
          LIMIT 1
          `,
          []
        );

        const value =
          result.rows[0]?.setting_value;

        let enabled = false;

        if (
          value &&
          typeof value === "object"
        ) {
          enabled = Boolean(value.enabled);
        } else if (typeof value === "boolean") {
          enabled = value;
        } else if (
          typeof value === "string"
        ) {
          enabled =
            value.toLowerCase() === "true";
        }

        return res.json({
          success: true,
          enabled,
          updatedAt:
            result.rows[0]?.updated_at || null,
          updatedBy:
            result.rows[0]?.updated_by || null
        });
      } catch (error) {
        console.error(
          "[DEVELOPER MAINTENANCE GET]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to retrieve maintenance status."
        });
      }
    }
  );

  router.post(
    "/maintenance",
    requireDeveloper("developer.settings"),
    requireSameOrigin,
    async (req, res) => {
      const enabled =
        req.body?.enabled === true;

      const confirmation =
        String(
          req.body?.confirmation || ""
        ).trim();

      const expected =
        enabled
          ? "ENABLE_MAINTENANCE"
          : "DISABLE_MAINTENANCE";

      if (confirmation !== expected) {
        return res.status(400).json({
          success: false,
          error:
            `Confirmation must be ${expected}.`
        });
      }

      const settingValue = {
        enabled,
        message:
          enabled
            ? "US Courier is temporarily unavailable while maintenance is being performed."
            : null,
        updatedAt:
          new Date().toISOString()
      };

      try {
        await queryWithRetry(
          `
          INSERT INTO site_settings (
            setting_key,
            setting_value,
            is_public,
            updated_by,
            updated_at
          )
          VALUES (
            'maintenance_mode',
            $1::jsonb,
            TRUE,
            $2,
            NOW()
          )
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            is_public = EXCLUDED.is_public,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
          `,
          [
            JSON.stringify(settingValue),
            req.admin?.id || req.user?.id
          ]
        );

        await audit(
          req,
          enabled
            ? "developer.maintenance.enable"
            : "developer.maintenance.disable",
          "site_setting",
          "maintenance_mode",
          { enabled }
        );

        return res.json({
          success: true,
          enabled
        });
      } catch (error) {
        console.error(
          "[DEVELOPER MAINTENANCE SAVE]",
          error.message
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to update maintenance mode."
        });
      }
    }
  );

  /*
   * Record that the Developer Console itself was accessed.
   */
  router.get(
    "/access-check",
    requireDeveloper("developer.view"),
    async (req, res) => {
      return res.json({
        success: true,
        authenticated: true,
        admin: {
          id: req.admin?.id || null,
          email: req.admin?.email || null,
          role: req.admin?.role || null
        }
      });
    }
  );

  return router;
}

module.exports = createDeveloperConsoleRouter;
