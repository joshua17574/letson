# Code Review Fixes — June 12, 2026

All findings from the code review, fixed. `tsc --noEmit`, `eslint` (on changed files), and `next build` all pass.

## 1. Removed unauthenticated write endpoints (critical)

**Deleted:**
- `app/api/slicing/batches/` — legacy route with **no auth**, could mutate `Product` stock from an unauthenticated request
- `app/api/slicing-standardsOrginal/` — legacy CRUD for the old standards model
- `models/SlicingStandard.ts` — dead model (slicing now uses `StandardPacking`)

Nothing in the frontend referenced these; the UI uses `/api/slicing` and `/api/slicing/standards`.

## 2. Server-side permission enforcement on every API route

All routes previously using `requireApiAuth` (any logged-in user) now use `requirePermission` with the permission matching the page that consumes them. Examples:

- `POST /api/slicing` → `slicing.manage`
- `DELETE /api/slicing/[id]` → `slicing.manage`
- `DELETE /api/sales/[id]` → `sales.manage`
- `DELETE /api/payments/[id]` → `payments.manage`
- `PATCH/DELETE /api/deliveries/[id]` → `supplier-deliveries.manage`
- All master-data writes → their `.manage` permission

**Shared lookup endpoints** (customer/category/supplier/bodega-product lists used by several different forms) accept an "any of" permission set so existing pages keep working — e.g. a cashier with only `sales.manage` can still load the customer dropdown. These sets are defined in `lib/role-permissions.ts` (`CUSTOMER_LOOKUP_PERMISSIONS`, etc.). Writes always require the strict single permission.

## 3. Fresh permissions on every API request (fixes JWT staleness)

`lib/require-permission.ts` now loads the user's **current** role permissions from the database (with a 30-second in-memory cache) instead of trusting the JWT snapshot taken at login. Consequences:

- Editing a role's permissions takes effect on API requests within ~30s, no re-login needed (role/user edits also invalidate the cache immediately).
- **Deactivating a user now revokes their API access immediately** — previously their JWT kept working until expiry.
- `proxy.ts` page gating still reads the token (fast path), so the nav/pages may look stale until re-login — but the APIs underneath are authoritative, so this is cosmetic.

## 4. All void/reversal flows are now transactional

