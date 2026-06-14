# LETSON Cashier POS — Flutter App + Backend Design

This document is the plan for the mobile cashier POS (Flutter) and the changes
needed in the main system (Next.js) so the two connect cleanly. Read this first
and confirm the direction before we start writing code.

---

## 1. The big picture

```
┌─────────────────────────┐         HTTPS / JSON          ┌──────────────────────────┐
│   Flutter Cashier POS    │  ──── Bearer token ────────►  │   Main System (Next.js)  │
│   (phone / tablet)       │                               │   + MongoDB Atlas         │
│                          │  ◄──── JSON responses ──────  │                          │
│  - Login                 │                               │  /api/mobile/*  (new)     │
│  - Open / close cash     │                               │  /api/* (existing web)    │
│  - Ring up sales         │                               │                          │
│  - Receive transfers     │                               │  Web dashboard for owner  │
│  - Record expenses       │                               │  (already built)          │
│  - View outlet stock     │                               │                          │
└─────────────────────────┘                               └──────────────────────────┘
```

The phone is the **cashier at an outlet**. The web app stays the **owner/admin
back office**. They share one database, so a sale rung up on the phone shows on
the owner's dashboard instantly, and a stock transfer dispatched on the web
shows up on the phone for the cashier to receive.

---

## 2. The core problem to solve first: authentication

Your web app uses **NextAuth with a JWT stored in a cookie**. A Flutter app
cannot use cookie sessions cleanly — mobile apps use a **Bearer token** in the
`Authorization` header.

### Solution (keeps the web app 100% unchanged)

1. New endpoint **`POST /api/mobile/auth/login`** — takes username + password,
   verifies with the same bcrypt check, and returns a signed JWT (our own, via
   `jsonwebtoken`) plus the user's profile, role, permissions, and assigned
   outlet.
2. New helper **`requireMobileAuth(req, permission)`** — reads the
   `Authorization: Bearer <token>` header, verifies the JWT, loads the user's
   *current* permissions from the DB (same fresh-permission logic you already
   have), and checks the permission. Returns the user + their outlet.
3. The existing web `requirePermission` is untouched. New mobile endpoints use
   `requireMobileAuth`. No web behavior changes.

Tokens are long-lived (e.g. 30 days) with a refresh endpoint, so cashiers don't
get logged out mid-shift.

---

## 3. Two backend gaps to fill

### Gap A — Users aren't tied to an outlet
A cashier must sell *from a specific outlet* (so the sale deducts that outlet's
stock, not the main bodega). Right now `User` has no `outletId`.

**Fix:** add an optional `outletId` to the `User` model. The owner assigns each
cashier to an outlet in the existing Users page (small UI addition). The mobile
login returns that outlet, and the app is locked to it.

### Gap B — No cash open / close (shift) management
A POS needs the cashier to **open** the drawer with a starting cash float at the
start of a shift, and **close** it at the end — counting actual cash and seeing
the expected vs actual variance.

**Fix:** new `CashShift` model + endpoints. Every mobile sale/expense is tagged
with the open shift, so closing can compute expected cash = opening float +
cash sales − cash expenses, and record over/short.

---

## 4. What gets built — Backend (Next.js)

All new mobile endpoints live under `/api/mobile/` so they're clearly separated
and easy to secure.

### New models
- `CashShift` — outletId, cashierId, openingFloat, status (OPEN/CLOSED),
  openedAt, closedAt, expectedCash, countedCash, variance, totals snapshot.
- (Add `outletId` field to existing `User`.)

### New / changed endpoints
| Endpoint | Method | Purpose | Permission |
|---|---|---|---|
| `/api/mobile/auth/login` | POST | Token login | (public) |
| `/api/mobile/auth/refresh` | POST | Refresh token | (valid token) |
| `/api/mobile/auth/me` | GET | Current user + outlet + permissions | (valid token) |
| `/api/mobile/products` | GET | Sellable products for the outlet (outlet inventory: chicken packs + grocery), with prices & stock | sales.manage |
| `/api/mobile/sales` | POST | Ring up a sale (deducts outlet stock, records lines, links to shift) | sales.manage |
| `/api/mobile/sales` | GET | Today's / shift sales list | sales.view |
| `/api/mobile/sales/[id]` | GET | Receipt detail (for reprint) | sales.view |
| `/api/mobile/cash/open` | POST | Open shift with float | sales.manage |
| `/api/mobile/cash/close` | POST | Close shift, count cash, variance | sales.manage |
| `/api/mobile/cash/current` | GET | Current open shift + running totals | sales.view |
| `/api/mobile/expenses` | POST | Record an outlet expense | expenses-bodega.manage |
| `/api/mobile/transfers/incoming` | GET | Transfers in transit to this outlet | stock-transfers.confirm |
| `/api/mobile/transfers/[id]/confirm` | POST | Confirm received qty (reuses confirm logic) | stock-transfers.confirm |
| `/api/mobile/inventory` | GET | This outlet's current stock | outlet-inventory.view |
| `/api/mobile/customers` | GET | Customer list for credit sales | customers.view |

