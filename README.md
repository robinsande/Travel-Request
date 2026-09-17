# CARE Kenya Travel Authority Request — Frontend

Plain HTML, CSS, and vanilla JavaScript frontend for the CARE Kenya Travel Authority Request (TAR) system.

## Prerequisites

- The TAR **backend API** is deployed at `https://tar-backend.onrender.com/api` by default.
- A modern web browser

## Quick start

1. Start the backend (port 5000).

2. Serve the `frontend/` folder with any static file server:

   ```bash
   npx serve frontend
   ```

   Or use the **Live Server** extension in VS Code / Cursor and open `frontend/index.html`.

3. Open the URL shown by your static server (e.g. `http://localhost:5500` with Live Server).

4. Sign in with seed test users — see backend `npm run seed` (`Password123!`):
   - Users: `alice@example.com`, `bob@example.com`, `carol@example.com`
   - Admins: `manager@example.com`, `manager2@example.com`
   - Superadmin: `super@example.com`

## Backend configuration

Set the backend `FRONTEND_URL` environment variable to match where you serve this frontend, so activation email links work correctly:

```
FRONTEND_URL=http://localhost:5500
```

Activation links point to `activate.html?email=...&token=...` on your frontend URL (not port 5000).

**Important:** The API runs on port **5000** (`http://127.0.0.1:5000`); the frontend must run on a **different** port (e.g. **5500** with Live Server). Your backend `.env` should have:

```
FRONTEND_URL=http://localhost:5500
MONGODB_URI=mongodb://127.0.0.1:27017/care-travel-request
```

The login page checks backend connectivity automatically. For local development, override the API URL with `?apiBase=http://127.0.0.1:5000/api`.

## Local testing without email

If you need to set a password without going through the activation email flow, a backend admin can run:

```bash
node scripts/setPassword.js email@care.org YourPassword123
```

## Project structure

```
frontend/
  index.html                 → redirects to login or dashboard
  login.html                 → sign in
  activate.html              → account activation / set password
  dashboard.html             → my profile (role-aware shell home)
  requests.html              → my / team / all requests (by role)
  request-new.html           → create travel request
  request-detail.html        → view request, edit & resubmit if rejected
  reimbursements.html        → my / all reimbursement reports
  reimbursement-new.html     → submit reimbursement
  reimbursement-detail.html  → reimbursement detail and decisions
  reimbursement-approvals.html → admin reimbursement approval queue
  approvals.html             → admin pending travel approval queue
  notifications.html         → notifications inbox
  admin-users.html           → superadmin user list
  admin-import.html          → superadmin employee Excel import
  css/styles.css
  js/
    config.js                → API base URL and app constants
    auth.js                  → session storage, login helpers, route guards
    ui.js                    → toasts, shell layout, shared UI helpers
    requests.js              → travel request form/list helpers
    reimbursements.js        → reimbursement form/list helpers
    notifications.js         → badge polling + inbox UI
    admin.js                 → users/import UI helpers
    api/
      http.js                → fetch client, JWT headers, errors
      auth.js                → /auth/*
      users.js               → /users/*
      requests.js            → /requests/* and travel-request PDFs
      reimbursements.js      → /reimbursements/*
      notifications.js       → /notifications/*
      admin.js               → /admin/*
```

## User roles

| Role | Capabilities |
|------|-------------|
| **user** | Create requests, submit reimbursements, view own requests and reimbursements, resubmit rejected requests, notifications |
| **admin** | Everything user can do, plus approve/reject team requests, reimbursement approvals, team request filters |
| **superadmin** | Read-only all requests and reimbursements, list users, import employees (no create/approve) |

## API configuration

This is a **static** frontend (no CRA/Vite). There is no `REACT_APP_*` or `VITE_*`.

Default API base is set in `frontend/js/config.js` (`http://127.0.0.1:5000/api`).

Overrides (preferred for staging/production):

1. Query: `?apiBase=http://host:port/api` (persisted in `localStorage`)
2. Inject `window.__CARE_API_BASE__` before `config.js` loads

See `.env.example` for documentation only (the browser does not load `.env` files).

## Authentication

- JWT is stored in `localStorage` after login or activation.
- Protected pages redirect to `login.html` when no token is present.
- `401` responses clear the session and redirect to login.
- Logout clears `localStorage` and returns to the landing page.
- Request list scopes: `?scope=mine|team|all` are sent to `GET /api/requests` so admin “My Requests” and “Team Requests” stay distinct.
