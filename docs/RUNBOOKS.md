# Runbooks

All commands run on the server in `/opt/glasswork/infra/prod` as the `deploy` user unless noted. `E=docker compose -p glasswork-edge -f docker-compose.edge.yml --env-file .env.production`.

## Is it up? (first 2 minutes of any incident)

1. `curl -s https://api.DOMAIN/ready`: `ok` means database and Redis are reachable.
2. `docker ps`: five containers should be running (caddy, redis, clamav, worker, plus the live `glasswork-<slot>` api and web).
3. `cat state/active_slot state/current_tag`: which release is live.
4. Logs: `docker logs --tail 200 glasswork-<slot>-api-1` (and `-web-1`, `glasswork-edge-worker-1`).

## Site down or 502

- Caddy cannot reach the live slot: `docker ps` and look for an unhealthy/exited container. `docker compose -p glasswork-<slot> -f docker-compose.app.yml --env-file .env.production up -d` restarts it.
- If a release is bad, roll back (below). Do not debug live first.

## Roll back a bad release

GitHub → Actions → Rollback (production). Or on the server: `./scripts/rollback.sh` (previous tag) / `./scripts/rollback.sh <tag>`.

## Failed deploy

The deploy script leaves the live slot untouched when the new slot is unhealthy or the post-switch check fails (it switches back by itself). Read the printed container logs, fix, redeploy. Migrations ran before the switch, so make sure every migration is **backward compatible** (add columns/tables first; remove them in a later release).

## Restore the database

1. **Small mistake (bad data in the last days):** use the provider's point-in-time recovery to create a _new_ database branch at the time just before the mistake, check it, then either copy rows across or point `DATABASE_URL` at it and redeploy.
2. **Provider lost the data:** pick the newest file in the `glasswork-backups` bucket (`db/glasswork-<time>.sql.gz.enc`), download it, then:
   `openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE < file.sql.gz.enc | gunzip | psql "$NEW_DATABASE_URL"`
3. Point `DATABASE_URL` at the restored database and redeploy. Run `GET /ready`.
4. Money: compare `ledger_entries` totals with Stripe's dashboard before reopening payments.

The nightly `restore-verify.sh` proves the newest dump really restores; it alerts if it ever fails. Test the drill by hand once a quarter.

## Backups failed alert

`tail -50 /var/log/glasswork-backup.log`. Usual causes: expired R2 token, wrong `BACKUP_PASSPHRASE`, database unreachable. Fix, then run `./scripts/backup.sh && ./scripts/restore-verify.sh`.

## Queue backed up / emails or auto-approvals late

`docker logs --tail 200 glasswork-edge-worker-1`; `docker exec glasswork-edge-redis-1 redis-cli llen bull:<queue>:wait`. Restart: `$E up -d --force-recreate worker`.

## Payments: webhook problems

Stripe dashboard → Developers → Webhooks shows failed deliveries. Events are stored; replay them from Admin → Payments → Webhook events. Never mark anything paid by hand: use the replay tool so the ledger stays balanced.

## Disk full

`df -h`; `docker system prune -af --filter "until=72h"`; old image tags are pruned weekly by deploys. Logs rotate at 10 MB x 5.

## Rotate a secret

Change it in `.env.production`, redeploy. `BETTER_AUTH_SECRET` rotation logs everyone out. `BACKUP_PASSPHRASE`: keep the old one for old backups.

## Suspected account abuse / security incident

Admin → Users → ban. Admin → Audit shows who did what. Rotate `INTERNAL_API_TOKEN`, `BETTER_AUTH_SECRET` and provider keys, redeploy, and tell affected users as required by law.

## Scaling path

1. Bigger VPS (vertical). 2. Move Redis to a managed Redis. 3. Run api/web on two servers behind a load balancer (Caddy -> managed LB); Socket.io already uses the Redis adapter. 4. Read replica for reporting. 5. Swap the SearchService for Meilisearch when Postgres full-text becomes the bottleneck.
