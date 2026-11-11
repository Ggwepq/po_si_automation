# Sales Management System

Internal sales management system for the team. It currently automates PO/GR
and RA/ICR spreadsheet work; a sales dashboard fed by the SM Vendor Portal's
Daily Sales Report is next. Laravel 13 + React 19 (Inertia, TypeScript) on
MySQL.

Contributor and AI-agent rules: [AGENTS.md](AGENTS.md).

## Local setup (Windows)

Requirements: [Laravel Herd](https://herd.laravel.com/windows) (PHP 8.4+,
Composer), Node.js 22+, and MySQL/MariaDB (XAMPP's MySQL works).

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Create an empty database named `sales_management` (utf8mb4), set the `DB_*` values in
`.env`, then:

```bash
php artisan migrate
php artisan user:create
composer dev
```

Open http://localhost:8000 and log in with the account you created.

> Run PHP commands from PowerShell, which uses Herd's PHP. Git Bash may find
> XAMPP's older PHP first.

## Checks

```bash
composer ci:check
```

Runs formatting, linting, type checks (TypeScript and PHPStan), frontend tests
(Vitest) and backend tests (Pest). CI runs the same command on every push to
`dev` and `master` and on pull requests.

Branches: `dev` is where development happens; `master` holds released code
and is updated by merging `dev`. See [AGENTS.md](AGENTS.md#git).

## Accounts

Public sign-up is disabled. Create each person's account from the server:

```bash
php artisan user:create --name="Jane Doe" --email=jane@example.com
```

The command asks for the password, so it isn't saved in shell history. Users
can turn on two-factor authentication under **Settings → Security**.

## Workflows

Both tools process workbooks **in the browser**; uploaded files are never sent
to the server. Uploads stay available while you move between pages and are
cleared by **Start over** or a page reload.

### PO & SI workflow

- Upload PO details and GR details (.xlsx, up to 25 MB each). The first
  worksheet with a **PO No.** header in its first 30 rows is selected;
  **Workbook settings** lets you change the sheet and PO column.
- PO numbers match as exact text after trimming. Prefixes and leading zeros
  matter. Any PO number found in GR marks all of that PO's item rows
  **Delivered**; quantities and partial deliveries are not checked. Blank PO
  numbers are **Needs review**.
- Export includes every PO item row and column plus Delivery Status, Matched GR
  PO No. and Matched Receipt No., regardless of filters. Values are kept as
  displayed text.
- Sales invoice generation and the Outright exports are disabled until the
  invoice format, invoice data and GR No. mapping are confirmed. Receipt No. is
  not assumed to be the portal's GR No.

### RA item matching

- Upload RA_DETAIL and an ICR workbook (.xlsx, up to 100 MB each), pick the RA
  worksheet, and select one or more ICR months. Months are never selected
  automatically.
- Headers are found in the first 30 rows. RA needs **Document Reference**;
  ITEM is used if present or appended if absent. ICR needs **SI No.** (also
  `S.I. #`, `SI Number`, `Sales Invoice No.`) and **CODE**.
- References match exact text after trimming. Selected months are searched
  first; if an SI is not there, the rest of the ICR workbook is searched and
  the match is labelled as found outside the selected months. A selected-month
  match always wins.
- Conflicting codes, blank codes and blank references are **Needs review** and
  keep their current ITEM. Matched rows get the ICR CODE.
- Export follows the active filter and search, across all pages. It patches
  the original file, so fonts, fills, borders, number formats, widths, heights,
  merged cells, page setup and other sheets are preserved. When rows are
  filtered out, the remaining rows move up and formulas, ranges, tables and
  charts are adjusted.

## Sales

### Import DSR

1. In the SM Vendor Portal, open **Finance Documents → Daily Sales Report**,
   filter the dates you need, select the reports, and click **Export
   Document** (the file is usually named `DSR_DETAIL.xlsx`). **Export List**
   (`DSR_LIST.xlsx`) only has totals per store, so the app rejects it.
2. In the app, go to **Sales → Import DSR** and choose the file. The app checks
   that the item lines add up to the file's Grand Total and warns if not.
3. Check the preview (dates, stores, item lines, total sales), then click
   **Import**.

Re-importing the same store and date replaces it, so importing overlapping
files or revised DSRs never counts sales twice. Large files (many months) are
saved in parts automatically. If an import stops halfway, importing the same
file again is safe. Every import is listed with who imported it and when.

### Sales report

**Sales → Sales report** opens on the month of the latest imported sales.

- **Dates:** click the date button for quick choices (Latest sales day, Today,
  Yesterday, Last 7/30 days, This/Last week, This/Last month, This quarter,
  This/Last year), or pick on the calendar by Day, Week, Month, Quarter, Year
  or a Range (up to three years). Days with imported sales show a dot. The
  arrows step to the previous or next period.
- **Filters:** Company and Store, each allowing several choices with search;
  the store list follows the chosen companies. Vendor appears automatically
  once DSRs from more than one vendor are imported. **Reset filters** clears
  them.
- The page address keeps every choice, so a view can be bookmarked or sent as
  a link.
- **Contents:**
    - Totals with % change against the previous period: sales (excl. VAT),
      quantity sold, items sold, stores reporting, average daily sales.
    - Pie charts: sales share by store, by company and by item.
    - Daily (or monthly, for long periods) sales trend.
    - Top 10 selling items, by quantity or by sales.
    - Every item ranked with quantity, sales, share, average price and number
      of stores.
    - Sales by store with each store's best seller, and slow movers when there
      are more than 20 items.
- **Executive highlights** at the top: plain-language takeaways for management
  (sales vs the previous period, best and lowest store, best-selling item,
  leading company, how concentrated sales are, and a warning when days are
  missing).
- **View PDF** opens an A4 report in a new tab: logo, highlights, key figures
  vs the previous period, charts, top 10 items, and full item, store and
  company tables, with page numbers. Download or forward it from the viewer.
  **Print** opens the same PDF with the print dialog, so every printout looks
  the same. The PDF is built in the browser; amounts are shown as "PHP"
  because PDF fonts lack the peso sign.
- **Excel** downloads every section as a separate sheet for further analysis.
- **Data completeness** (on screen only, not printed): a store × day grid of
  which DSRs are imported for the period, checked up to yesterday because SM
  posts each day's DSR the next day. Days with no DSR from _any_ store are
  listed in red with an Import DSR button; these are almost always missed
  imports. Once SM's DSR Summary is imported, a store with 0.00 (or no row)
  in the Summary for a day is shown grey as "No sales", so only real gaps stay
  red. Periods longer than three months show per-month counts instead of days.
- **Month-end check** (on screen; issues also in the PDF): compares SM's
  **DSR Summary** (its official total per store and day) with the imported
  DSRs. Each store-day is a Match, No sales (0.00), Differs (with the
  amount), DSR not imported, or Not in Summary, and the highlights say
  whether the month balances.

### DSR Summary (month-end check)

In the vendor portal, open **DSR Summary**, choose the month and export it
(the file is usually named `DSRS_DETAIL.xlsx`). Import it on **Sales → Import
DSR** like a DSR; the app recognises it. The Summary never adds to sales; it
is only used for the month-end check and completeness. Re-importing it
replaces SM's figures, so import it again whenever SM revises a month.

### Monthly routine

1. Keep the month filled: import each day's DSR (portal: **Post Date** =
   today), or import a whole month at once (portal: **Transaction Date** =
   the month).
2. After the month ends, import SM's **DSR Summary** for that month.
3. Open **Sales report → Month**, check **Data completeness** shows no red
   days and the **Month-end check** says the month matches, then use
   **Excel**, **View PDF** or **Print** to share it.

The DSR has no cost prices, categories, stock or time of sale, so profit,
category, inventory and hourly reports are not possible from it.

## Project layout

```
app/                      Laravel backend (see AGENTS.md for layering rules)
app/Domains/Sales/        DSR import and sales report (models, actions, data)
resources/js/pages/       Inertia pages (thin)
resources/js/features/    po-matching, ra-matching, sales: components, logic, tests
resources/js/components/  shared UI (ui/ = shadcn primitives)
tests/                    Pest backend tests
```

## Deployment (Hostinger)

Production runs on Hostinger Business with PHP 8.4+ and MySQL. Deployment
setup is part of the next phase; the outline is:

1. In hPanel, set the site's PHP version to 8.4 or newer and create a MySQL
   database and user.
2. Point the domain's document root at `public/`.
3. Deploy the code (Git deploy or CI over SSH), then on the server:
   `composer install --no-dev --optimize-autoloader`,
   `php artisan migrate --force`, and `php artisan optimize`.
4. Build assets before upload (`npm run build`); the server only serves
   `public/build`.
5. Production `.env`: `APP_ENV=production`, `APP_DEBUG=false`, HTTPS
   `APP_URL`, `APP_TIMEZONE=Asia/Manila` (report periods follow it), and real
   mail settings for password resets. PHP needs the `bcmath` extension.
6. Add a cron job: `* * * * * php /path/to/artisan schedule:run`.
