# Queue Live — Deployment Safety Review

## Current status

**Production deployment is blocked until the database migration history is checked and an upgrade rehearsal passes.** The latest CI checks run migrations on a new test database. That does not prove that existing customer data will survive an upgrade.

Do not run `python manage.py migrate` against the live Render database as part of this development work.

## Migration risks found in the current repository history

The following operations are present in migrations already shared with the `main` branch:

1. `places.0003` removes `Place.address`, `Queue.capacity`, `Queue.current_people`, and `Queue.location`. Any values in those columns are deleted when this migration is applied.
2. `tokens.0002` adds a new `Token.name` field with a timestamp default. It does not copy the existing `customer_name` values into `name`.
3. `tokens.0003` removes `Token.customer_name`, `Token.phone`, and `Token.public_id`. Existing values in those columns are deleted when this migration is applied.
4. `tokens.0006` adds `phone` back as an empty field and creates new public UUIDs. It cannot recover the old phone numbers or old public UUIDs after the earlier migration removed them. Previously shared token URLs would not be preserved.

These are data-loss risks, not merely schema changes. The current development branch does not silently rewrite old migrations because those migrations may already be recorded as applied in a live database. Rewriting an applied migration would not safely repair an existing database.

## Required pre-deployment checks

Perform these steps against a copy of the production database first:

1. Take a fresh PostgreSQL backup and verify that the backup file can be read.
2. Record the deployed application commit and the current migration state:
   ```bash
   python manage.py showmigrations places tokens
   ```
3. Inspect the SQL for each migration that is still unapplied:
   ```bash
   python manage.py sqlmigrate places 0003
   python manage.py sqlmigrate tokens 0002
   python manage.py sqlmigrate tokens 0003
   python manage.py sqlmigrate tokens 0006
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
