BEGIN;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS created_by bigint
    REFERENCES users(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shipments_created_by_idx
  ON shipments(created_by);

CREATE TABLE IF NOT EXISTS staff_access_policies (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_approved boolean NOT NULL DEFAULT false,
  parcel_scope text NOT NULL DEFAULT 'own' CHECK (parcel_scope IN ('own','all','none')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  dashboard_access jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by bigint REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_access_policies_approved_idx
  ON staff_access_policies(access_approved);

CREATE INDEX IF NOT EXISTS staff_access_policies_scope_idx
  ON staff_access_policies(parcel_scope);

CREATE OR REPLACE FUNCTION update_staff_access_policy_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS staff_access_policy_updated_at ON staff_access_policies;

CREATE TRIGGER staff_access_policy_updated_at
BEFORE UPDATE ON staff_access_policies
FOR EACH ROW
EXECUTE FUNCTION update_staff_access_policy_updated_at();

COMMIT;
