-- ============================================================
-- US COURIER / DISPATCH
-- Migration 002: Staff profile + session infrastructure
--
-- IMPORTANT:
-- This migration extends the existing users table.
-- It does NOT create a duplicate staff identity system.
-- It does NOT replace shipments, shipment_events,
-- contact_messages, site_settings, or admin_audit_logs.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extend the existing users/staff identity
-- ------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Keep existing accounts active after the migration.
UPDATE users
SET status = 'Active'
WHERE status IS NULL OR btrim(status) = '';

-- Prevent invalid staff account states.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('Active', 'Disabled'));

-- Employee number is optional, but when supplied it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS users_employee_number_unique_idx
  ON users (employee_number)
  WHERE employee_number IS NOT NULL
    AND btrim(employee_number) <> '';

-- Email is a staff login identifier.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email));

CREATE INDEX IF NOT EXISTS users_role_idx
  ON users (role);

CREATE INDEX IF NOT EXISTS users_status_idx
  ON users (status);

CREATE INDEX IF NOT EXISTS users_last_login_idx
  ON users (last_login_at DESC NULLS LAST);


-- ------------------------------------------------------------
-- 2. Staff sessions
--
-- JWT remains the authentication mechanism, while this table
-- provides server-side session visibility and termination.
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id bigint NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,

  last_activity_at timestamptz NOT NULL DEFAULT now(),

  ip_address text,
  user_agent text,

  status text NOT NULL DEFAULT 'Active',

  terminated_at timestamptz,
  terminated_by bigint
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_sessions_status_check
    CHECK (status IN ('Active', 'Logged Out', 'Terminated'))
);

CREATE INDEX IF NOT EXISTS staff_sessions_user_idx
  ON staff_sessions (user_id);

CREATE INDEX IF NOT EXISTS staff_sessions_status_idx
  ON staff_sessions (status);

CREATE INDEX IF NOT EXISTS staff_sessions_last_activity_idx
  ON staff_sessions (last_activity_at DESC);

CREATE INDEX IF NOT EXISTS staff_sessions_login_idx
  ON staff_sessions (login_at DESC);

CREATE INDEX IF NOT EXISTS staff_sessions_active_user_idx
  ON staff_sessions (user_id, status)
  WHERE status = 'Active';


-- ------------------------------------------------------------
-- 3. Existing audit log performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx
  ON admin_audit_logs (admin_id);

CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx
  ON admin_audit_logs (action);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx
  ON admin_audit_logs (target_type, target_id);


-- ------------------------------------------------------------
-- 4. Existing shipment/tracking performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS shipment_events_shipment_event_time_idx
  ON shipment_events (shipment_id, event_time ASC, id ASC);

CREATE INDEX IF NOT EXISTS shipment_events_gps_idx
  ON shipment_events (shipment_id, event_time ASC)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL;


-- ------------------------------------------------------------
-- 5. Existing message performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON contact_messages (status);

CREATE INDEX IF NOT EXISTS contact_messages_unread_idx
  ON contact_messages (created_at DESC)
  WHERE status = 'Unread';


-- ------------------------------------------------------------
-- 6. Existing settings performance
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS site_settings_key_unique_idx
  ON site_settings (setting_key);

CREATE INDEX IF NOT EXISTS site_settings_public_idx
  ON site_settings (is_public, setting_key);


COMMIT;
