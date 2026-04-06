## Getting started

ClerkBid runs in your browser and stores auction data on **this device** (IndexedDB) for your signed-in account. Pick an **event** in the sidebar to work with bidders, lots, clerking, invoices, and reports. Switch events anytime; each event has its own catalog and sales.

If you use **cloud backup/sync** (optional, from [Settings](/settings/)), event snapshots are stored on the server **for your whole organization**—everyone who signs in under the same vendor shares the same cloud copies, so clerk and cashier can use different logins and devices. Invoice **logo images** and some branding fields stay **local only** and are not included in JSON export.

**Organization & team** (Settings): an **admin** can send an invitation to a teammate’s email (clerk or cashier role). They receive a sign-up link by email when your site has **Resend** configured (same as password reset); you can also copy the link from Settings if email is not available. Invited people complete sign-up on the join page; they do not create a separate organization.

**Offline and multiple devices:** while offline, each device keeps its own copy; changes are not visible to teammates until you reconnect and sync. If two devices both change data offline, you may need **Restore from cloud** or **Overwrite cloud copy** in Settings after reconnect. At a venue with poor connectivity, a **phone hotspot** or local Wi‑Fi with internet often works better than expecting devices to sync without any shared network path to the server.

## Recent updates

Changes since the last major refresh of this Help page:

- **Invoices — detail view** — The invoice detail dialog is wider so line items, descriptions, and line totals are easier to read without horizontal scrolling.
- **Invoices — mark as unpaid** — If you marked an invoice paid by mistake, open its detail from [Invoices](/invoices/) and use **Mark as unpaid** (with confirmation). That clears payment method and date and sets the invoice back to unpaid so you can record payment again. Totals and lines on the invoice are unchanged.
- **Reports — buyer’s premium** — The event summary includes **Buyer’s premium (invoiced)**. The **bidder totals** table and its CSV export include a buyer’s premium column; figures follow invoice totals when invoices exist, and otherwise follow the same basis as invoice generation from your event rates.
- **Invoices — correct or remove hammer lines** — On **unpaid** invoices, each clerking line can be **Correct** (edit description, quantity, hammer, paddle/bidder, consignor, initials) or **Remove from invoice** (sale stays on file unallocated; regenerate invoices to attach it again). **Paid** invoices cannot be edited this way—use **Mark as unpaid** first if you must fix totals, then correct and mark paid again.
- **Consignors — mailing address** — Optional **mailing address** on each consignor (and in CSV import) for checks or mail; it appears on **statement PDFs** when filled in.
- **Clerking — edit recent sales** — In **Recent sales**, expand a row and use **Edit sale** to open the same correction form used in invoice detail. This works for unallocated lines too; if the line is already on a paid invoice, mark that invoice unpaid first before editing.

## Events

On [Events](/events/) you can **create** and **edit** events, **switch** the active event, **export** a single event as JSON for backup, and **import** an event from JSON. Export/import is useful for moving data between devices or keeping an offline copy.

Deleting an event removes its bidders, consignors, lots, sales, and invoices for good.

## Bidders

[Bidders](/bidders/) lists everyone registered for the current event with a **paddle number**. You can add bidders manually, **import a CSV** (use the template for column names), or edit existing rows. You cannot delete a bidder who already has recorded sales.

## Consignors and commission

[Consignors](/consignors/) holds a **registry** (consignor number, name, contact, optional **mailing address** for sending checks or mail, optional **commission override**). **Default commission** for the event is set under [Settings](/settings/) (current event). If a consignor has no override, the event default applies; if they do, that percentage is used for their lines on **statements** and **commission reports**.

You can import consignors from CSV (optional `mailingAddress` column, or `address`), add them manually, open a **statement PDF** per consignor (mailing address prints under the name when present), and use [Reports](/reports/) for totals and CSV export. Sales can be **linked** to a registered consignor from the clerking screen; free-text labels still work for display and matching when no link is set.

## Clerking

[Clerking](/clerking/) is where you **record sales**: lot number, hammer price, paddle, quantity, description, optional notes and consignor, and clerk initials. **Enter** submits; **Shift+Enter** with pass-out enabled creates suffix lines (e.g. 12A, 12B). **Esc** clears the form.

