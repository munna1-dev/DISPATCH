# US COURIER / DISPATCH
# Public Portal + Admin Portal Integration Audit

## Audit Date
2026-09-21

## Current Git Baseline
- Commit: f26729b
- Commit: Restore public QR scanner modal
- Branch: main
- Remote: origin/main

## Architecture
Acode → GitHub → Vercel → uscourier.app → Supabase PostgreSQL

## Database Constraint
Supabase PostgreSQL only.

Do not introduce:
- SQLite
- sqlite3
- database.js
- local database files
- JSON database storage
- mock production records
- in-memory production database replacements

## Current Application Structure

### Public Portal
- Home
- Track Parcel
- Services
- Contact Us
- Public tracking API
- Public QR scanner
- Generated tracking QR
- Contact form

### Admin Portal
- Command Center
- Shipments
- Live Tracking
- Messages
- Staff Management
- Settings

## Confirmed Public Entry Points

### Navigation
- Home → showSection('home')
- Track Parcel → showSection('tracking')
- Services → showSection('services')
- Contact Us → showSection('contact')

### Public Tracking
- Home tracking form
- Dedicated Track Parcel form
- Shared handleTrackSubmit() flow
- GET /api/tracking/:trackingNumber

### QR
- openQrScannerModal()
- closeQrScannerModal()
- html5-qrcode library
- Public QR scanner modal restored in commit f26729b
- Generated tracking QR supported

### Contact
- handleContactSubmit()
- POST /api/contact

## Confirmed Admin API Areas

- /api/admin/dashboard
- /api/admin/shipments
- /api/admin/shipments/:id
- /api/admin/shipments/:id/events
- /api/admin/shipment-events/:id
- /api/admin/messages
- /api/admin/messages/:id
- /api/admin/messages/:id/reply
- /api/admin/messages/:id/read
- /api/admin/users
- /api/admin/users/:id
- /api/admin/users/:id/role
- /api/admin/users/:id/reset-password
- /api/admin/profile
- /api/admin/profile/password
- /api/admin/settings

## Confirmed Integration Direction

Admin shipment data
    ↓
PostgreSQL
    ↓
Public tracking API
    ↓
Home tracking / Track Parcel
    ↓
Permitted public shipment data

Public contact
    ↓
Existing contact API
    ↓
PostgreSQL
    ↓
Admin Messages

## Known Requirements Still To Verify

1. Single authoritative shipment data flow.
2. Admin-created shipment retrieval through public tracking.
3. Tracking event persistence and public reflection.
4. Public tracking privacy fields.
5. QR scan → tracking number → real tracking request.
6. Generated QR → correct public tracking workflow.
7. Contact → PostgreSQL → Admin Messages.
8. Services actions and links.
9. Every public button/link/form handler.
10. Every admin button/action/API path.
11. Admin workspace isolation.
12. Duplicate KPI/dashboard/table/modal systems.
13. Duplicate event listeners.
14. Authentication and RBAC initialization.
15. Server-side authorization.
16. Loading, empty, success and error states.
17. Responsive/mobile behavior.
18. Accessibility.
19. API response consistency.
20. End-to-end production-equivalent local workflow.

## Testing Policy

After each logical repair:

node --check public/js/app.js
node --check public/js/admin.js
node --check server.js

Then:

npm start

No production push until local verification passes.

## Git Policy

Before changes:
- git status --short
- git log -1 --oneline

Before risky changes:
- create targeted backup

Before commit:
- git diff --check

Never commit:
- .env
- credentials
- passwords
- API secrets
- temporary debug files

## Current Status

Audit foundation created.

No major application code changes should be made until the remaining integration checks are completed.
