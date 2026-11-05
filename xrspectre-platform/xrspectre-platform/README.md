# XRSpectre — Frontend

React 19 + Vite single-page app. See the [repository README](../../README.md)
for deployment and full setup.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 — /api is proxied to http://localhost:4000
```

Start the API first (`xrspectre-backend/xrspectre-backend`, `npm run dev`).
To proxy to a different backend: `VITE_DEV_API_TARGET=http://host:port npm run dev`.

## Build

```bash
npm run build      # outputs dist/, served by the API in production
```

The app calls the API on the same origin (`/api`). Only if you host the
frontend separately from the API, set `VITE_API_URL` at build time
(e.g. `VITE_API_URL=https://your-api.onrender.com/api`) and add the
frontend's origin to the API's `CLIENT_ORIGIN`.

## Structure

```
src/
  api/          Fetch wrappers for each API area (client.js holds auth + base URL)
  components/   Shared UI (layouts, editor, modals, pickers)
  context/      Auth session and the multi-step "create test" draft
  pages/        Routed screens (admin, mentor, student)
  utils/        Browser fingerprint, function-signature templates
```
