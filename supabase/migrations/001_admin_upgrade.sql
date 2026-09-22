-- US COURIER / DISPATCH ADMIN UPGRADE
-- PostgreSQL / Supabase only

create extension if not exists pgcrypto;

-- ============================================================
-- SHIPMENT TRACKING EVENTS
-- ============================================================

create table if not exists shipment_tracking_events (
    id uuid primary key default gen_random_uuid(),

    shipment_id uuid not null,
    tracking_number text not null,

    status text not null,
    location text,
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    description text,

    event_time timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_tracking_events_shipment
    on shipment_tracking_events(shipment_id);

create index if not exists idx_tracking_events_tracking_number
    on shipment_tracking_events(tracking_number);

create index if not exists idx_tracking_events_event_time
    on shipment_tracking_events(event_time desc);


-- ============================================================
-- STAFF
-- ============================================================

create table if not exists staff (
    id uuid primary key default gen_random_uuid(),

    staff_id text not null unique,
    employee_number text unique,

    full_name text not null,
    email text not null unique,
    phone text,

    department text,
    role text not null default 'Staff',

    status text not null default 'active'
        check (status in ('active', 'disabled', 'suspended')),

    password_hash text,

    photo_url text,

    last_login_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_staff_email
    on staff(email);

create index if not exists idx_staff_role
    on staff(role);

create index if not exists idx_staff_status
    on staff(status);


-- ============================================================
-- STAFF SESSIONS
-- ============================================================

create table if not exists staff_sessions (
    id uuid primary key default gen_random_uuid(),

    staff_id uuid not null
        references staff(id)
        on delete cascade,

    session_token_hash text not null unique,

    ip_address inet,
    user_agent text,

    status text not null default 'active'
        check (status in ('active', 'terminated', 'expired')),

    login_at timestamptz not null default now(),
    last_activity_at timestamptz not null default now(),
    logout_at timestamptz
);

create index if not exists idx_staff_sessions_staff
    on staff_sessions(staff_id);

create index if not exists idx_staff_sessions_status
    on staff_sessions(status);


-- ============================================================
-- ADMIN ACTIVITY
-- ============================================================

create table if not exists admin_activity (
    id uuid primary key default gen_random_uuid(),

    staff_id uuid
        references staff(id)
        on delete set null,

    action text not null,
    entity_type text,
    entity_id text,

    description text,

    ip_address inet,
    user_agent text,

    created_at timestamptz not null default now()
);

create index if not exists idx_admin_activity_staff
    on admin_activity(staff_id);

create index if not exists idx_admin_activity_created
    on admin_activity(created_at desc);


-- ============================================================
-- SETTINGS
-- ============================================================

create table if not exists settings (
    key text primary key,
    value jsonb not null default '{}'::jsonb,

    updated_by uuid
        references staff(id)
        on delete set null,

    updated_at timestamptz not null default now()
);


-- ============================================================
-- UPDATED_AT HELPER
-- ============================================================

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists staff_updated_at on staff;

create trigger staff_updated_at
before update on staff
for each row
execute function update_updated_at();