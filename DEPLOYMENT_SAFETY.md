# Queue Live — Deployment Safety Review

## Current status

**Production deployment is blocked until the database migration history is checked and an upgrade rehearsal passes.** The latest CI checks run migrations on a new test database. That does not prove that existing customer data will survive an upgrade.

Do not run `python manage.py migrate` against the live Render database as part of this development work.

## Migration risks found in the current repository history

The following operations are present in migrations already shared with the `main` branch:

1. The original `places.0003` migration removed `Place.address`, `Queue.capacity`, `Queue.current_people`, and `Queue.location`. The development branch now retains these fields in both the migration state and models so their existing database values are not dropped.
2. The original `tokens.0002` migration added `Token.name` but did not copy the old `customer_name`. The development branch now copies `customer_name` into `name` before later migrations run.
3. The original `tokens.0003` migration removed `Token.phone` and `Token.public_id` as well as `customer_name`. The development branch now removes only `customer_name`; phone numbers and public UUIDs remain intact.
4. The development branch removes the later `tokens.0006` migration because it would have re-added fields that should never have been removed.

These were data-loss risks, not merely schema changes. The development branch now corrects the migration chain before the planned release. This correction is safe only if the affected migrations have not already been applied to a persistent database. If any environment has already recorded these migrations as applied, do not deploy this rewritten history there; first inspect its `django_migrations` table and prepare a separate forward-only repair migration.

## Required pre-deployment checks

Perform these steps against a copy of the production database first:

1. Take a fresh PostgreSQL backup and verify that the backup file can be read.
2. Confirm whether any migration in this chain has already been applied to the Render database. Do not infer this from whether you personally ran the command; Render start/release commands or Docker entrypoints may run it automatically.
3. Record the deployed application commit and the current migration state:
   ```bash
   python manage.py showmigrations places tokens
   ```
4. Inspect the SQL for each migration that is still unapplied:
   ```bash
   python manage.py sqlmigrate places 0003
   python manage.py sqlmigrate tokens 0002
   python manage.py sqlmigrate tokens 0003
   ```
4. Restore the backup into a separate staging database. Never use the only production database as the rehearsal target.
5. Apply the proposed migrations to staging only. Compare before/after row counts and verify sample businesses, queues, customers, phone numbers, token numbers, statuses and token links.
6. If the rehearsal shows missing customer names, phone numbers, queue fields or token URLs, stop. Prepare a reviewed data-preserving migration or a controlled data-recovery plan before deployment.
7. Confirm the rollback plan. For destructive schema/data changes, the reliable rollback is restoring the verified backup, not assuming reverse migrations can restore deleted values.

## Minimum PostgreSQL backup example

Run this from a secure environment with the correct database connection configured. Keep the backup private and never commit it to Git:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file queue-live-predeploy.dump
pg_restore --list queue-live-predeploy.dump
```

To restore into a separate empty staging database:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$STAGING_DATABASE_URL" queue-live-predeploy.dump
```

Do not paste database URLs, passwords, or backup contents into issues or chat.

## What CI currently verifies

- Django migration state matches the current models.
- Backend tests pass on a newly created test database.
- The React production build passes.
- Docker backend/frontend images build and Docker Compose configuration validates.

CI does **not** currently verify data preservation from the live Render database. That requires a staging copy made from the actual deployed database.
