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
php artisan migrate --seed
composer dev
```

Open http://localhost:8000 and log in as `juan@gmail.com` or account number
`80369` (HnF), or as `admin@test.com` on http://localhost:8000/admin/login
(super admin), all with the password `password`. The seeder adds these
sample accounts and the Oroza Enterprise (150551), HnF (80369) and
Foodsecrets (60291) companies; change the passwords before the app is
reachable from the internet.

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

## Companies and accounts

The app serves several companies of the Oroza Group. Each company's users
see only that company's sales, imports and reports, under its own logo.
Data imported before companies existed belongs to **Oroza Enterprise**.

Each company has an **account number**: its SM Vendor Portal number (e.g.
150551 for Oroza Enterprise). Accountants log in on `/login` with their
account number or email and their password. The account number works only
while the company has a single user; with several, each uses their email.
A company can only import DSRs and DSR Summaries for its own vendor number.

Public sign-up is disabled. A **super admin** logs in on `/admin/login` and
manages accounts under **Companies**: add a company (name, account number
and optional logo), open it, and add its users. Super admins only manage
companies and users; they do not see company data.

Accounts can also be created from the server. The command asks for the
password, so it isn't saved in shell history:

```bash
php artisan user:create --name="Jane Doe" --email=jane@example.com --company=hnf
php artisan user:create --name="Admin" --email=admin@example.com --super-admin
```

Users can change their password and turn on two-factor authentication under
**Settings**.

## Workflows

The PO & SI workflow and RA item matching are for Oroza Enterprise only: a
company sees them when its `workbook_tools` flag is on (set for SM vendor
150551 by the migration and the seeder). Both tools process workbooks **in the browser**; uploaded files are never sent
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

The sidebar's **Sales** menu has **Overview** (the sales report, also the home
page after login), **Liquidation**, **Import** and **Product costs**. Under
them, **Last DSR** shows the newest imported sales day: green when up to date,
amber when DSRs are missing. **Import DSR** is also a button on the sales
report and the Liquidation page; it opens the same import in a dialog, and
the page refreshes with the new data.

### Import DSR

1. In the SM Vendor Portal, open **Finance Documents → Daily Sales Report**,
   filter the dates you need, select the reports, and click **Export
   Document** (the file is usually named `DSR_DETAIL.xlsx`). **Export List**
   (`DSR_LIST.xlsx`) only has totals per store, so the app rejects it.
2. In the app, go to **Sales → Import** (or click **Import DSR** on the
   report) and choose the file. The app recognises the kind of export (DSR,
   DSR Summary, CSR or CLR) and checks that its rows add up to the file's
   Grand Total.
3. **Review** what the file contains (dates or periods, stores, totals and
   any warnings), then click **Import**. **Done** links to the report or the
   Liquidation page.

Re-importing the same store and date replaces it, so importing overlapping
files or revised DSRs never counts sales twice. Large files (many months) are
saved in parts automatically. If an import stops halfway, importing the same
file again is safe. Every import is listed with who imported it and when.

### Sales report

**Sales → Overview** opens on the month of the latest imported sales. The
date, filter and export bar stays at the top while scrolling. Under the totals
and the sales trend, the report is split into tabs: **Overview** (highlights,
top 10 items, share charts), **Items**, **Stores** and **Data check**
(completeness and the month-end check; a dot on the tab means something needs
attention). The PDF and printouts still include every section.

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
- **View PDF** opens an A4 management report in a new tab (pie charts only):
    1. **Executive summary** (page 1): eight KPI tiles with the change vs the
       previous period (net sales, units, average daily sales, price per unit,
       stores, sales per store, products, data status), key takeaways, and
       sales by company and weekdays vs weekends.
    2. **Store performance**: store share, reliance on the top stores, a store
       scorecard and company totals.
    3. **Product performance**: revenue and volume mix, top 10 products,
       growth opportunities (best sellers missing from some stores, with an
       estimated upside) and slow movers.
    4. **Appendix**: every product, data quality checks and source notes.

    Download or forward it from the viewer.
    **Print** opens the same PDF with the print dialog, so every printout looks
    the same. The PDF is built in the browser; amounts are shown as "PHP"
    because PDF fonts lack the peso sign.

- **Excel** offers two downloads:
    - **Sales status report**: the accountants' "Sales Status Report"
      workbook (same layout, colours and formulas as the H&F and AUTOMAT
      files), filled from the DSRs: each item's quantity and sales per day
      and per store, a Total row, blank signature lines, and a **YEARLY
      REPORT** sheet with the year by month. Periods over three months are
      shown by month.
    - **ModCon report**: the ModCon workbook (same layout as MODCON SALES
      REPORT.xlsx) for the period's year: one sheet per store chain (SSM,
      SVI, SMCO) with each item's sales and quantity per half-month (1st–15th
      and 16th–end, by transaction date), the year's amount, 12% VAT, total
      and quantity, and empty S.I./R.A. rows to fill in; a **TOTAL PER
      COMPANY** sheet adding the chains up with formulas; and, for a monthly
      report, the month's sheet first.
    - **Data for analysis**: every report section as a plain sheet.
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
(the file is usually named `DSRS_DETAIL.xlsx`). Import it on **Sales → Import** like a DSR; the app recognises it. The Summary never adds to sales; it
is only used for the month-end check and completeness. Re-importing it
replaces SM's figures, so import it again whenever SM revises a month.

### Monthly routine

1. Keep the month filled: import each day's DSR (portal: **Post Date** =
   today), or import a whole month at once (portal: **Transaction Date** =
   the month).
2. After the month ends, import SM's **DSR Summary** for that month.
   Each half-month, import the **CLR** and **CSR**, check the Liquidation
   page's DSR check, and record SM's payments as they arrive.
3. Open **Overview → Month**, check **Data completeness** shows no red
   days and the **Month-end check** says the month matches, then use
   **Excel**, **View PDF** or **Print** to share it.

### Liquidation (what SM owes you)

SM settles each half-month (1st–15th, 16th–end) per chain head office
("countering center": SVI, SSM, SMCo). From the vendor portal, export:

- **Consolidated Liquidation Report** (`CLR_DETAIL.xlsx`): per head office and
  period, each store's sales, 12% VAT, the amount payable, 1% expanded
  withholding tax (EWT) and the **net amount due**.
- **Consolidated Sales Report** (`CSR_DETAIL.xlsx`): SM's sales per store and
  item for the period.

Import both on **Sales → Import**. Importing a period again replaces SM's
figures and keeps the payments recorded for it. **Sales → Liquidation** then
shows, per year:

- Totals: net amount due, received, still to receive, and the DSR check.
- Charts: half-month settlements (received vs still to receive), net amount
  due share by chain, and liquidated sales share by store.
- One row per period and head office: sales, EWT, net due, **DSR check**
  (✓ when your imported DSRs for those stores and days add up to SM's figure,
  within ₱1; the difference otherwise; "No DSRs yet" when none are imported),
  received and status (**Unpaid**, **Short**, **Paid**, **Overpaid**).
- Click a row for each store against your DSRs (with the days that have no
  DSR), **Compare items** (with the CSR imported: SM's quantity and sales per
  item against the DSRs, differences highlighted), and the payments.
- **Record payment** saves an amount received, its date and the check or
  reference number from SM's Remittance Advice. Several payments can be
  recorded for one period; a wrong one can be removed.
- **Withholding tax by month**: EWT per chain and month, to check SM's BIR
  Form 2307 certificates.
- **Excel**: the year's liquidations, stores against DSRs, and EWT by month,
  with totals.

### Gross profit

The DSR has no costs, so each company enters its own on **Sales → Product
costs**: a cost per unit and the date it starts. Each sale uses the cost in
effect on its date, so a new cost leaves earlier months unchanged. The page
shows how many items have a cost and what share of the last 60 days' sales
they cover, lists items without a cost first (biggest sellers on top), and
shows margins under 15% in red. Type a cost straight into the table (it
starts on the date chosen above the table) or use the history button for
earlier costs and dates. To set many
at once, use **Import cost sheet** with any Excel file that has an "ARTICLE
CODE" column (e.g. H&F's "cost finished product" sheet): the "FG" column is
picked as the cost when there is one, and you choose the start date. Once costs
exist, the sales report shows gross profit and margin (summary card, item and
store tables, and the "Data for analysis" Excel). Sales of items without a cost
are left out of gross profit; the card says what share of sales has a cost.

The DSR has no categories, stock or time of sale, so category, inventory and
hourly reports are not possible from it.

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