These reuse your existing business logic (the sale/transfer/stock functions);
they're thin mobile-facing wrappers with token auth + outlet scoping.

### New permission
- `cash.manage` (open/close shifts) — or fold into `sales.manage`. We'll add a
  dedicated one so you can give it only to cashiers.

---

## 5. What gets built — Flutter app

A clean, offline-tolerant cashier app. Structure:

```
lib/
  main.dart
  core/
    api_client.dart        # Dio HTTP client, attaches Bearer token, refresh
    auth_store.dart        # secure token storage (flutter_secure_storage)
    session.dart           # current user, outlet, permissions
  models/                  # Dart models mirroring API JSON
  features/
    auth/                  # login screen
    shift/                 # open cash / close cash screens
    sales/                 # product grid, cart, checkout, receipt
    transfers/             # incoming deliveries + confirm
    expenses/              # record expense
    inventory/             # view outlet stock
    history/               # today's sales / shift summary
  widgets/                 # shared UI
```

### Screens (the cashier flow)
1. **Login** — username + password → token stored securely.
2. **Open Cash** — if no shift is open, cashier enters starting float to begin.
3. **Sell (home)** — product grid (chicken packs + grocery), tap to add to cart,
   adjust qty, choose customer (for credit) or walk-in, take payment (cash /
   partial / credit), confirm → prints/show receipt. Stock deducts live.
4. **Incoming Deliveries** — list of transfers in transit to this outlet; open
   one, count each item, confirm (accept/short/reject) → outlet stock increases.
5. **Expenses** — quick form to log an outlet expense during the shift.
6. **Inventory** — read-only view of what's in stock at this outlet.
7. **Shift / History** — today's sales, running cash total, and **Close Cash**
   (count drawer → see expected vs actual → close shift).

### Key technical choices
- **Dio** for HTTP with an interceptor that attaches the token and auto-refreshes.
- **flutter_secure_storage** for the token (encrypted, not plain prefs).
- **Riverpod** (or Provider) for state — session, cart, current shift.
- **Offline tolerance:** cart is local; if a sale fails to send (no signal),
  queue it and retry. (Phase 2 — start online-only, add the queue after.)
- **Receipt printing:** start with an on-screen / shareable receipt; add
  thermal-printer support (esc/pos) as a later phase if you use BT printers.

---

## 6. Build order (phased, each phase shippable)

**Phase 1 — Auth foundation (backend)**
Mobile login/refresh/me endpoints, `requireMobileAuth`, add `outletId` to User,
owner UI to assign a cashier's outlet. → *Cashier can log in and see their outlet.*

**Phase 2 — Sell (backend + Flutter)**
Mobile products + sales endpoints; Flutter login, product grid, cart, checkout.
→ *Cashier can ring up sales that hit the owner's dashboard.*

**Phase 3 — Cash shifts**
CashShift model + open/close/current endpoints; Flutter open/close screens.
→ *Full drawer accountability with variance.*

**Phase 4 — Transfers + expenses + inventory**
Mobile transfer-confirm, expense, inventory endpoints; matching Flutter screens.
→ *Cashier receives stock, logs expenses, checks stock.*

**Phase 5 — Polish**
Offline queue, receipt printing, refinements.

---

## 7. What I need from you to start

1. **Confirm the direction above** (or tell me what to change).
2. **Outlet model:** should one cashier = one fixed outlet (simplest), or can a
   cashier switch between outlets at login? (I recommend one fixed outlet.)
3. **Payment types** the cashier handles: cash only, or also GCash / credit?
   (Affects the checkout screen and cash-close math.)
4. **Receipt:** on-screen/share is fine to start, or do you have a specific
   Bluetooth thermal printer model in mind?

Once you confirm, I'll start with **Phase 1** (the auth foundation) since
everything else depends on it, deliver it as a working, typechecked update to
your main system, then move to the Flutter app.
