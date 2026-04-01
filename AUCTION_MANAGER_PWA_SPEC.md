# Auction Manager PWA — Cursor Build Spec

## Project Summary

Rebuild the **Auction Manager V2** (originally a Python/Flask/PyInstaller desktop app) as a **Next.js Progressive Web App** with full offline support. The app is a live auction clerking tool for fundraising organizations. It must work identically on Windows, Mac, Linux, and Chromebooks — with zero internet dependency after first load.

> **Distribution model:** Deploy to Vercel. User visits the URL once, installs the PWA, and it runs offline forever after. No app stores, no installers, no platform-specific builds.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Static export (`output: 'export'`) for full offline support |
| UI | React 18 + Tailwind CSS 3 | All styles local — no CDN imports |
| Icons | lucide-react | Bundled, not CDN |
| Local Database | Dexie.js (IndexedDB wrapper) | Replaces SQLite — persistent, browser-native |
| PDF Generation | jsPDF + jsPDF-AutoTable | Client-side PDF creation for invoices/reports |
| CSV Export | Native JS (Blob + download) | No library needed |
| PWA | next-pwa or @serwist/next | Service worker, caching, install prompt |
| State Management | React Context + Dexie liveQuery | Reactive database queries |
| Testing | Vitest + React Testing Library | Unit and integration tests |

---

## Non-Negotiables (Carry Forward from V1/V2)

These constraints are absolute and must not be violated:

1. **100% Offline Functionality** — After the initial visit and PWA install, the app must work with NO network connection. No fetch calls to external APIs at runtime. All assets (CSS, JS, fonts, icons) must be bundled and cached by the service worker.

2. **Local Data Storage Only** — All data lives in the browser's IndexedDB. Nothing is sent to a server. No analytics, no telemetry, no external calls.

3. **Single Distribution Method** — One URL, one codebase. The PWA install works on every platform. There are no platform-specific builds or downloads.

4. **Data Isolation Between Events** — Each auction event has completely separate bidders, lots, sales, and invoices. Switching events changes the entire data context.

5. **Data Portability** — Users must be able to export and import complete event data as JSON files (replacing the old "copy the .db file" workflow). This is their backup and transfer mechanism.

---

## Database Schema (Dexie.js / IndexedDB)

Define the database in a single file: `lib/db.ts`

```typescript
import Dexie, { type Table } from 'dexie';

// ── Interfaces ──────────────────────────────────────────

export interface AuctionEvent {
  id?: number;               // Auto-incremented
  name: string;
  description?: string;
  organizationName: string;
  taxRate: number;           // e.g. 0.0875 for 8.75%
  currencySymbol: string;    // default "$"
  createdAt: Date;
  updatedAt: Date;
}

export interface Bidder {
  id?: number;
  eventId: number;           // FK → AuctionEvent
  paddleNumber: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lot {
  id?: number;
  eventId: number;
  baseLotNumber: number;     // Numeric lot number (e.g. 1, 2, 3)
  lotSuffix: string;         // "" for base lot, "A"/"B"/"C" for pass-outs
  displayLotNumber: string;  // Computed on write: "0001", "0001A", "0001B"
  description: string;
  consignor?: string;        // Consignor name or ID
  quantity: number;          // Default 1 — for pass-out lots, persists from parent
  status: 'unsold' | 'sold' | 'passed' | 'withdrawn';
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id?: number;
  eventId: number;
  lotId: number;             // FK → Lot
  bidderId: number;          // FK → Bidder
  displayLotNumber: string;  // Denormalized: "0001", "0001A", etc.
  paddleNumber: number;      // Denormalized for fast display
  description: string;       // Denormalized — lot description at time of sale
  consignor?: string;        // Denormalized from lot
  quantity: number;          // Denormalized from lot
  amount: number;
  clerkInitials: string;
  createdAt: Date;
}

export interface Invoice {
  id?: number;
  eventId: number;
  bidderId: number;          // FK → Bidder
  invoiceNumber: string;     // e.g. "INV-2024-001"
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'unpaid' | 'paid';
  paymentMethod?: 'cash' | 'check' | 'credit_card' | 'other';
  paymentDate?: Date;
  generatedAt: Date;
}

export interface AppSettings {
  id?: number;               // Always 1 — singleton
  currentEventId: number | null;
  lastBackupDate?: Date;
}

// ── Database Definition ─────────────────────────────────

export class AuctionDB extends Dexie {
  events!: Table<AuctionEvent>;
  bidders!: Table<Bidder>;
  lots!: Table<Lot>;
  sales!: Table<Sale>;
  invoices!: Table<Invoice>;
  settings!: Table<AppSettings>;

  constructor() {
    super('AuctionManagerDB');

    this.version(1).stores({
      events:   '++id, name, createdAt',
      bidders:  '++id, eventId, paddleNumber, [eventId+paddleNumber]',
      lots:     '++id, eventId, baseLotNumber, lotSuffix, displayLotNumber, status, [eventId+displayLotNumber], [eventId+baseLotNumber]',
      sales:    '++id, eventId, lotId, bidderId, displayLotNumber, paddleNumber',
      invoices: '++id, eventId, bidderId, status, invoiceNumber',
      settings: '++id'
    });
  }
}

export const db = new AuctionDB();
```

