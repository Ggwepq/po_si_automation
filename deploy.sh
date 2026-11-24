#!/usr/bin/env bash
#
# Deploy the Sales Management app on Hostinger.
#
#   ./deploy.sh            # asks whether to pull, then which branch
#   ./deploy.sh master     # if you choose to pull, uses the "master" branch
#
# Layout on the server:
#   App:      $HOME/projects/sales-manager                 (this repository)
#   Web root: $HOME/domains/waldo-portal.site/public_html/subdomains/sales-manager
#             -> symlink to $HOME/projects/sales-manager/public
#
# Steps: (optional) pull a branch -> (optional) install dependencies -> build front-end
# assets -> check the web-root symlink and storage link -> (optional) run migrations ->
# caches.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_WEB_ROOT="${PUBLIC_WEB_ROOT:-$HOME/domains/waldo-portal.site/public_html/subdomains/sales-manager}"

# Hostinger shared hosting caps how many threads one account may start. Vite+ and
# Rolldown start one worker per CPU core by default and crash with
# "OS can't spawn worker thread ... (os error 11)". Keep their thread pools small.
export TOKIO_WORKER_THREADS="${TOKIO_WORKER_THREADS:-2}"
export RAYON_NUM_THREADS="${RAYON_NUM_THREADS:-2}"
export ROLLDOWN_WORKER_THREADS="${ROLLDOWN_WORKER_THREADS:-2}"
export ROLLDOWN_MAX_BLOCKING_THREADS="${ROLLDOWN_MAX_BLOCKING_THREADS:-4}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-2}"

