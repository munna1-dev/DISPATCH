-- US COURIER MAILBOX
-- Durable outbound delivery lifecycle / Outbox support
--
-- IMPORTANT:
-- mail_messages.folder remains the user-facing mailbox location.
-- Outbox is represented by send_status.
--
-- Lifecycle:
--   queued -> sending -> sent
--                    \-> failed
--
-- Draft messages keep send_status = NULL.
-- Inbox messages keep send_status = NULL.

BEGIN;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS send_status text;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS queued_at timestamptz;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS sending_at timestamptz;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE mail_messages
    ADD CONSTRAINT mail_messages_send_status_check
    CHECK (
        send_status IS NULL
        OR send_status IN (
            'queued',
            'sending',
            'sent',
            'failed'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS
    mail_messages_idempotency_key_idx
ON mail_messages(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    mail_messages_outbox_idx
ON mail_messages(mailbox_id, send_status, next_attempt_at);

CREATE INDEX IF NOT EXISTS
    mail_messages_send_status_idx
ON mail_messages(mailbox_id, send_status);

COMMIT;
