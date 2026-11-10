# PAUS Workflow

Internal web app for automating PO/GR and RA/ICR spreadsheet work, built to
grow into a sales management system. Laravel 13 + React 19 (Inertia,
TypeScript) on MySQL.

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

Create an empty database named `paus_db` (utf8mb4), set the `DB_*` values in
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
`master` and on pull requests.

## Accounts

Public sign-up is disabled. Create each person's account from the server:

```bash
php artisan user:create --name="Jane Doe" --email=jane@example.com
```

The command asks for the password, so it isn't saved in shell history. Users
can turn on two-factor authentication or passkeys under **Settings → Security**.

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

## Project layout

```
app/                      Laravel backend (see AGENTS.md for layering rules)
resources/js/pages/       Inertia pages (thin)
resources/js/features/    po-matching, ra-matching: components, logic, tests
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
   `APP_URL`, real mail settings for password resets.
6. Add a cron job: `* * * * * php /path/to/artisan schedule:run`.
