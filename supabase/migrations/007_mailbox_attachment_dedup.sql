-- US COURIER MAILBOX
-- Prevent duplicate Resend attachment records during webhook retries.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS mail_attachments_resend_unique_idx
    ON mail_attachments (message_id, resend_attachment_id)
    WHERE resend_attachment_id IS NOT NULL;

COMMIT;