BUILD_ATTEMPTS=3

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
note() { printf '\033[0;33m%s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# ask "Question" y|n  -> returns 0 for yes. The second argument is the default.
ask() {
    local prompt="$1" default="${2:-n}" reply
    if [[ $default == y ]]; then prompt+=" [Y/n] "; else prompt+=" [y/N] "; fi
    read -r -p "$prompt" reply
    reply="${reply:-$default}"
    [[ $reply =~ ^[Yy]$ ]]
}

trap 'fail "Deployment stopped: command failed on line $LINENO."' ERR

cd "$ROOT"
[[ -f "$ROOT/artisan" ]] || fail "Could not find $ROOT/artisan. Run this script from the repository root."
for cmd in git npm; do
    command -v "$cmd" >/dev/null || fail "'$cmd' is not installed or not on PATH."
done

# The server's default "php" is older than what the Laravel dependencies need; newer
# versions live under /opt (e.g. /opt/alt/php84/usr/bin/php). Use PHP_BIN if given,
# otherwise the newest PHP that meets the dependencies' version requirement.

# Used only before "composer install" has created vendor/ (e.g. on a fresh clone).
# Afterwards, Composer's generated vendor/composer/platform_check.php is authoritative.
MIN_PHP_VERSION_ID=80400   # composer.json: "php": "^8.4"

php_is_supported() {
    if [[ -f "$ROOT/vendor/composer/platform_check.php" ]]; then
        "$1" "$ROOT/vendor/composer/platform_check.php" >/dev/null 2>&1
    else
        "$1" -r "exit(PHP_VERSION_ID >= $MIN_PHP_VERSION_ID ? 0 : 1);" >/dev/null 2>&1
    fi
}

PHP=""
if [[ -n ${PHP_BIN:-} ]]; then
    [[ -x $PHP_BIN ]] || fail "PHP_BIN=$PHP_BIN does not exist or is not executable."
    if ! php_is_supported "$PHP_BIN"; then
        "$PHP_BIN" -v | head -1
        fail "PHP_BIN=$PHP_BIN is too old for this app's dependencies."
    fi
    PHP="$PHP_BIN"
else
    # Plain word-splitting instead of "< <(...)": Hostinger's shell has no /dev/fd.
    candidates="$(ls -1d /opt/alt/php*/usr/bin/php /opt/cpanel/ea-php*/root/usr/bin/php 2>/dev/null | sort -rV || true)"
    candidates+=$'\n'"$(command -v php || true)"

    for candidate in $candidates; do
        if [[ -x $candidate ]] && php_is_supported "$candidate"; then
            PHP="$candidate"
            break
        fi
    done
    [[ -n $PHP ]] || fail "No installed PHP is new enough. Check 'ls /opt/alt/' and set it explicitly, e.g.: PHP_BIN=/opt/alt/php84/usr/bin/php ./deploy.sh"
fi

# Put it first on PATH so the build's Wayfinder plugin ("php artisan ...") and
# Composer use the same PHP as this script.
export PATH="$(dirname "$PHP"):$PATH"
echo "Using PHP $("$PHP" -r 'echo PHP_VERSION;') ($PHP)"

# A fresh clone has no .env (it is never committed); Artisan and the build need it.
[[ -f "$ROOT/.env" ]] || fail ".env is missing. Create it first: cp .env.example .env, then fill in APP_URL and the DB_* settings, and run: $PHP artisan key:generate"
grep -qE '^APP_KEY=.+' "$ROOT/.env" || fail "APP_KEY is empty in .env. Run: $PHP artisan key:generate"
grep -qE '^APP_ENV=production' "$ROOT/.env" || note "Warning: APP_ENV is not 'production' in .env."
grep -qE '^APP_DEBUG=(false|0)' "$ROOT/.env" || note "Warning: APP_DEBUG is not 'false' in .env. Error pages will show stack traces and secrets."

COMPOSER="$(command -v composer || command -v composer2 || true)"

# 1. Choose and pull the branch -------------------------------------------------
current="$(git rev-parse --abbrev-ref HEAD)"
branch="$current"
changed=""

echo "Current branch: $current at $(git log -1 --format='%h %s (%cr)')"
if ! ask "Pull the latest changes from GitHub first?" y; then
    note "Skipping pull; building the code already on the server."
else
    step "Fetching branches from GitHub"
    # Uses this repository's remote. For a private repo, use an SSH remote with a
    # deploy key (git remote set-url origin git@github.com:...) or a stored token.
    git fetch --prune origin

    branch="${1:-}"
    if [[ -z $branch ]]; then
        echo "Available branches:"
        git branch -r --format='  %(refname:lstrip=3)' | grep -v '^  HEAD$' | grep -v '^  dependabot/'
        read -r -p "Branch to deploy [$current]: " branch
        branch="${branch:-$current}"
    fi
    git show-ref --verify --quiet "refs/remotes/origin/$branch" || fail "Branch 'origin/$branch' does not exist."

    if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
        git status --short --untracked-files=no
        fail "The server has uncommitted changes to tracked files. Commit, stash, or discard them first."
    fi

    before="$(git rev-parse HEAD)"
    step "Deploying branch '$branch'"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        git checkout "$branch"
    else
        git checkout -b "$branch" --track "origin/$branch"
    fi
    # Update from the fetch above instead of "git pull", so GitHub is only contacted
    # once. --ff-only: never create merge commits on the server; stop if histories diverged.
    git merge --ff-only "origin/$branch"
    after="$(git rev-parse HEAD)"

    if [[ $before == "$after" ]]; then
        note "Already up to date."
    else
        echo "New commits:"
        git log --oneline "$before..$after" | sed 's/^/  /'
        changed="$(git diff --name-only "$before" "$after")"
    fi
fi

changed_matches() { grep -qE "$1" <<<"$changed"; }

# 2. Dependencies (suggested automatically when lock files changed) -------------
if [[ -n $COMPOSER ]]; then
    default=n
    if [[ ! -f "$ROOT/vendor/autoload.php" ]]; then
        default=y; note "vendor/ is missing."
    elif changed_matches '^composer\.lock$'; then
        default=y; note "composer.lock changed in this update."
    fi
    if ask "Install PHP dependencies (composer install)?" "$default"; then
        step "Installing PHP dependencies"
        (cd "$ROOT" && "$COMPOSER" install --no-dev --optimize-autoloader --no-interaction)
    fi
else
    [[ -f "$ROOT/vendor/autoload.php" ]] || fail "Composer not found and vendor/ is missing."
    note "Composer not found; skipping PHP dependency install."
fi

default=n
changed_matches '^package(-lock)?\.json$' && default=y && note "package.json / package-lock.json changed in this update."
[[ ! -d "$ROOT/node_modules" ]] && default=y && note "node_modules/ is missing."
if ask "Install Node dependencies (npm ci)?" "$default"; then
    step "Installing Node dependencies"
    # Dev dependencies include the build tools (vite-plus), so keep them.
    npm ci --include=dev --no-audit --no-fund
fi

# 3. Build front-end assets -----------------------------------------------------
# The build generates resources/js/routes and resources/js/actions (Wayfinder) from
# Laravel's route list. A route/config cache from an earlier "php artisan optimize"
# would hide routes added since then and the build would fail with
# "Could not load ... resources/js/routes/...". Step 6 can rebuild the caches.
step "Clearing cached routes and config"
"$PHP" "$ROOT/artisan" route:clear
"$PHP" "$ROOT/artisan" config:clear

step "Building front-end assets (threads limited for shared hosting)"
attempt=1
until npm run build; do
    if (( attempt >= BUILD_ATTEMPTS )); then
        fail "Build failed after $BUILD_ATTEMPTS attempts. The previous assets in public/build were left in place.
Try lowering the limits, e.g.: TOKIO_WORKER_THREADS=1 RAYON_NUM_THREADS=1 ROLLDOWN_WORKER_THREADS=1 ./deploy.sh $branch
Or build on your computer and upload public/build."
    fi
    note "Build failed (attempt $attempt of $BUILD_ATTEMPTS). Retrying in 10 seconds..."
    attempt=$((attempt + 1))
    sleep 10
done

# public/hot points the app at a Vite dev server; it must never exist in production.
if [[ -e "$ROOT/public/hot" ]]; then
    rm -f -- "$ROOT/public/hot"
    note "Removed public/hot (left over from a dev server)."
fi

# 4. Web root and storage links -------------------------------------------------
# The subdomain's web root is a symlink to this repository's public/ folder, so
# new files in public/ (build/, images/, .htaccess) are served without copying.
step "Checking the web-root symlink"
if [[ "$PUBLIC_WEB_ROOT" -ef "$ROOT/public" ]]; then
    echo "OK: $PUBLIC_WEB_ROOT -> $ROOT/public"
elif [[ -L "$PUBLIC_WEB_ROOT" ]]; then
    echo "$PUBLIC_WEB_ROOT points to: $(readlink "$PUBLIC_WEB_ROOT")"
    if ask "It does not point to $ROOT/public. Repoint it?" n; then
        ln -sfnT -- "$ROOT/public" "$PUBLIC_WEB_ROOT"
        echo "Linked: $PUBLIC_WEB_ROOT -> $ROOT/public"
    else
        note "Left as is. The site will not show this deployment until it points to $ROOT/public."
    fi
elif [[ -e "$PUBLIC_WEB_ROOT" ]]; then
    # Hostinger creates the subdomain folder as a real directory (with a default page).
    if ask "$PUBLIC_WEB_ROOT is a real folder, not a symlink. Move it aside and replace it with a symlink?" n; then
        backup="$PUBLIC_WEB_ROOT.old-$(date +%Y%m%d-%H%M%S)"
        mv -- "$PUBLIC_WEB_ROOT" "$backup"
        ln -sT -- "$ROOT/public" "$PUBLIC_WEB_ROOT"
        echo "Linked: $PUBLIC_WEB_ROOT -> $ROOT/public"
        note "The old folder was kept as $backup. Check it, then delete it."
    else
        note "Left as is. The site will not show this deployment until it points to $ROOT/public."
    fi
else
    [[ -d "$(dirname "$PUBLIC_WEB_ROOT")" ]] || fail "$(dirname "$PUBLIC_WEB_ROOT") does not exist. Create the subdomain in hPanel first, or set PUBLIC_WEB_ROOT."
    if ask "$PUBLIC_WEB_ROOT does not exist. Create it as a symlink to $ROOT/public?" y; then
        ln -sT -- "$ROOT/public" "$PUBLIC_WEB_ROOT"
        echo "Linked: $PUBLIC_WEB_ROOT -> $ROOT/public"
    fi
fi

if [[ ! -e "$ROOT/public/storage" ]]; then
    step "Creating the public/storage link"
    "$PHP" "$ROOT/artisan" storage:link
fi

# 5. Database migrations --------------------------------------------------------
step "Checking database migrations"
pending="$("$PHP" "$ROOT/artisan" migrate:status --pending --no-ansi 2>/dev/null | grep -E 'Pending' || true)"
if [[ -z $pending ]]; then
    echo "No pending migrations."
else
    echo "Pending migrations:"
    echo "$pending" | sed 's/^ */  /'
    if ask "Run these migrations now (php artisan migrate --force)?" n; then
        "$PHP" "$ROOT/artisan" migrate --force
    else
        note "Skipped. New features may fail until you run: $PHP artisan migrate --force"
    fi
fi

# 6. Caches ---------------------------------------------------------------------
if ask "Rebuild compiled views (php artisan view:cache)?" y; then
    step "Caching views"
    "$PHP" "$ROOT/artisan" view:clear
    "$PHP" "$ROOT/artisan" view:cache
fi

if ask "Refresh config, route, and event caches (php artisan optimize)?" n; then
    step "Refreshing Laravel caches"
    "$PHP" "$ROOT/artisan" optimize:clear
    "$PHP" "$ROOT/artisan" optimize
fi

# QUEUE_CONNECTION=database: tell any running queue worker to reload the new code.
"$PHP" "$ROOT/artisan" queue:restart >/dev/null 2>&1 || true

trap - ERR
step "Done"
echo "Deployed $branch at $(git log -1 --format='%h %s (%cr)')."
