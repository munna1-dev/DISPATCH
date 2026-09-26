-- US COURIER MAILBOX
-- Resend inbound/outbound email storage

CREATE EXTENSION IF NOT EXISTS pgcrypto;
BEGIN;

CREATE TABLE IF NOT EXISTS mailboxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    email text NOT NULL UNIQUE,
    display_name text NOT NULL DEFAULT 'USCourier',

    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    mailbox_id uuid NOT NULL
        REFERENCES mailboxes(id)
        ON DELETE CASCADE,

    resend_email_id text,

    message_id text,

    in_reply_to text,

    thread_id text,

    sender_name text,
    sender_email text NOT NULL,

    subject text NOT NULL DEFAULT '',

    text_body text,
    html_body text,

    folder text NOT NULL DEFAULT 'inbox'
        CHECK (folder IN (
            'inbox',
            'sent',
            'drafts',
            'trash',
            'archive'
        )),

    is_read boolean NOT NULL DEFAULT false,
    is_starred boolean NOT NULL DEFAULT false,

    received_at timestamptz,
    sent_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(mailbox_id, resend_email_id)
);

CREATE INDEX IF NOT EXISTS mail_messages_mailbox_idx
    ON mail_messages(mailbox_id);

CREATE INDEX IF NOT EXISTS mail_messages_folder_idx
    ON mail_messages(mailbox_id, folder);

CREATE INDEX IF NOT EXISTS mail_messages_received_idx
    ON mail_messages(received_at DESC);

CREATE INDEX IF NOT EXISTS mail_messages_thread_idx
    ON mail_messages(thread_id);

CREATE INDEX IF NOT EXISTS mail_messages_unread_idx
    ON mail_messages(mailbox_id, folder)
    WHERE is_read = false;


CREATE TABLE IF NOT EXISTS mail_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    message_id uuid NOT NULL
        REFERENCES mail_messages(id)
        ON DELETE CASCADE,

    recipient_type text NOT NULL
        CHECK (recipient_type IN ('to', 'cc', 'bcc')),

    email text NOT NULL,

    display_name text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_recipients_message_idx
    ON mail_recipients(message_id);

CREATE INDEX IF NOT EXISTS mail_recipients_email_idx
    ON mail_recipients(lower(email));


CREATE TABLE IF NOT EXISTS mail_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    message_id uuid NOT NULL
        REFERENCES mail_messages(id)
        ON DELETE CASCADE,

    resend_attachment_id text,

    filename text NOT NULL,
    content_type text,
    content_disposition text,
    content_id text,

    size_bytes bigint,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_attachments_message_idx
    ON mail_attachments(message_id);


CREATE TABLE IF NOT EXISTS mail_webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id text UNIQUE,

    event_type text NOT NULL,

    resend_email_id text,

    payload jsonb NOT NULL,

    processed boolean NOT NULL DEFAULT false,

    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS mail_webhook_events_email_idx
    ON mail_webhook_events(resend_email_id);

CREATE INDEX IF NOT EXISTS mail_webhook_events_received_idx
    ON mail_webhook_events(received_at DESC);


CREATE OR REPLACE FUNCTION update_mail_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mailboxes_updated_at
    ON mailboxes;

CREATE TRIGGER mailboxes_updated_at
BEFORE UPDATE ON mailboxes
FOR EACH ROW
EXECUTE FUNCTION update_mail_updated_at();


DROP TRIGGER IF EXISTS mail_messages_updated_at
    ON mail_messages;

CREATE TRIGGER mail_messages_updated_at
BEFORE UPDATE ON mail_messages
FOR EACH ROW
EXECUTE FUNCTION update_mail_updated_at();


COMMIT;
