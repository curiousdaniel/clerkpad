## Getting started

ClerkBid runs in your browser and stores auction data on **this device** (IndexedDB) for your signed-in account. Pick an **event** in the sidebar to work with bidders, lots, clerking, invoices, and reports. Switch events anytime; each event has its own catalog and sales.

If you use **cloud backup/sync** (optional, from [Settings](/settings/)), event data can be pushed to your account on the server. Invoice **logo images** and some branding fields stay **local only** and are not included in JSON export.

## Events

On [Events](/events/) you can **create** and **edit** events, **switch** the active event, **export** a single event as JSON for backup, and **import** an event from JSON. Export/import is useful for moving data between devices or keeping an offline copy.

Deleting an event removes its bidders, consignors, lots, sales, and invoices for good.

## Bidders

[Bidders](/bidders/) lists everyone registered for the current event with a **paddle number**. You can add bidders manually, **import a CSV** (use the template for column names), or edit existing rows. You cannot delete a bidder who already has recorded sales.

## Consignors and commission

[Consignors](/consignors/) holds a **registry** (consignor number, name, contact, optional **commission override**). **Default commission** for the event is set under [Settings](/settings/) (current event). If a consignor has no override, the event default applies; if they do, that percentage is used for their lines on **statements** and **commission reports**.

You can import consignors from CSV, add them manually, open a **statement PDF** per consignor, and use [Reports](/reports/) for totals and CSV export. Sales can be **linked** to a registered consignor from the clerking screen; free-text labels still work for display and matching when no link is set.

## Clerking

[Clerking](/clerking/) is where you **record sales**: lot number, hammer price, paddle, quantity, description, optional notes and consignor, and clerk initials. **Enter** submits; **Shift+Enter** with pass-out enabled creates suffix lines (e.g. 12A, 12B). **Esc** clears the form.

After a sale, a short **undo** window may appear—use it immediately if you need to reverse the last action. Configure **tab order** for the sale fields from the clerking page if your workflow differs.

## Invoices

[Invoices](/invoices/) are built **per bidder** for the current event. You can **generate** invoices from recorded sales, open **PDFs** for printing, and mark **paid** or **unpaid** with payment method and date. Buyer’s premium and tax follow the rates set for the event in Settings.

## Reports

[Reports](/reports/) summarizes the event: revenue, lot status, bidder totals, payment methods, **consignor commission** summaries, and exports. You can download **accounting CSV**, **run list** and **bidder list** PDFs, and consignor-related CSV where available.

## Settings backups and data

[Settings](/settings/) covers **organization name**, **tax rate**, **buyer’s premium**, **currency symbol**, and **default consignor commission** for the **current event**. You can also set **invoice footer** and **event logo** overrides (stored on this device).

The same page includes **JSON backup** (current event or all events), optional **cloud sync**, **clear event data** (keeps the event shell), and app information. Use backups regularly before major changes.

## Invoice appearance

Under Settings, **Invoice appearance** (account-wide) lets you upload a **default logo** and default **thank-you line** for PDF invoices (you can use `{org}` as a placeholder for the organization name). **Per-event** overrides (logo and footer) apply only to that event and override the account defaults. These assets are **not** included in cloud/JSON export.

## Feedback

If something is confusing, broken, or missing, we want to hear it. Use **[Feedback](/feedback/)** (also linked in the sidebar and app footer) to send questions, bug reports, and **requests for changes or new features**. The AuctionMethod team reads every submission and uses it to improve ClerkBid.

## Open source

ClerkBid is published under the **MIT License**, so anyone may use, modify, and redistribute it for commercial or personal projects, subject to the license terms. The full source code is available on **[GitHub](https://github.com/curiousdaniel/clerkbid)**.
