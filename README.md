# HR Warehouse ERP (MERN)

A like-for-like port of the "HR Warehouse ERP 2.4" Google Sheets / Apps Script system to
MongoDB + Express + React + Node. Same 15 screens, same rules, same calculations. One admin login.

```
hr-warehouse-erp/
├── backend/    Express API (port 5000) → MongoDB
├── frontend/   React + Vite app (port 5173)
├── docs/       SETUP-GUIDE.md  ← start here
└── .github/workflows/ci.yml
```

**Setup, accounts, environment variables and deployment:** see [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md).

## Quick start (after the setup guide's step 1-4)

```bash
cd backend  && npm install && npm run dev     # API on http://localhost:5000
cd frontend && npm install && npm run dev     # App on http://localhost:5173
```

## How a request flows

React page → `frontend/src/api/erp.api.js` (axios) → `backend/src/routes` → `controllers` → `services` → `models` → MongoDB

- **routes** only list URLs
- **controllers** read the request and send the response
- **services** hold the real business logic. Every old Apps Script function lives here with the same name,
  rules and error messages (`addAsset`, `createSale`, `recordPayment`, `markOrderDelivered`, `voidSale`,
  `paySeller`, `runMonthlyStorageBilling`, `getDashboardData`, ...). `erp.api.js` uses the same names on the screen side.

## Old system → new system

| Old (Google)                          | New (MERN)                                   |
|---------------------------------------|----------------------------------------------|
| 13 sheets                             | MongoDB collections, same field names        |
| SEL-0001 style IDs (max + 1)          | `Counter` collection, atomic, same format    |
| LockService + manual rollback         | MongoDB transactions (`utils/transaction.js`)|
| Google Drive media folders            | Cloudinary, same folder layout               |
| `google.script.run.fn()`              | `/api/...` REST calls                        |
| `prompt()` / `confirm()` / `alert()`  | React modal (`components/common/Modal.jsx`)  |
| Dashboard refresh every 3 s           | Same (only while the tab is visible)         |
| Audit "Actor" = user email            | "Admin"                                      |

## Scripts

| Where    | Command                                   | What it does                                  |
|----------|-------------------------------------------|-----------------------------------------------|
| backend  | `npm run dev`                             | Start the API and restart on file changes     |
| backend  | `npm start`                               | Start the API (production)                    |
| backend  | `npm run hash-password -- "MyPassword"`   | Make the `ADMIN_PASSWORD_HASH` value          |
| backend  | `npm run seed`                            | Add default settings + categories (also runs automatically at start) |
| backend  | `npm run import:sheet -- ./sheet-export`  | One-time import of the old sheet's CSV files  |
| backend  | `npm test`                                | Full business-flow test on a throwaway database |
| frontend | `npm run dev` / `npm run build` / `npm run lint` | Develop / build / check the React app  |
