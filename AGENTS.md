# AGENTS.md

Rules for anyone changing this codebase: developers and AI coding agents alike.
Follow them in every change. If a rule blocks you, change the rule here in the
same pull request and explain why.

## Quality bar for every change

This system is meant to last for years. Every change, however small, must keep
or improve all five qualities below. If a change trades one away (for example,
a faster query that is harder to maintain), say so in the pull request and
explain why it is worth it. Before finishing, check each item.

### 1. Performance stays stable

- Do not make existing pages or actions slower. Measure before and after when
  touching hot paths (imports, dashboards, matching, exports).
- Database: no queries inside loops (eager-load with `with()`), select only
  needed columns, paginate lists, and index every column used to filter, join
  or sort. Aggregate large data (e.g. daily sales) in SQL or summary tables,
  not in PHP or the browser.
- Heavy or slow work (imports, syncs, large exports) runs in queued jobs, not
  during the web request.
- Frontend: keep heavy libraries out of the shared bundle (load them only on
  the pages that need them), avoid unnecessary re-renders, and keep large files
  in Web Workers. A production build must show no new chunk-size warnings.
- Cache data that is expensive to compute and rarely changes, with a clear
  expiry or invalidation.

### 2. Easy to maintain

- Follow the Architecture rules below: thin controllers, Actions, Form
  Requests, feature folders, shared code instead of copies.
- Small, focused files and functions with business names. Comments explain
  why, not what.
- No dead code, unused dependencies, or commented-out code left behind.
- Update README.md and this file in the same change when setup, behavior or
  rules change.

### 3. Scales with growth

- Design for 10× today's data and users: daily sales will grow every day, so
  assume tables with millions of rows.
- Keep the code host-independent: no Hostinger-specific paths or assumptions in
  application code (use `.env`/`config()`), so the app can move to a VPS or
  another host without a rewrite.
- New features go in their own domain/feature folder so they can grow without
  tangling with others.
- Prefer stable, widely used, well-maintained packages; add a dependency only
  when it clearly beats writing a small amount of code.

### 4. Reliable

- Every change has tests that would fail if it broke; `composer ci:check`
  passes before merging.
- Validate inputs and handle failures explicitly: show users a clear message,
  log the technical detail, never fail silently.
- Data changes are safe: migrations are reversible where possible, imports are
  idempotent (re-running one does not duplicate data), and multi-step writes
  use database transactions.
- Do not break existing behavior or data. If a change alters behavior, document
  it and migrate existing data.
- Nothing reaches `master` without passing CI on `dev` first.

### 5. Secure

- Follow the Security section below for every change.
- Treat all input (forms, uploads, portal data, URLs) as untrusted: validate
  it, and never build SQL, shell commands or HTML from it directly.
- Every new route requires `auth` + `verified` unless it is deliberately
  public, and that decision is noted in the pull request.
- Never log or display passwords, tokens or personal data. Never commit
  secrets.
- Prefer the framework's built-in protections (CSRF, hashing, encryption,
  rate limiting) over custom code. Run `composer audit` and `npm audit` when
  adding or updating dependencies.

## What this is

**Sales Management System**: an internal web app for a small team (3–4 accounts, one
shared role) that automates spreadsheet work and will grow into a sales
management system fed by the SM Vendor Portal's Daily Sales Report (DSR).

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Backend  | Laravel 13, PHP 8.4+, MySQL/MariaDB                              |
| Frontend | React 19 + TypeScript (strict), Inertia 3, Tailwind 4, shadcn/ui |
| Auth     | Laravel Fortify, invite-only (`php artisan user:create`)         |
| Routes   | Laravel Wayfinder generates typed route helpers for React        |
| Tooling  | Pint, Larastan (level 7), Pest; Vite+ (`vp`: lint, fmt, Vitest)  |
| Hosting  | Hostinger Business (PHP + MySQL)                                 |

## Commands

```bash
composer dev          # app server + queue + logs + Vite
composer ci:check     # everything CI runs; must pass before you finish
composer lint         # format PHP (Pint)
npm run check:fix     # format + lint TypeScript
npm test              # frontend unit tests (Vitest)
php artisan test      # backend tests (Pest)
php artisan user:create   # create a login account
```