Previously only *creation* flows used MongoDB transactions. Now wrapped in `withTransaction` with atomic "claim" semantics (`findOneAndUpdate({ isVoided: false }, { isVoided: true })` so double-clicking Void can't run the reversal twice):

- `DELETE /api/slicing/[id]` (void slicing batch)
- `DELETE /api/sales/[id]` (void sale)
- `DELETE /api/payments/[id]` (void payment + allocation reversal)
- `PATCH /api/deliveries/[id]` (edit delivery = reverse + re-apply, now one atomic unit)
- `DELETE /api/deliveries/[id]` (void delivery)

A crash mid-reversal now rolls everything back instead of leaving stock half-reversed.

## 5. No more silent `Math.max(stock - x, 0)` clamping

Stock deductions during voids now use conditional updates (`{ stockQty: { $gte: qty } }`). If the stock was already consumed (e.g. sliced output already sold), the void is **blocked with a clear message**:

> "Cannot void: CHICKEN LEG QUARTER only has 12 pcs in stock but this batch produced 80 pcs. Some output was already sold or delivered. Void or adjust those records first."

Previously the deduction silently clamped to zero, after which total stock no longer reconciled with the transaction ledger — corrupting the data your profit reports are built on.

## 6. Manila timezone day boundaries

New `lib/date-utils.ts` with `startOfDayManila` / `startOfMonthManila` helpers (fixed UTC+8, PH has no DST). `lib/dashboard.ts` now uses them, so "Today" / "This Month" figures are correct even when deployed on a UTC server. The boundaries also correctly contain date-only fields stored at UTC midnight (saleDate, slicingDate, expenseDate), so both field styles work.

## 7. Smaller fixes

- **Login no longer matches by display name** (`lib/auth.ts`) — only email or username. Name matching was collision-prone.
- Pre-existing type error fixed in `app/api/outlets/route.ts` (`FilterQuery` is no longer a named export in mongoose 9).
- `.gitignore` extended: `type-errors.txt`, `/public/uploads/` (runtime receipt uploads).
- Removed committed build artifacts: `tsconfig.tsbuildinfo`, `type-errors.txt`.

## Things to verify after deploying

1. Run through each role you've configured and confirm users can still reach the pages/actions they need. The permission tightening is intentional — a user who could previously hit an API directly without the matching permission will now get a 403. If a legitimate workflow breaks, the fix is granting that role the right permission, not loosening the API.
2. Voiding now requires sufficient stock to reverse. If staff hit the new "Cannot void" error, that's the system protecting ledger integrity — void the downstream records first.
3. Transactions require a MongoDB **replica set or Atlas** (already noted in your README) — this now applies to void flows too.

---

# Feature: Audit Logs — June 12, 2026

## What was added

**Every create, update, void, delete, and stock movement is now recorded** — who did it, when, which module/entity, the record's ID, a sanitized copy of the submitted data, and the result message.

### How it works

- `lib/audit-log.ts` — `withAuditLog(handler, meta)` wraps a route handler. When the handler returns 2xx, it writes an entry to the existing `AuditLog` collection. Failures in logging never break the business operation (try/catch, console-only). It also exports `logAudit()` for routes that want richer manual entries.
- All 35 mutating API route files are wrapped (55 handlers). The outlet and customer-delivery-confirm routes keep their existing richer custom logging — same collection, so everything appears in one viewer.
- Sensitive fields in captured request bodies are **redacted** (`password`, `token`, `secret`, etc.) and large payloads are truncated (8KB cap), so the log itself can't leak credentials.
- Action vocabulary: `CREATE`, `UPDATE`, `DELETE`, `VOID` (sales/slicing/payments/deliveries), `STOCK_IN`, `STOCK_ADJUSTMENT`.

### Viewer

- New page: **`/audit-logs`** (sidebar → Admin → Audit Logs), gated by the existing `audit-logs.view` permission (page rule added to `proxy.ts`).
- New API: **`GET /api/audit-logs`** — filters by module, action, user, date range, and free-text search; paginated; permission `audit-logs.view` or `activity-logs.view`.
- Each row has a detail dialog showing the full sanitized submitted data and (for routes that record it) old/new values. Timestamps display in Asia/Manila.
- Added a `createdBy + createdAt` index to `AuditLog` for the per-user filter.

### Notes

- **ADMIN sees the page immediately** (admin bypasses permission checks). For other roles, grant `audit-logs.view` in Roles.
- GET/read requests are intentionally **not** logged to keep the collection lean. If you later want login/logout or read tracking, that's a small extension of the same wrapper.
- The collection will grow with usage. If volume becomes a concern, add a TTL index, e.g. keep 1 year:
  `db.auditlogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 })`

---

# Feature: Stock Transfer Module — June 13, 2026

Delivery orders (DO) from the main branch bodega to outlets, with outlet-side
confirmation, discrepancy reporting, and full inventory tracking on both ends.

## Workflow

1. Main branch creates a Delivery Order on **`/stock-transfers`** — selects the
   outlet, products, and quantities. A transfer number is generated
   (`TRF-YYYYMMDD-0001`, daily sequence, duplicate-safe).
2. **Save as Draft** keeps it editable with no stock movement, or
   **Save & Dispatch** moves it straight to In Transit.
3. **Dispatch** atomically deducts bodega stock per item inside a MongoDB
   transaction with conditional guards — insufficient stock blocks the whole
   dispatch with a message naming the product, and the DO stays a draft.
   `BodegaStockTransaction` STOCK_OUT entries are written for every item.
4. The **delivery receipt** is printable from the list (printer icon) — clean
   layout with transfer details, item table, and Released by / Received by
   signature lines.
5. Outlet staff open **`/stock-transfers/incoming`**, optionally mark the goods
   as **Delivered** on arrival, then **Confirm**: count each line, enter the
   received quantity, and accept (full), partially accept, or reject items.
   Any shortage or rejection **requires a remark** — that becomes the
   discrepancy report.
6. Confirmation runs in one transaction: outlet inventory increases (existing
   items are incremented; new items are created from the product snapshot with
   pack size and prices), `OutletStockTransaction` DELIVERY_RECEIVED entries
   are written, and the transfer records received/variance totals.
7. The main branch sees the confirmation immediately: status badge, an amber
   **Discrepancy** badge when quantities didn't match, and the per-item
   variance report with outlet remarks in the detail view.
8. **Cancel** works on drafts (no stock involved) and in-transit transfers
   (dispatched stock is returned to the bodega transactionally). Confirmed
   transfers cannot be cancelled.

## Statuses

`DRAFT` → `IN_TRANSIT` (Pending Delivery) → `DELIVERED` (optional arrival
acknowledgment) → `CONFIRMED`, plus `CANCELLED`. Double-dispatch and
double-confirm are prevented by atomic status claims.

## Permissions (grant via Roles page)

- `stock-transfers.view` — see the main Stock Transfers page and history
- `stock-transfers.manage` — create, edit, dispatch, cancel (main branch)
- `stock-transfers.confirm` — Incoming Deliveries page and confirmation (outlet)

Outlet staff need only `stock-transfers.confirm`; they don't see the main
branch page. All three were added to the Outlets permission group, and
transfer users can load the bodega product list for the create form.

## Technical notes

- New models: `StockTransfer`, `StockTransferItem` (product snapshots keep
  history accurate if prices/names change later).
- New APIs: `/api/stock-transfers` (+ `[id]`, `[id]/dispatch`, `[id]/deliver`,
  `[id]/confirm`), all permission-gated and audit-logged
  (module STOCK_TRANSFERS, actions CREATE/UPDATE/DISPATCH/DELIVER/CONFIRM/CANCEL).
- Every stock movement appears in the existing ledgers: bodega side in
  `BodegaStockTransaction` (referenceType STOCK_TRANSFER), outlet side in
  `OutletStockTransaction`, so the inventory pages reconcile end to end.
- Discrepancy quantities are recorded but NOT automatically returned to bodega
  stock — missing goods are a real-world question (lost? returning with the
  driver?). If goods physically come back, record them with bodega stock-in;
  the variance report tells you exactly what to expect.

## Quick test after deploying

Create a DO with 2 products → Save & Dispatch → check the bodega product
stock dropped → open Incoming Deliveries → confirm with one item short
(remark required) → check outlet inventory increased by the received amounts
and the transfer shows the Discrepancy badge with your remark in the detail
view. Audit Logs will show all of it.

---

# Removal: Customer Deliveries Module — June 13, 2026

Removed the Customer Deliveries feature, which was causing a double stock
transaction alongside customer sales.

## Deleted

- Page: `/customer-deliveries` (and its client component)
- APIs: `/api/customer-deliveries` (+ `[id]`, `[id]/confirm`, `options`)
- Models: `CustomerDelivery`, `CustomerDeliveryItem`
- Helper: `lib/customer-delivery-utils.ts`
- Sidebar nav entry and proxy page rule
- Permissions `customer-deliveries.view` / `.manage` removed from the catalog

## Kept (separate feature you still use)

- `/api/customer-inventory` — made fully standalone: the two small helpers it
  borrowed (`idToString`, `numberValue`) are now inlined, and it uses its own
  new permission **`customer-inventory.view`** instead of the deleted
  customer-delivery permission. The `CustomerInventory` model and its data are
  untouched.

## Your existing data

Customer-delivery records in your live database were **left in place** — the
removal only deleted code. Nothing reads those collections anymore, so they're
harmless, but they're still there if you ever need to look something up.

When you're sure you no longer need them, run the optional one-time script
(take a backup first):

    npx tsx scripts/cleanup-customer-deliveries.ts

It drops the `customerdeliveries` and `customerdeliveryitems` collections and
strips the stale permissions from your Role documents. It does not touch sales,
customers, stock ledgers, or customer inventory.

## After deploying

- Roles that had `customer-deliveries.view`/`.manage` will simply ignore those
  keys (they no longer map to anything). Grant `customer-inventory.view` to
  anyone who needs the customer inventory endpoint.
- Customer sales now move stock exactly once, through the sales flow only.

---

# Stock Transfer Enhancements — June 13, 2026

Three improvements to the Stock Transfer module based on real use:

## 1. Grocery products can now be transferred

The delivery order product picker previously only listed bodega products. It now
shows both, grouped under "Bodega Products" and "Grocery Products" headings.
Grocery items deduct from `Product.stockPcs` and land in outlet inventory as
GROCERY-source items; bodega items work as before. Both flow through their own
ledgers (`InventoryTransaction` for grocery, `BodegaStockTransaction` for bodega),
so everything reconciles.

## 2. Pack-based bodega products transfer in PACKS, not pieces

A bodega product with a Standard PCS & Packs configuration (e.g. C10 = 10 pcs
per pack) is now entered, dispatched, counted, and confirmed in **packs**. Behind
the scenes the system converts to pieces for all stock math:

- Entering "3 packs" of C10 deducts 30 pcs from bodega stock (the dialog shows
  "= 30 pcs" live as you type).
- The outlet confirms in packs and the received amount is converted to pcs when
  it increases outlet inventory.
- Products without a standard packing stay in pieces/quantity as before.

Each transfer item stores both `qty` (the pack/piece count the user sees) and
`qtyPcs` (the true base-unit amount), plus a `unitLabel` so every screen shows
the right word. Transfer totals are tracked in pcs so they always match the
stock that actually moved. Insufficient-stock messages on dispatch now read in
the product's own unit (e.g. "needs 3 pack(s) (30 pcs)").

## 3. Bigger delivery order screen

The create/edit dialog is now much wider (up to 5xl / 95vw) with a proper
column layout — product, quantity-with-unit, and remove — so longer orders are
easier to read and fill in.

## Data note

These changes add fields to `StockTransferItem` (`source`, `productId`,
`unitLabel`, `qtyPcs`, `receivedPcs`). New transfers populate them automatically.
Any transfers created before this update will still display, but were all bodega
pieces, so they remain correct as-is.

---

# Dashboard Update: Outlets + Expense Breakdown — June 13, 2026

Extended the main dashboard with two new sections.

## Expenses by Business

A new card splits operating expenses into **Bodega** and **Grocery** using the
existing `expenseCategory` field on each expense. Shows this-month totals for
each, with today and all-time figures, plus a this-month split bar. The overall
"Today Expenses" / "Month Expenses" figures are unchanged — this just breaks
them down by business.

## Outlets

A new card surfaces the outlet network:
- Active outlets / total outlets
- Total stock value held across all outlets (sum of outlet inventory qty ×
  selling price)
- Total stocked items across outlets
- Top 5 outlets ranked by stock value, each with item count and value

This ties together the Stock Transfer module and outlet inventory you've been
building, giving the main branch a quick read on how much stock is sitting at
each outlet.

## Backend

`getDashboardSummary()` gained `totalBodegaExpenses`, `totalGroceryExpenses`,
per-period `bodegaExpenses`/`groceryExpenses` (today + thisMonth), and an
`outlets` summary block. All computed in the same parallel query batch, so the
dashboard makes no extra round-trips beyond the new aggregations.

---

# Fix: Dashboard expense breakdown missing older expenses — June 13, 2026

The "Expenses by Business" card was undercounting Bodega expenses (showed only
the most recently created one). Cause: the dashboard filtered Bodega expenses
with a strict `expenseCategory: "BODEGA"`, but expenses created before the
category field existed have no `expenseCategory` at all and are treated as
Bodega everywhere else in the app.

Fixed by matching the Expenses API's own logic: Bodega now includes records
where `expenseCategory` is "BODEGA" OR missing/null/empty. Grocery stays strict
("GROCERY"). Since every saved expense is normalized to exactly BODEGA, GROCERY,
or absent, the two now cover all records with no gaps — the breakdown reconciles
exactly with the overall expense total.

---

# Removal: Incoming Deliveries web page (moving to Mobile POS) — June 13, 2026

The outlet-side receiving flow is moving to the mobile POS, so the web app no
longer needs the Incoming Deliveries page.

## Removed
- Page `/stock-transfers/incoming` and its `IncomingDeliveriesPageClient`
- Sidebar nav entry and proxy page rule

## Kept (for the mobile POS to call)
- `POST /api/stock-transfers/[id]/deliver` — mark goods arrived
- `POST /api/stock-transfers/[id]/confirm` — count, accept/reject, receive into
  outlet inventory (with pack/grocery handling and discrepancy reporting)
- `GET /api/stock-transfers?incoming=true` — list transfers awaiting receipt
- The `stock-transfers.confirm` permission (mobile users still need it)

The main-branch web page (`/stock-transfers`) is unchanged: create, edit,
dispatch, cancel, and print all still work. Marking Delivered and Confirming
are now mobile-only, which matches the new split.

## Note for the mobile team
The confirm endpoint expects a JSON body:
`{ outletRemarks?, items: [{ itemId, receivedQty, remarks? }] }` where
receivedQty is in the item's unit (packs for pack products), 0..qty. Any
shortfall (receivedQty < qty) requires a remark. See the confirm route for the
exact contract.

---

# Test Data Seeder — June 13, 2026

Two scripts to fill the system with realistic [TEST] data for clicking through
every feature, and to remove it cleanly afterward.

## Safety (important — your DB has real data)

- Every seeded record is marked: names start with "[TEST]", and test sales /
  transfers use "TEST-" receipt/transfer numbers.
- The seeder ONLY inserts. It never edits or deletes existing data.
- Both scripts refuse to run without --confirm.
- The cleanup removes ONLY the [TEST]/TEST- records (and their child rows);
  anything without those markers is untouched.
- ALWAYS take an Atlas backup snapshot before running either script.

## Run it

    npm run seed:test       # insert all [TEST] data
    npm run cleanup:test    # remove all [TEST] data

(Both read MONGODB_URI from your environment, same as seed:admin. Run
`npm run seed:admin` first if you have no admin user, so seeded records can be
attributed.)

## What gets created

2 categories, 1 supplier, 2 customers, 2 outlets, 2 grocery products, 3 bodega
products (incl. a whole chicken and a pack-based C10), 1 standard packing
(C10 = 10 pcs/pack), 4 expenses (2 bodega + 2 grocery, varied types/dates),
1 slicing batch (20 heads → 680 pcs with ledger entries), 2 sales (1 paid
CHICKEN + 1 unpaid BODEGA) with a payment + allocation, and 2 stock transfers
(1 CONFIRMED that increased outlet inventory with both pack and grocery items,
1 DRAFT you can dispatch/cancel to test the workflow). Stock levels and ledgers
are adjusted to stay consistent.

## Verification note

The scripts compile cleanly and every create payload was cross-checked against
each model's required fields and enum values. They could not be executed against
a live MongoDB in the build environment (no DB access there), so do a first run
against a test database or right after taking an Atlas backup, and eyeball the
console output (it prints a count per entity).

---

# Test Data Seeder — fixes (env loading + stockUnit enum) — June 13, 2026

Two fixes after first real run:

1. Both seed-test-data.ts and cleanup-test-data.ts now load .env via dotenv
   (same as seed-admin.ts), so MONGODB_URI is read from your .env file. You no
   longer need to set the env var manually before running.

2. Fixed `SaleLine.stockUnit` — it was "PCS" (invalid; the enum is only "PACK"
   or "QTY"). The CHICKEN test sale now sells C10 in PACKS (stockUnit "PACK")
   and the grocery sale uses "QTY", matching how the real Sales API records
   lines. Stock math stays positive across slicing → sale → transfer.

After these fixes, every enum string value in the seed was cross-checked against
the model definitions (stockUnit, sale/transfer status, expense type, ledger
types, unit labels, item status) — all valid.

---

# Fix: Stock Transfer dialog too small — June 13, 2026

The create/edit delivery order dialog was rendering narrow (text truncated,
horizontal scrollbar). Cause: the shared DialogContent component has a built-in
`sm:max-w-sm` (small) width, and my width class wasn't overriding it reliably
at the `sm` breakpoint.

Fixed by setting explicit breakpoint widths that beat the base:
`w-[95vw] max-w-[95vw] sm:max-w-3xl lg:max-w-5xl`. The dialog is now large on
desktop and uses most of the screen on mobile/tablet. Applied the same fix to
the transfer detail (View) dialog for consistency. The shared dialog component
was left untouched, so no other dialogs in the app changed.

---

# Test Data Seeder — upgraded to heavy 10-day dataset — June 13, 2026

Replaced the small seed with a heavy 10-day dataset to make the dashboard and
reports look realistic and to stress-test them.

## What it generates (spread across the last 10 days)

- 10 customers, 5 outlets, 2 suppliers, 2 categories
- 4 grocery products + 4 bodega products (incl. pack-based C10)
- 1-2 slicing batches per day (whole chicken -> C10, with ledger entries)
- 8-14 sales per day across random customers (~110 receipts total): mix of
  CHICKEN (C10 packs) and GROCERY (qty), ~70% paid with payment + allocation,
  ~30% left unpaid so receivables show up
- 2-4 expenses per day, mixed Bodega/Grocery and varied types
- 1-2 stock transfers per day to random outlets: ~80% confirmed (increasing
  outlet inventory + ledger), ~20% left in transit, ~25% of confirmed ones
  carry a deliberate discrepancy so the variance reports have data
- 1 DRAFT transfer left open so you can test dispatch/cancel in the UI

Quantities are randomized within sensible ranges, and stock levels are tracked
so nothing goes negative. The script prints a summary (receipts, peso totals,
batches, transfers) when it finishes.

## Same safety + cleanup

Still all [TEST]-tagged, insert-only, --confirm required. `npm run cleanup:test`
removes the entire dataset (it keys off the [TEST]/TEST- markers and child
relationships, so volume doesn't matter).

Run: `npm run seed:test`  /  Remove: `npm run cleanup:test`
