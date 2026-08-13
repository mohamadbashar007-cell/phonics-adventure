# Phonics Adventure — Unlocked Preview

> Preview-only build. It opens directly without sign-in, keeps all groups,
> lessons, and exams unlocked, and stores progress locally in the browser.
> This repository does not replace or modify the production application.

## Run the preview

```bash
pnpm install
pnpm build
pnpm preview
```

The preview UI does not require a database or an account. Progress stays in
the browser under the separate `phonics-preview-progress` storage key.

The unlocked preview is published to GitHub Pages from the
`preview/no-auth-unlocked` branch:

https://mohamadbashar007-cell.github.io/phonics-adventure/

## Database

The app uses PostgreSQL through `DATABASE_URL`. For production, the intended setup is one VPS/server running both the app and PostgreSQL together through Docker Compose.

The included `docker-compose.yml` starts:

- `db`: PostgreSQL 16
- `app`: the React build + Express/tRPC backend

Create or update `.env` before deployment:

```env
POSTGRES_DB=phonics_adventure
POSTGRES_USER=phonics_app
POSTGRES_PASSWORD=change_this_password_before_production
APP_PORT=3000
DATABASE_URL="postgresql://phonics_app:change_this_password_before_production@localhost:5432/phonics_adventure"
DB_POOL_MAX=10
```

Change `POSTGRES_PASSWORD` before production.

Run the full app and database:

```bash
docker compose up -d --build
```

The app creates the schema automatically on startup and seeds the developer account.

Useful commands:

```bash
pnpm db:init
pnpm db:check
pnpm auth:check
```

For Docker deployment, the database data lives in the `postgres_data` Docker volume. Do not delete this volume unless you intentionally want to erase the database.

`pnpm db:init` creates the production schema and seeds the developer account when running outside Docker. Lesson content still comes from `src/data/curriculum.json`; progress, attempts, stats, and future OTP/session data live in PostgreSQL.

Keep PostgreSQL bound to localhost/private networking only. In `docker-compose.yml`, port `5432` is bound to `127.0.0.1`, not public internet. Backups must be stored outside the server.

Create a database backup:

```bash
sh deploy/backup-postgres.sh
```

Restore a backup:

```bash
sh deploy/restore-postgres.sh backups/phonics_adventure-YYYYMMDD-HHMMSS.sql.gz
```

Default developer login:

```text
username: dev
password: 1111
```

Restricted trial login:

```text
email: trial@trial.dev
password: 2222
```

The trial account uses normal student progression. Only Group 1 is available initially;
later groups unlock after passing the preceding group exams.
