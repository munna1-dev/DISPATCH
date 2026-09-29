-- US COURIER MAILBOX
-- Durable private attachment storage metadata
--
-- Binary attachment data is stored in private Vercel Blob storage.
-- PostgreSQL stores only the metadata/reference needed to retrieve it.
--
-- Existing mail_attachments rows remain valid.
-- storage_provider/path are nullable so this migration is non-destructive.

BEGIN;

ALTER TABLE mail_attachments
    ADD COLUMN IF NOT EXISTS storage_provider text;

ALTER TABLE mail_attachments
    ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE mail_attachments
    ADD COLUMN IF NOT EXISTS storage_size_bytes bigint;

ALTER TABLE mail_attachments
    ADD COLUMN IF NOT EXISTS storage_uploaded_at timestamptz;

DO $BLOCK$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mail_attachments_storage_provider_check'
          AND conrelid = 'mail_attachments'::regclass
    ) THEN
        ALTER TABLE mail_attachments
            ADD CONSTRAINT mail_attachments_storage_provider_check
            CHECK (
                storage_provider IS NULL
                OR storage_provider IN ('vercel_blob')
            );
    END IF;
END
$BLOCK$;

DO $BLOCK$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mail_attachments_storage_size_check'
          AND conrelid = 'mail_attachments'::regclass
    ) THEN
        ALTER TABLE mail_attachments
            ADD CONSTRAINT mail_attachments_storage_size_check
            CHECK (
                storage_size_bytes IS NULL
                OR storage_size_bytes >= 0
            );
    END IF;
END
$BLOCK$;

CREATE INDEX IF NOT EXISTS idx_mail_attachments_storage_path
    ON mail_attachments (storage_path)
    WHERE storage_path IS NOT NULL;

COMMIT;
