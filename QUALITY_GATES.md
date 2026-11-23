# Quality Gates

Project-specific commands, checks, and thresholds for **Sales Management System**.
All gates apply before merging to `dev` or `master` (see
[`.github/workflows/tests.yml`](.github/workflows/tests.yml)).

## Master Gate

| Gate          | Command             | Threshold                                       |
| ------------- | ------------------- | ----------------------------------------------- |
| Full CI suite | `composer ci:check` | Exit code `0`; zero skipped/weakened assertions |

`composer ci:check` runs in sequence:

1. `npm run check`
2. `npm run types:check`
3. `npm test`
4. `composer test` (`config:clear`, `pint --parallel --test`, `phpstan analyse`, `php artisan test`)

## Language & Layer Gates

### Backend (PHP / Laravel)

| Check                | Command                                                      | Threshold                                                             |
| -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Code formatting      | `composer lint:check` (`pint --parallel --test`)             | `0` style violations                                                  |
| Auto-format          | `composer lint` (`pint --parallel`)                          | —                                                                     |
| Static analysis      | `composer types:check` (`phpstan analyse --memory-limit=1G`) | Level `7`, `0` errors, no new baseline entries (`phpstan.neon`)       |
| Feature & unit tests | `php artisan test` (Pest, in-memory SQLite)                  | `100%` passing; every Action and route covered                        |
| Security audit       | `composer audit`                                             | `0` known unpatched vulnerabilities when adding/updating dependencies |

### Frontend (TypeScript / React)

| Check                  | Command                                | Threshold                                                                                                      |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Format & lint          | `npm run check` (`vp check`)           | `0` formatting diffs, `0` warnings, `0` errors (`denyWarnings: true`, `typeAware: true` in `vite.config.ts`)   |
| Auto-fix format & lint | `npm run check:fix` (`vp check --fix`) | —                                                                                                              |
| Type check             | `npm run types:check` (`tsc --noEmit`) | Strict TypeScript, `0` errors, no `any`                                                                        |
| Unit tests             | `npm test` (`vp test`, Vitest)         | `100%` passing; every `features/*/lib/` module covered                                                         |
| Production bundle      | `npm run build` (`vp build`)           | Exit code `0`; `chunkSizeWarningLimit: 600` kB (`xlsx` isolated in its own chunk); `0` new chunk-size warnings |
| Security audit         | `npm audit`                            | `0` known unpatched vulnerabilities when adding/updating dependencies                                          |

## Runtime, Data & Security Thresholds

- **Route protection:** every data route uses `auth` + `verified` middleware;
  public registration (`Features::registration()`) remains disabled.
- **Request & upload bounds:** DSR imports are batched (`ImportDsrRequest::MAX_REPORTS`)
  and rate-limited (`throttle:60,1` on import endpoints); workbook uploads stay
  browser-local for PO/GR and RA/ICR tools.
- **Idempotency & transactions:** DSR imports and summaries must remain
  idempotent per `(vendor, store, date)` and wrap multi-step writes in DB
  transactions.
- **Money precision:** sales amounts are validated as decimal strings and summed
  with `bcadd`; never use floats for persisted monetary totals.
- **UI & verification:** changed screens must be reviewed in the running app
  (report viewport/device tested and any unverified cases), covering normal use,
  an error/exception path, and retry/correction behavior.

## Windows Environment Note

Run PHP and Composer commands from **PowerShell** (Laravel Herd's PHP 8.4+),
not Git Bash, which may pick up an older PHP binary.