### Index Design Notes
- The compound index `[eventId+paddleNumber]` enables fast bidder lookup during clerking.
- The compound index `[eventId+displayLotNumber]` enables fast lot lookup and duplicate prevention (e.g., no two "0001A" in the same event).
- The compound index `[eventId+baseLotNumber]` enables querying all pass-out variants of a lot (e.g., find all lots with base 1: "0001", "0001A", "0001B").
- `displayLotNumber` is a string like "0001", "0001A", "0001B" — written at insert time, not computed at read time.
- All queries should filter by `eventId` to enforce data isolation.

---

## Application Structure

```
auction-manager-pwa/
├── app/
│   ├── layout.tsx                 # Root layout — sidebar nav, event selector
│   ├── page.tsx                   # Dashboard — event summary stats
│   ├── events/
│   │   └── page.tsx               # Create / manage / switch events
│   ├── bidders/
│   │   └── page.tsx               # Register, edit, search bidders
│   ├── clerking/
│   │   └── page.tsx               # Record sales (PRIMARY WORKFLOW)
│   ├── invoices/
│   │   └── page.tsx               # Generate, view, mark paid
│   ├── reports/
│   │   └── page.tsx               # Summary, bidder totals, lot results, CSV export
│   └── settings/
│       └── page.tsx               # Event settings, data export/import, about
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   ├── EventSwitcher.tsx      # Current event indicator + switcher dropdown
│   │   └── Header.tsx             # Page header with breadcrumbs
│   ├── events/
│   │   ├── EventForm.tsx          # Create/edit event modal or form
│   │   └── EventCard.tsx          # Event summary card
│   ├── bidders/
│   │   ├── BidderForm.tsx         # Add/edit bidder form
│   │   ├── BidderTable.tsx        # Sortable/filterable bidder list
│   │   └── BidderSearch.tsx       # Quick search component
│   ├── clerking/
│   │   ├── SaleForm.tsx           # Main clerking input form (includes pass-out logic)
│   │   ├── PassOutCheckbox.tsx    # "Pass Out Lots" toggle with keyboard hint
│   │   ├── RecentSales.tsx        # Live feed of recent sales (groups pass-outs)
│   │   └── LotLookup.tsx         # Quick lot info lookup
│   ├── invoices/
│   │   ├── InvoiceTable.tsx       # Invoice list with status
│   │   ├── InvoiceDetail.tsx      # Single invoice view
│   │   └── PaymentModal.tsx       # Mark as paid + select method
│   ├── reports/
│   │   ├── SummaryStats.tsx       # Key metrics cards
│   │   ├── BidderTotals.tsx       # Bidder spending breakdown
│   │   └── LotResults.tsx         # Lot-by-lot results
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Select.tsx
│       ├── Table.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── Toast.tsx              # Success/error notifications
│       └── ConfirmDialog.tsx      # Destructive action confirmation
├── lib/
│   ├── db.ts                      # Dexie database definition (schema above)
│   ├── hooks/
│   │   ├── useCurrentEvent.ts     # Get/set current event context
│   │   ├── useBidders.ts          # CRUD + queries for bidders
│   │   ├── useLots.ts             # CRUD + queries for lots
│   │   ├── useSales.ts            # CRUD + queries for sales
│   │   ├── useInvoices.ts         # CRUD + invoice generation logic
│   │   └── useReports.ts          # Aggregation queries for reports
│   ├── services/
│   │   ├── invoiceGenerator.ts    # PDF invoice generation (jsPDF)
│   │   ├── csvExporter.ts         # CSV export utilities
│   │   ├── dataPorter.ts          # Full event export/import as JSON
│   │   └── reportCalculator.ts    # Tax calculations, totals, aggregations
│   └── utils/
│       ├── formatCurrency.ts
│       ├── formatDate.ts
│       ├── validators.ts          # Input validation helpers
│       └── constants.ts           # Payment methods, status enums, etc.
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── icon-maskable.png
│   └── offline.html               # Fallback page (should never appear)
├── next.config.js                 # Static export + PWA config
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Page-by-Page Feature Specification

### 1. Dashboard (`app/page.tsx`)

**Purpose:** At-a-glance overview of the current event.

**Content:**
- Current event name and organization prominently displayed
- Summary stat cards:
  - Total bidders registered
  - Total lots (with sold/unsold/passed breakdown)
  - Total revenue (sum of all sale amounts)
  - Total invoices generated / paid / unpaid
- Quick-action buttons: "Register Bidder", "Record Sale", "Generate Invoices"
- Recent activity feed (last 10 sales)

**Empty State:** If no event exists, show a welcome message and "Create Your First Event" button.

---

### 2. Events (`app/events/page.tsx`)

**Purpose:** Create, edit, delete, and switch between auction events.

**Features:**
- Event list showing all events as cards with: name, description, date created, counts (bidders, lots, sales)
- "Create New Event" button → opens `EventForm` modal
- "Switch to Event" button on each card → sets as current event
- "Edit" button → opens `EventForm` pre-populated
- "Delete" button → confirmation dialog with warning about permanent data loss
- "Export Event" button → downloads complete event data as JSON file
- "Import Event" button → uploads JSON file, creates new event from data

**Event Form Fields:**
- Event name (required)
- Description (optional)
- Organization name (required — used on invoices)
- Tax rate (percentage, default 0)
- Currency symbol (default "$")

---

### 3. Bidders (`app/bidders/page.tsx`)

**Purpose:** Register bidders and manage bidder information.

**Features:**
- Bidder registration form:
  - Paddle number — auto-suggests next available, but editable
  - First name (required)
  - Last name (required)
  - Phone (optional)
  - Email (optional)
- Bidder table with columns: Paddle #, Name, Phone, Email, Total Spent, # Items Won
  - Sortable by any column
  - Filterable search bar (searches name, paddle number, phone, email)
- Inline edit capability — click Edit on any row to modify bidder info
- Delete bidder — only allowed if they have zero sales

**Auto-Increment Logic:**
- On form load, query the max `paddleNumber` for the current event
- Suggest `max + 1` as default
- Validate on submit that the paddle number is not already taken in this event

---

### 4. Clerking (`app/clerking/page.tsx`) — PRIMARY WORKFLOW

**Purpose:** Record sales during a live auction. This is the most performance-critical and most-used page.

**Layout:** Split into two panels:
- **Left panel (60%):** Sale entry form (including Pass Out Lots controls)
- **Right panel (40%):** Recent sales feed (scrollable, most recent at top)

---

#### Sale Entry Form Fields

1. **Lot Number** (text input, zero-padded display) — auto-suggests next sequential lot number
2. **Lot Description / Title** (text input) — if lot number matches an existing lot, auto-fills
3. **Consignor** (text input, optional) — consignor name or ID number
4. **Quantity** (number input, default 1) — number of units in this lot
5. **Sell Price** (currency input) — formatted with currency symbol
6. **Paddle Number** (number input) — validates that paddle exists, shows bidder name on match
7. **Clerk Initials** (text input, 2-3 chars) — persists between entries (sticky via sessionStorage)

---

#### Pass Out Lots Feature

**Purpose:** When selling multiple units of the same item to different bidders (e.g., 5 identical gift baskets sold individually), the clerk can "pass out" the same lot to multiple buyers without re-entering lot details. Each pass-out gets a unique sub-lot number (0001A, 0001B, etc.).

**UI Element:**
- A checkbox labeled **"Pass Out Lots"** is displayed above the sale entry form
- The checkbox is **unchecked by default** on page load
- The checkbox remains in its current state until manually toggled — it does NOT auto-reset between sales

**Pass Out State Machine:**

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLERKING MODES                            │
├──────────────┬───────────────────────────────────────────────────┤
│              │                                                   │
│  NORMAL      │  Checkbox unchecked (or Enter key)                │
│  MODE        │  → Clerk sale                                     │
│              │  → Clear ALL fields except Clerk Initials         │
│              │  → Auto-increment lot number to next integer      │
│              │  → Focus → Lot Number field                       │
│              │                                                   │
├──────────────┼───────────────────────────────────────────────────┤
│              │                                                   │
│  PASS OUT    │  Checkbox checked (or Shift+Enter key)            │
│  MODE        │  → Clerk sale                                     │
│              │  → Keep: Title, Consignor, Quantity, Sell Price   │
│              │  → Clear: Paddle Number                           │
│              │  → Lot number: append next alpha suffix           │
│              │    (base → A → B → C → ... → Z → AA → AB ...)   │
│              │  → Focus → Paddle Number field                    │
│              │                                                   │
└──────────────┴───────────────────────────────────────────────────┘
```