After a sale, a short **undo** window may appear—use it immediately if you need to reverse the last action. Open **Field order (tab sequence) and requirements** on the clerking page to change **Tab** order and which fields must be filled before a sale is accepted. **Lot number** and **description** cannot both be optional (one must stay required for invoicing and reporting); unchecking one turns the other on automatically. If lot number is optional and left blank, the app uses the **suggested next lot** when you submit (you still need a description in that case). **Paddle number** is always required to record a sale. **Pass lot (no sale)** always needs a valid catalog lot number; clerk initials follow your initials requirement setting.

**Recent sales** (below the entry form) lists the latest lines for this event. Expand a row to **Edit sale** (same correction form as on an unpaid invoice: description, quantity, hammer, paddle, consignor, initials) or **Void sale** (removes the sale and marks the lot unsold). Sales not yet on an invoice can still be edited here; if a line is already on a **paid** invoice, mark that invoice unpaid first before editing.

## Invoices

[Invoices](/invoices/) are built **per bidder** for the current event. A bidder can have **several invoice numbers** over time: new sales after an invoice is **paid** are gathered into a **new** unpaid invoice the next time you generate. **Unpaid** invoices are updated when you generate so they include any sales not yet on an invoice. Each **PDF** only includes lines for **that** invoice. For **unpaid** invoices you can optionally override **buyer’s premium** and **tax rates** (otherwise the event defaults from Settings apply), and add **manual lines**—positive amounts for extra charges or unrecorded purchases, negative for discounts or credits. Those lines are calculated **after** buyer’s premium and **before** tax. **Paid** invoices stay fixed; you cannot change their rates or manual lines afterward.

Click a row to open **invoice detail**: a wider layout shows the full line-item table. From there you can print the PDF, **Mark as paid** (unpaid invoices), or **Mark as unpaid** (paid invoices) if you need to reverse a mistaken payment—after confirming, payment method and date are cleared and you can mark paid again.

For **unpaid** invoices only, each **hammer** line (from clerking) has **Correct** and **Remove**. **Correct** opens a form to fix description, quantity, unit hammer, paddle (and thus winning bidder), consignor fields, and clerk initials; totals and PDF update after save. Changing paddle moves the sale to that bidder’s open unpaid invoice the next time invoices are generated or refreshed for them. **Remove** takes the line off this invoice but **does not delete** the underlying sale—it becomes unallocated until you run **Generate / refresh invoices** for the relevant bidder(s). **Paid** invoices do not offer these actions; mark unpaid first if you must adjust hammer lines.

## Reports

[Reports](/reports/) summarizes the event: revenue, lot status, bidder totals, payment methods, **consignor commission** summaries, and exports. The summary includes **buyer’s premium (invoiced)** alongside hammer and tax. **Bidder totals** list hammer, buyer’s premium, tax, and total per bidder (aligned with invoices when they exist). You can download **accounting CSV**, **run list** and **bidder list** PDFs, consignor-related CSV where available, and a **bidder totals CSV** that includes the buyer’s premium column.

## Settings backups and data

[Settings](/settings/) covers **organization name**, **tax rate**, **buyer’s premium**, **currency symbol**, and **default consignor commission** for the **current event**. You can also set **invoice footer** and **event logo** overrides (stored on this device).

The same page includes **JSON backup** (current event or all events), optional **cloud sync**, **clear event data** (keeps the event shell), and app information. Use backups regularly before major changes.

## Invoice appearance

Under Settings, **Invoice appearance** (account-wide) lets you upload a **default logo** and default **thank-you line** for PDF invoices (you can use `{org}` as a placeholder for the organization name). **Per-event** overrides (logo and footer) apply only to that event and override the account defaults. These assets are **not** included in cloud/JSON export.

## Feedback

If something is confusing, broken, or missing, we want to hear it. Use **[Feedback](/feedback/)** (also linked in the sidebar and app footer) to send questions, bug reports, and **requests for changes or new features**. The AuctionMethod team reads every submission and uses it to improve ClerkBid.

## Open source

ClerkBid is published under the **MIT License**, so anyone may use, modify, and redistribute it for commercial or personal projects, subject to the license terms. The full source code is available on **[GitHub](https://github.com/curiousdaniel/clerkbid)**.
