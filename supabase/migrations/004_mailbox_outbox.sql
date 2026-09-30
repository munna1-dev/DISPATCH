-- US COURIER MAILBOX
-- Outbox delivery state and persistent send queue

BEGIN;

ALTER TABLE mail_messages
    DROP CONSTRAINT IF EXISTS mail_messages_folder_check;

ALTER TABLE mail_messages
    ADD CONSTRAINT mail_messages_folder_check
    CHECK (
        folder IN (
            'inbox',
            'sent',
            'drafts',
            'outbox',
            'trash',
            'archive'
        )
    );

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS delivery_status text
        CHECK (
            delivery_status IS NULL
            OR delivery_status IN (
                'queued',
                'sending',
                'sent',
                'failed'
            )
        );

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS delivery_attempts integer
        NOT NULL DEFAULT 0;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS last_delivery_error text;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS queued_at timestamptz;

ALTER TABLE mail_messages
    ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS mail_messages_outbox_idx
    ON mail_messages(mailbox_id, folder, delivery_status, queued_at DESC);

CREATE INDEX IF NOT EXISTS mail_messages_delivery_status_idx
    ON mail_messages(mailbox_id, delivery_status);

COMMIT;