**Lot Number Suffix Sequencing:**

| Sale # | Display Lot Number | Suffix Logic |
|---|---|---|
| First sale (base lot) | `0001` | No suffix — this is the original lot |
| Pass-out 1 | `0001A` | First alpha suffix |
| Pass-out 2 | `0001B` | Sequential alpha |
| Pass-out 26 | `0001Z` | Last single letter |
| Pass-out 27 | `0001AA` | Double letter (unlikely but handle it) |

Implementation: Store `baseLotNumber: 1`, `lotSuffix: ""` for the base lot, `lotSuffix: "A"` for first pass-out, etc. The `displayLotNumber` is computed at write time: `baseLotNumber.toString().padStart(4, '0') + lotSuffix`.

**Suffix generation utility:**
```typescript
function nextSuffix(current: string): string {
  if (current === '') return 'A';
  // Treat suffix like a base-26 number: A=0, B=1, ..., Z=25, AA=26, AB=27...
  const chars = current.split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
  }
  return 'A' + chars.join(''); // Overflow: Z → AA, ZZ → AAA
}
```

---

#### Keyboard Shortcuts

| Key Combo | Action | Result |
|---|---|---|
| `Enter` | **Normal Clerk** | Records the sale. If Pass Out checkbox is checked, stays in pass-out mode. If unchecked, resets form for new lot. |
| `Shift+Enter` | **Activate Pass Out + Clerk** | Records the sale AND activates pass-out mode for the next entry (checks the checkbox if not already checked). Next form loads with same lot details, suffixed lot number, and focus on Paddle #. |
| `Tab` | **Field navigation** | Lot # → Title → Consignor → Quantity → Sell Price → Paddle # → (Enter to submit) |
| `Escape` | **Cancel pass-out mode** | Unchecks the Pass Out checkbox, clears form, returns to normal mode |