On Windows, run PHP commands from PowerShell (Herd's PHP). Git Bash may pick
up an older PHP from XAMPP.

## Architecture

### Backend (`app/`)

Request flow: **route → controller → Form Request → Action → Model**.

- **Controllers are thin.** They take a validated request, call one Action and
  return an Inertia response or redirect. No business rules, no queries beyond
  a simple lookup.
- **Validation lives in Form Requests** (`app/Http/Requests/<Area>/`).
- **Business logic lives in Actions**: one class, one job, one public
  `handle()` method, named as a verb phrase (`ImportDsrReport`,
  `GetTopSellingItems`). Actions are where tests focus.
- **Group business code by domain** once a feature needs server-side logic:

    ```
    app/Domains/<Domain>/
        Actions/   ImportDsrReport.php
        Models/    DailySale.php
        Data/      typed value objects passed between layers
        Enums/     fixed values (statuses, types)
    ```

    Framework glue stays where Laravel expects it: `app/Http`, `app/Providers`,
    `app/Console`. Fortify's auth actions stay in `app/Actions/Fortify`.

- **Use Eloquent** with relationships and query scopes. No raw SQL strings
  built from input. Add indexes in migrations for columns you filter or sort on.
- **Use Enums** for fixed values instead of repeating strings.
- **Database changes only through migrations.** Never edit a migration that
  has run in production; add a new one.

### Frontend (`resources/js/`)

```
pages/<area>/index.tsx    thin Inertia pages: title, layout, one feature component
features/<feature>/
    components/           UI for this feature only
    lib/                  pure TypeScript logic + colocated *.test.ts
    store.ts              feature state and actions (if needed)
components/               shared app components
components/ui/            shadcn/ui primitives (generated; restyle via props)
components/workbook/      shared upload/table/pagination widgets
lib/                      shared helpers (no React in pure logic files)
actions/ routes/ wayfinder/   GENERATED by Wayfinder; never edit or commit
```

- **Keep logic out of components.** Parsing, matching and exporting are pure
  functions in `features/<feature>/lib/` with unit tests. Components only
  render and call actions.
- **Use Wayfinder helpers** (`import { poMatching } from '@/routes'`) instead of
  hard-coded URLs.
- **Shared before duplicated.** If two features need the same widget or helper,
  move it to `components/` or `lib/`.
- Files are kebab-case; components are PascalCase named exports (pages use a
  default export because Inertia resolves them by file path).
- One concern per file. If a component passes ~250 lines, split it.

### Workbook tools: privacy rule

PO/GR and RA/ICR workbooks are **processed in the browser and never sent to the
server**. Do not add uploads of these files to the backend without an explicit
decision from the project owner; the UI promises "processed locally".

## Code standards

- TypeScript `strict`; no `any`. Use `unknown` and narrow it.
- PHP: typed properties, parameters and return types; PHPStan must pass at
  level 7 without new baseline entries.
- Name things for the business: `DeliveryStatus`, `MatchStatus`, not
  `status2`/`data`.
- Comments explain **why**, not what.
- Remove dead code instead of commenting it out.

## Testing

- Every Action and every `lib/` module gets tests. Bug fix → add a test that
  fails without the fix.
- Backend: Pest feature tests in `tests/Feature/<Area>/`; the test DB is
  in-memory SQLite (see `phpunit.xml`).
- Frontend: Vitest, colocated as `*.test.ts` next to the code.
- `composer ci:check` must pass before a change is considered done.

## Security

- Accounts are **invite-only**. Do not re-enable `Features::registration()`.
- Every route that shows data sits behind `auth` + `verified` middleware.
- Validate all input with Form Requests; authorise anything user-specific.
- Secrets live in `.env` only (never committed). Use `config()` in code, not
  `env()` outside `config/`.
- Production: `APP_ENV=production`, `APP_DEBUG=false`, HTTPS only.
- Credentials for external systems (e.g. the vendor portal) must be stored
  encrypted (`encrypted` cast) and only with the owner's approval.
- Keep dependencies current; review Dependabot PRs weekly.

## Git

- **`master`** is production: only tested, released code. Never commit to it
  directly; it is updated by merging `dev` once a release is ready.
- **`dev`** is the development branch. Branch feature work from `dev` (e.g.
  `feat/dsr-import`), one topic per branch, and merge back into `dev` through a
  pull request after `composer ci:check` passes.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, `chore:`,
  `docs:`, `test:`).
- Never commit `.env`, `vendor/`, `node_modules/`, `public/build/`, or the
  generated Wayfinder folders.
