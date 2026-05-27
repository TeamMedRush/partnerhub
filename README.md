# MedRush Partner Hub

Pharmacy and medical-shop inventory frontend for the MedRush platform. This app keeps the existing portable Preact architecture and targets the current partner and catalog APIs from the backend.

## Setup

```bash
cd portable
npm install
npm run dev
```

Build for production:

```bash
cd portable
npm run build
```

## Environment Variables

- `API_BASE_URL`: Backend base URL. Default: `http://localhost:8000`
- `API_TIMEOUT_MS`: Request timeout in milliseconds. Default: `10000`
- `API_AUTH_HEADER`: Auth header key expected by the backend. Default: `token`
- `ENABLE_MOCK_DATA`: Set to `true` or `1` to allow small catalog fallbacks if the backend is unavailable

## Available Routes

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/inventory`
- `/inventory/new`
- `/inventory/:id`
- `/orders`
- `/profile`

## Features Implemented

- Partner login, registration, logout, and local session persistence
- Partner dashboard with stock metrics and low-stock visibility
- Inventory sync backed by `GET /api/v1/partner/inventory`
- Inventory create and edit flow backed by `PUT /api/v1/partner/inventory`
- Mark unavailable flow implemented through inventory replacement with stock set to zero
- Local search and filter for inventory because backend query-string parsing is unavailable
- Local metadata layer for brand, category, expiry, prescription flags, and imagery where backend inventory shape is minimal
- Partner profile update flow backed by `PATCH /api/v1/partner/account`
- Orders page with clear missing-backend-state messaging

## Known Limitations

- No partner order queue or fulfillment endpoints exist yet, so `/orders` is informational only
- No profile-read endpoint exists, so profile state comes from cached auth payloads
- No public medicine create or update endpoints exist, so inventory items must start from medicines returned by `GET /api/v1/medicines`
- Some medicine presentation fields are stored locally until richer backend models are available
- Browser requests can fail if backend CORS is not enabled for the frontend origin

## Backend Endpoint Assumptions

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST|PATCH|PUT /api/v1/partner/account`
- `GET|PUT /api/v1/partner/inventory`
- `GET /api/v1/medicines`