**Shift+Enter Detail:**
- If the checkbox is currently unchecked, Shift+Enter checks it AND clerks the current item in pass-out mode
- If the checkbox is currently checked, Shift+Enter clerks normally in pass-out mode (same as plain Enter when checkbox is on)
- This means: Shift+Enter on the LAST pass-out item still stays in pass-out mode. To EXIT pass-out mode, the clerk either:
  - Manually unchecks the checkbox, then presses Enter (normal clerk), OR
  - Presses Enter with the checkbox unchecked (normal mode)

**Critical Shift+Enter → Enter transition (from the user story):**
When a clerk is in pass-out mode and presses plain `Enter` (not Shift+Enter):
- If the checkbox IS checked: the sale clerks in pass-out mode (checkbox state governs)
- If the checkbox is NOT checked: the sale clerks in normal mode
- The keyboard shortcut Shift+Enter is a convenience to ENTER pass-out mode — but the checkbox is the source of truth

---

#### On Submit — Normal Mode (checkbox unchecked, Enter key)

1. Validate all required fields (lot #, title, sell price, paddle #)
2. Create Lot record: `baseLotNumber`, `lotSuffix: ""`, `displayLotNumber`, status → "sold"
3. Create Sale record with all denormalized fields
4. Clear ALL form fields EXCEPT Clerk Initials
5. Auto-increment: set Lot Number to `(max baseLotNumber in event) + 1`
6. Set Quantity back to default (1)
7. Focus → Lot Number field
8. Show success toast
9. Update recent sales feed

#### On Submit — Pass Out Mode (checkbox checked, or Shift+Enter)

1. Validate all required fields (lot #, title, sell price, paddle #)
2. Create Lot record: `baseLotNumber` (same as current), `lotSuffix` (next in sequence), status → "sold"
3. Create Sale record with all denormalized fields
4. **Persist** these fields: Title, Consignor, Quantity, Sell Price
5. **Clear**: Paddle Number only
6. **Update Lot Number**: append next alpha suffix (e.g., 0001 → 0001A → 0001B)
7. Focus → Paddle Number field
8. Show success toast
9. Update recent sales feed

**Note:** The very first sale of a lot (the base lot "0001") is always recorded as the base. When pass-out mode triggers on that first clerk, the NEXT lot becomes "0001A". The base lot itself never gets a suffix retroactively.

---

#### Pass Out Lots — Tracking State

The clerking form must track the following state for pass-out functionality:

```typescript
interface ClerkingFormState {
  // Form field values
  lotNumber: string;          // Display value, e.g. "0001A"
  title: string;
  consignor: string;
  quantity: number;
  sellPrice: string;          // String for input, parsed to number on submit
  paddleNumber: string;
  clerkInitials: string;

  // Pass-out tracking
  passOutEnabled: boolean;    // Checkbox state
  currentBaseLotNumber: number | null;  // Base lot # for current pass-out sequence
  currentSuffix: string;      // Current suffix in sequence ("", "A", "B", ...)
  
  // Auto-suggest
  nextLotNumber: number;      // Next available base lot number
}
```

---

#### Recent Sales Feed

- Shows last 20 sales for the current event
- Each entry displays: `Lot #{displayLotNumber} — {title} — ${amount} — Paddle #{paddleNumber} — Qty: {quantity} — {clerkInitials}`
- Pass-out lots are visually grouped: indent or highlight lots that share the same `baseLotNumber`
- Click to expand for edit/void options
- "Void Sale" option — marks lot as unsold, deletes sale record (with confirmation)
- When voiding a pass-out lot, only that specific sub-lot is voided (not the entire pass-out group)

---

#### Clerking Page — Walkthrough Example

**Scenario:** 5 lawn mowers to sell individually.

| Step | Clerk Action | Form After Submit |
|---|---|---|
| 1 | Fill in: Lot: 0001, Title: "Lawn Mower", Consignor: 3, Qty: 5, Price: 100.00, Paddle: 100. Check "Pass Out Lots". Press Enter. | Lot: **0001A**, Title: "Lawn Mower", Consignor: 3, Qty: 5, Price: 100.00, Paddle: _{blank, focused}_ |
| 2 | Enter Paddle: 101. Press Enter. | Lot: **0001B**, Title: "Lawn Mower", Consignor: 3, Qty: 5, Price: 100.00, Paddle: _{blank, focused}_ |
| 3 | Enter Paddle: 102. Press Enter. | Lot: **0001C**, Title: "Lawn Mower", Consignor: 3, Qty: 5, Price: 100.00, Paddle: _{blank, focused}_ |
| 4 | Enter Paddle: 103. Uncheck "Pass Out Lots". Press Enter. | Lot: **0002**, Title: _{blank}_, Consignor: _{blank}_, Qty: 1, Price: _{blank}_, Paddle: _{blank}_, Focus → Lot # |

**Same scenario using keyboard shortcuts:**

| Step | Clerk Action | Form After Submit |
|---|---|---|
| 1 | Fill in all fields. Press **Shift+Enter**. | Lot: **0001A** (pass-out activated), persisted fields, Paddle: _{blank, focused}_ |
| 2 | Enter Paddle: 101. Press **Shift+Enter**. | Lot: **0001B**, persisted fields, Paddle: _{blank, focused}_ |
| 3 | Enter Paddle: 102. Press plain **Enter** while checkbox is still checked. | Lot: **0001C**, persisted fields, Paddle: _{blank, focused}_ (checkbox still governs) |
| 4 | Enter Paddle: 103. Uncheck checkbox. Press **Enter**. | Lot: **0002** (normal mode), all fields cleared, Focus → Lot # |

---

### 5. Invoices (`app/invoices/page.tsx`)

**Purpose:** Generate invoices for winning bidders and track payments.

**Features:**
- Invoice table with columns: Invoice #, Bidder (name + paddle), Subtotal, Tax, Total, Status, Payment Method
- "Generate All Invoices" button — creates invoices for every bidder with at least one unpaid sale
- "Generate Invoice" on individual bidder rows
- Click any invoice to view detail (list of items won)
- "Mark as Paid" button → opens PaymentModal:
  - Payment method selector: Cash, Check, Credit Card, Other
  - Confirms and updates status
- "Print Invoice" button → generates PDF via jsPDF and opens in new tab / triggers download
- "Print All Unpaid" button → generates a combined PDF of all unpaid invoices
- Filter invoices by status (All / Unpaid / Paid)

**Invoice Number Format:** `{EVENT_ID}-{SEQUENTIAL_NUMBER}` padded to 3 digits (e.g., `1-001`, `1-002`)

**Invoice Generation Logic:**
1. For each bidder with sales in the current event:
2. Sum all sale amounts → subtotal
3. Apply event tax rate → tax amount
4. subtotal + tax → total
5. Create Invoice record
6. If invoice already exists for this bidder+event and is unpaid, update it instead of creating duplicate

---

### 6. Reports (`app/reports/page.tsx`)

**Purpose:** View summary statistics and export data.

**Report Sections:**

**A. Event Summary**
- Total revenue
- Number of lots sold / passed / unsold / withdrawn
- Number of registered bidders
- Number of active bidders (made at least 1 purchase)
- Average sale amount
- Highest sale (lot # and amount)
- Total tax collected
- Total invoiced / total paid / total outstanding

**B. Bidder Totals Table**
- Columns: Paddle #, Name, Items Won, Subtotal, Tax, Total, Payment Status
- Sortable by any column
- "Export as CSV" button

**C. Lot Results Table**
- Columns: Lot # (displayLotNumber), Description, Consignor, Qty, Status, Winning Bid, Winning Paddle, Clerk
- Pass-out lots (suffix A, B, C...) are visually grouped under their base lot
- Sortable by any column
- "Export as CSV" button

**D. Payment Method Summary**
- Breakdown by payment method: count and total amount
- Pie chart or simple bar visualization (optional — CSS only, no chart library required)

---

### 7. Settings (`app/settings/page.tsx`)

**Purpose:** Event-specific settings, data management, and app information.

**Sections:**

**A. Current Event Settings** (editable)
- Organization name
- Tax rate
- Currency symbol

**B. Data Management**
- "Export Current Event" → JSON download of all event data
- "Import Event" → JSON upload to create new event
- "Export All Events" → JSON download of entire database
- "Clear Current Event Data" → deletes all bidders/lots/sales/invoices for current event (with triple-confirm)

**C. About**
- App version
- "Auction Manager PWA" branding
- Storage usage (approximate IndexedDB size)
- PWA install status / install button if not installed

---

## PWA Configuration

### `public/manifest.json`

```json
{
  "name": "Auction Manager",
  "short_name": "AuctionMgr",
  "description": "Offline-first live auction clerking tool for fundraising organizations",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e3a5f",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Service Worker Requirements

- Cache ALL static assets on install (HTML, JS, CSS, icons, fonts)
- Use "cache-first" strategy for all assets
- The app must load and function with zero network connectivity
- On subsequent visits with connectivity, update cached assets in the background
- No runtime API calls — everything is local

### `next.config.js` Key Settings

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  output: 'export',          // Static site generation — no server required
  trailingSlash: true,       // Required for static export routing
  images: {
    unoptimized: true,       // No image optimization server needed
  },
});
```

---

## PDF Invoice Template (jsPDF)

Each invoice PDF should contain:

```
┌──────────────────────────────────────────────────┐
│  {Organization Name}                             │
│  INVOICE                                         │
│                                                  │
│  Invoice #: {invoiceNumber}                      │
│  Date: {generatedAt}                             │
│  Event: {eventName}                              │
│                                                  │
│  Bill To:                                        │
│  {bidderFirstName} {bidderLastName}              │
│  Paddle #{paddleNumber}                          │
│  {phone}  {email}                                │
│                                                  │
│  ┌────────┬──────────────────┬─────┬───────────┐ │
│  │ Lot #  │ Description      │ Qty │ Amount    │ │
│  ├────────┼──────────────────┼─────┼───────────┤ │
│  │ 0001   │ Signed Baseball  │  1  │  $150.00  │ │
│  │ 0014   │ Weekend Getaway  │  1  │  $500.00  │ │
│  │ 0027B  │ Wine Collection  │  6  │  $225.00  │ │
│  ├────────┼──────────────────┼─────┼───────────┤ │
│  │        │                  │     │           │ │
│  │        │ Subtotal         │     │  $875.00  │ │
│  │        │ Tax (8.75%)      │     │   $76.56  │ │
│  │        │ TOTAL            │     │  $951.56  │ │
│  └────────┴──────────────────┴─────┴───────────┘ │
│                                                  │
│  Payment Status: {UNPAID / PAID}                 │
│  Payment Method: {if paid}                       │
│                                                  │
│  Thank you for supporting {orgName}!             │
└──────────────────────────────────────────────────┘
```

---

## Data Export/Import Format

The JSON export for an event should follow this structure:

```json
{
  "exportVersion": 1,
  "exportDate": "2025-01-15T10:30:00Z",
  "appVersion": "2.0.0",
  "event": {
    "name": "Spring Gala 2025",
    "description": "Annual fundraiser",
    "organizationName": "Local School Foundation",
    "taxRate": 0.0875,
    "currencySymbol": "$",
    "createdAt": "2025-01-10T08:00:00Z"
  },
  "bidders": [ ... ],
  "lots": [ ... ],
  "sales": [ ... ],
  "invoices": [ ... ]
}
```

On import:
1. Validate JSON structure and version
2. Create a new event (do NOT overwrite existing events)
3. Insert all records with new auto-generated IDs
4. Remap all foreign key references (bidder IDs, lot IDs) to new IDs
5. Show import summary: counts of records imported

---

## Design & UX Guidelines

### Visual Style
- Clean, professional, minimal — think "financial software"
- Primary color: deep navy (#1e3a5f)
- Accent color: amber/gold (#d4a843) — evokes the auction world
- Background: white (#ffffff) main, light gray (#f5f5f5) for sidebar/cards
- Text: near-black (#1a1a1a) body, gray (#6b7280) secondary
- Success: green (#16a34a), Error: red (#dc2626), Warning: amber (#f59e0b)

### Typography
- Use system font stack — no external fonts (offline requirement):
  ```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  ```
- Monospace for numbers, paddle numbers, lot numbers, amounts:
  ```css
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  ```

### Layout
- Fixed sidebar navigation (collapsible on mobile)
- Current event always visible in sidebar header
- Responsive: works on desktop (primary), tablet, and mobile
- Minimum supported width: 768px (can be used on tablet in landscape)

### Interaction Patterns
- All destructive actions require confirmation dialog
- Success/error toasts for all CRUD operations (auto-dismiss after 3 seconds)
- Form validation shows inline errors below fields
- Loading states are NOT needed for database operations (IndexedDB is synchronous from the user's perspective)
- Focus management: after form submit, focus returns to first field

### Accessibility
- All form inputs must have labels
- Keyboard navigable throughout
- Sufficient color contrast (WCAG AA)
- Focus visible indicators

---

## Implementation Priorities

Build in this order:

### Phase 1 — Foundation
1. Next.js project setup with TypeScript, Tailwind, static export
2. PWA configuration (manifest, service worker, icons)
3. Dexie database definition (`lib/db.ts`)
4. Root layout with sidebar navigation
5. Event management page (create, switch, edit, delete)
6. App settings singleton (current event tracking)

### Phase 2 — Core Clerking Workflow
7. Bidder registration page (add, edit, search, list)
8. Clerking page — sale entry form + recent sales feed
9. Lot management (auto-created during clerking, or pre-populated)

### Phase 3 — Invoicing & Payments
10. Invoice generation logic
11. Invoice list page with status filtering
12. Payment recording modal
13. PDF invoice generation (jsPDF)
14. Bulk invoice generation and printing

### Phase 4 — Reporting & Export
15. Summary statistics dashboard
16. Bidder totals report with CSV export
17. Lot results report with CSV export
18. Payment method summary

### Phase 5 — Data Portability & Polish
19. Event data export (JSON)
20. Event data import (JSON) with ID remapping
21. Full database export/import
22. Offline testing and verification
23. PWA install prompt handling
24. Final UI polish and responsive design pass

---

## Testing Requirements

### Unit Tests
- All Dexie database operations (CRUD for each table)
- Invoice calculation logic (subtotal, tax, total)
- Auto-increment logic (paddle numbers, lot numbers)
- **Pass-out lot suffix sequencing** (A→B→...→Z→AA→AB)
- **nextSuffix() utility**: empty→A, A→B, Z→AA, AZ→BA, ZZ→AAA
- **displayLotNumber formatting**: baseLotNumber + suffix → zero-padded string
- CSV export formatting
- Data import/export with ID remapping
- Input validation functions

### Integration Tests
- Complete sale recording workflow (create lot + create sale + update lot status)
- **Pass-out workflow**: clerk base lot in pass-out mode → verify suffix A lot created → clerk again → verify suffix B → exit pass-out mode → verify lot number increments to next base
- **Keyboard shortcut integration**: Shift+Enter activates pass-out, Enter respects checkbox state, Escape cancels
- **Pass-out data isolation**: voiding a pass-out sub-lot does NOT affect sibling pass-outs or the base lot
- Invoice generation from sales data (including pass-out lots grouped under one bidder)
- Event switching clears all displayed data
- Data isolation: records from Event A never appear in Event B

### Manual Testing Checklist
- [ ] Install PWA on Chrome (Windows)
- [ ] Install PWA on Chrome (Mac)
- [ ] Install PWA on Edge (Windows)
- [ ] Disconnect from internet, verify full functionality
- [ ] Record 50+ sales in rapid succession — no lag
- [ ] **Pass-out lots:** Clerk 5 pass-outs of the same lot, verify suffixes A-E
- [ ] **Pass-out keyboard:** Use Shift+Enter to enter pass-out mode, plain Enter to continue, uncheck+Enter to exit
- [ ] **Pass-out void:** Void a middle pass-out lot (e.g., 0001C), verify 0001A and 0001B unaffected
- [ ] **Pass-out invoicing:** Bidder wins base lot + 2 pass-out lots, all 3 appear on invoice
- [ ] Generate invoices for 100+ bidders
- [ ] Export event, delete event, re-import event
- [ ] Verify PDF invoices render correctly (including pass-out lot numbers)

---

## Key Differences from Original Python App

| Feature | V2 Python (Original) | V2 PWA (This Build) |
|---|---|---|
| Runtime | Python + Flask | Browser (Next.js static) |
| Database | SQLite file | IndexedDB (Dexie.js) |
| Distribution | PyInstaller executable | PWA via URL |
| PDF Generation | ReportLab (Python) | jsPDF (JavaScript) |
| Cross-platform | Separate builds per OS | One build, all platforms |
| Updates | Manual download | Automatic via service worker |
| Data backup | Copy .db file | JSON export/import |
| Offline support | Native (desktop app) | Service worker + local storage |

---

## Notes for Cursor

- Do NOT use `localStorage` or `sessionStorage` for data — use Dexie.js (IndexedDB) exclusively.
- Do NOT import any fonts from Google Fonts or any CDN. System fonts only.
- Do NOT add any `fetch()` calls to external APIs. This app is 100% local.
- Do NOT use Next.js API routes (`app/api/`). There is no server. Use `output: 'export'` for static generation.
- All Tailwind classes should use the project's color palette defined in `tailwind.config.ts`.
- Use `useLiveQuery` from Dexie for reactive data in components — this replaces the need for Redux or Zustand.
- Clerk initials should persist in `sessionStorage` (acceptable since it's ephemeral UX state, not application data).
- All currency formatting should respect the event's `currencySymbol` setting.
- All monetary values stored as numbers (not strings). Format only at display time.
- **Pass Out Lots:** The `displayLotNumber` must be computed and written at insert time (not derived at read time). This ensures it is indexable and searchable.
- **Pass Out Lots:** The checkbox and Shift+Enter are two entry points to the same mode. The checkbox is always the source of truth — Shift+Enter simply sets the checkbox to checked.
- **Pass Out Lots:** When generating the `nextSuffix`, query the database for existing lots with the same `baseLotNumber` in the current event to determine the correct next suffix — do not rely on in-memory state alone, in case of page refresh mid-sequence.
- **Lot numbers** should be zero-padded to 4 digits for display (e.g., "0001", "0042") but stored as integers in `baseLotNumber`.
